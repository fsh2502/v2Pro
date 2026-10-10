import { useEffect, useRef, useState } from "react";
import {
    ArrowRight,
    Eye,
    EyeOff,
    KeyRound,
    Mail,
    ShieldCheck,
} from "lucide-react";
import { api, session } from "./api";
import { Logo, brand } from "./App";
import { Resource, useResource } from "./ui";
import { httpUrl } from "./domain";

let captchaLoading: Promise<void> | null = null;
function loadCaptcha() {
    if (window.grecaptcha?.render) return Promise.resolve();
    if (!captchaLoading) {
        captchaLoading = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            window.iosGlassRecaptchaReady = () => {
                delete window.iosGlassRecaptchaReady;
                resolve();
            };
            script.src =
                "https://www.google.com/recaptcha/api.js?onload=iosGlassRecaptchaReady&render=explicit&hl=vi";
            script.async = true;
            script.defer = true;
            script.onerror = () => {
                script.remove();
                delete window.iosGlassRecaptchaReady;
                captchaLoading = null;
                reject(new Error("Không tải được mã xác minh."));
            };
            document.head.appendChild(script);
        });
    }
    return captchaLoading;
}

function Captcha({
    siteKey,
    onToken,
}: {
    siteKey: string;
    onToken: (token: string) => void;
}) {
    const element = useRef<HTMLDivElement>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        const render = () => {
            if (active && element.current && window.grecaptcha?.render)
                window.grecaptcha.render(element.current, {
                    sitekey: siteKey,
                    theme:
                        document.documentElement.dataset.appearance === "dark"
                            ? "dark"
                            : "light",
                    size:
                        element.current.clientWidth < 304
                            ? "compact"
                            : "normal",
                    callback: onToken,
                    "expired-callback": () => onToken(""),
                    "error-callback": () => {
                        onToken("");
                        setError(true);
                    },
                });
        };
        loadCaptcha()
            .then(render)
            .catch(() => {
                if (active) setError(true);
            });
        return () => {
            active = false;
        };
    }, [siteKey]);
    return (
        <div className="captcha">
            <div ref={element} />
            {error && (
                <p role="alert">
                    Không tải được mã xác minh. Vui lòng tải lại trang.
                </p>
            )}
        </div>
    );
}
export default function Auth({
    page,
    onLogin,
    notify,
}: {
    page: string;
    onLogin: () => void;
    notify: (message: string) => void;
}) {
    const mode = page.startsWith("register")
        ? "register"
        : page.startsWith("forget")
          ? "forget"
          : "login";
    const params = new URLSearchParams(page.split("?")[1]);
    const guest = useResource("guest/comm/config");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [invite, setInvite] = useState(params.get("invite_code") || "");
    const [code, setCode] = useState("");
    const [captcha, setCaptcha] = useState("");
    const [captchaRevision, setCaptchaRevision] = useState(0);
    const [show, setShow] = useState(false);
    const [remember, setRemember] = useState(true);
    const [busy, setBusy] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const verifying = useRef(false);
    const config = guest.data || {};
    const needsCode =
        mode === "forget" || (mode === "register" && config.is_email_verify);
    const needsCaptcha = mode !== "login" && config.is_recaptcha;
    useEffect(() => {
        if (!countdown) return;
        const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);
    useEffect(() => {
        const verify = params.get("verify");
        if (!verify || verifying.current) return;
        verifying.current = true;
        setBusy(true);
        api(`passport/auth/token2Login?verify=${encodeURIComponent(verify)}`)
            .then(({ data }) => {
                if (!data?.auth_data)
                    throw new Error("Mã đăng nhập không hợp lệ.");
                session.save(data.auth_data, true);
                onLogin();
            })
            .catch((error) => {
                notify(error.message);
                location.hash = "/login";
            })
            .finally(() => setBusy(false));
    }, []);
    const resetCaptcha = () => {
        setCaptcha("");
        setCaptchaRevision((n) => n + 1);
    };
    const sendCode = async () => {
        if (!email || busy) return;
        setBusy(true);
        try {
            await api("passport/comm/sendEmailVerify", {
                email,
                isforget: mode === "forget" ? 1 : 0,
                ...(needsCaptcha ? { recaptcha_data: captcha } : {}),
            });
            setCountdown(60);
            notify("Đã gửi mã xác minh đến email của bạn.");
        } catch (error) {
            notify((error as Error).message);
        } finally {
            setBusy(false);
            if (needsCaptcha) resetCaptcha();
        }
    };
    const submit = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await api(
                `passport/auth/${mode === "forget" ? "forget" : mode}`,
                {
                    email,
                    password,
                    ...(mode !== "login"
                        ? {
                              email_code: code,
                              invite_code: invite,
                              recaptcha_data: captcha,
                          }
                        : {}),
                },
            );
            if (mode === "forget") {
                notify("Đã đặt lại mật khẩu. Vui lòng đăng nhập.");
                location.hash = "/login";
                setPassword("");
            } else {
                if (!result.data?.auth_data)
                    throw new Error("Máy chủ chưa cấp phiên đăng nhập.");
                session.save(result.data.auth_data, remember);
                onLogin();
            }
        } catch (error) {
            notify((error as Error).message);
            if (needsCaptcha) resetCaptcha();
        } finally {
            setBusy(false);
        }
    };
    const heading = {
        login: "Chào mừng trở lại",
        register: "Tạo tài khoản",
        forget: "Đặt lại mật khẩu",
    }[mode];
    return (
        <main className="auth-layout">
            <div className="auth-story">
                <Logo />
                <span className="auth-eyebrow">
                    <ShieldCheck size={18} />
                    Kết nối an toàn, mọi nơi
                </span>
                <h1>
                    Một kết nối.
                    <br />
                    Cả thế giới
                    <br />
                    <span>trong tầm tay.</span>
                </h1>
                <p>
                    Quản lý dịch vụ, đồng bộ ứng dụng và khám phá trải nghiệm
                    của bạn cùng {brand}.
                </p>
                <div className="auth-orbit" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </div>
            </div>
            <section className="card auth-card">
                <div className="mobile-auth-logo">
                    <Logo />
                </div>
                <h2>{heading}</h2>
                <p>
                    {mode === "login"
                        ? "Đăng nhập để tiếp tục trải nghiệm của bạn."
                        : "Thông tin của bạn được bảo vệ an toàn."}
                </p>
                <Resource state={guest}>
                    <form
                        className="form-stack"
                        onSubmit={(e) => {
                            e.preventDefault();
                            submit();
                        }}
                    >
                        <label>
                            Email
                            <div className="icon-input">
                                <Mail size={18} />
                                <input
                                    required
                                    type={mode === "login" ? "text" : "email"}
                                    inputMode="email"
                                    autoComplete="username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ban@example.com"
                                />
                            </div>
                        </label>
                        <label>
                            {mode === "forget" ? "Mật khẩu mới" : "Mật khẩu"}
                            <div className="icon-input">
                                <KeyRound size={18} />
                                <input
                                    required
                                    minLength={8}
                                    type={show ? "text" : "password"}
                                    autoComplete={
                                        mode === "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="Tối thiểu 8 ký tự"
                                />
                                <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={
                                        show ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                                    }
                                    onClick={() => setShow(!show)}
                                >
                                    {show ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>
                            </div>
                        </label>
                        {mode === "register" && (
                            <label>
                                Mã mời{!config.is_invite_force && " (nếu có)"}
                                <input
                                    required={!!config.is_invite_force}
                                    value={invite}
                                    onChange={(e) => setInvite(e.target.value)}
                                />
                            </label>
                        )}
                        {needsCode && (
                            <label>
                                Mã xác minh email
                                <div className="input-action">
                                    <input
                                        required
                                        inputMode="numeric"
                                        value={code}
                                        onChange={(e) =>
                                            setCode(e.target.value)
                                        }
                                        autoComplete="one-time-code"
                                    />
                                    <button
                                        className="button secondary"
                                        type="button"
                                        disabled={
                                            busy ||
                                            countdown > 0 ||
                                            !email ||
                                            (needsCaptcha && !captcha)
                                        }
                                        onClick={sendCode}
                                    >
                                        {countdown > 0
                                            ? `${countdown}s`
                                            : "Gửi mã"}
                                    </button>
                                </div>
                            </label>
                        )}
                        {needsCaptcha && (
                            <Captcha
                                key={captchaRevision}
                                siteKey={config.recaptcha_site_key}
                                onToken={setCaptcha}
                            />
                        )}
                        {mode === "login" && (
                            <div className="auth-options">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) =>
                                            setRemember(e.target.checked)
                                        }
                                    />
                                    Ghi nhớ đăng nhập
                                </label>
                                <a href="#/forget">Quên mật khẩu?</a>
                            </div>
                        )}
                        {mode === "register" &&
                            httpUrl(config.tos_url || "") && (
                                <label className="checkbox-label">
                                    <input type="checkbox" required />
                                    Tôi đồng ý với{" "}
                                    <a
                                        href={config.tos_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        điều khoản dịch vụ
                                    </a>
                                </label>
                            )}
                        <button
                            className="button primary"
                            type="submit"
                            disabled={
                                busy ||
                                (needsCaptcha &&
                                    mode === "register" &&
                                    !captcha)
                            }
                        >
                            {busy
                                ? "Đang xử lý…"
                                : {
                                      login: "Đăng nhập",
                                      register: "Đăng ký",
                                      forget: "Đặt lại mật khẩu",
                                  }[mode]}
                            <ArrowRight size={18} />
                        </button>
                    </form>
                    <p className="auth-bottom">
                        {mode === "login" ? (
                            <>
                                Chưa có tài khoản?{" "}
                                <a href="#/register">Đăng ký ngay</a>
                            </>
                        ) : (
                            <a href="#/login">Quay lại đăng nhập</a>
                        )}
                    </p>
                </Resource>
            </section>
        </main>
    );
}
