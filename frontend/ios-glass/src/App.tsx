import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    Bell,
    BookOpen,
    ChevronDown,
    Gem,
    Headphones,
    Home,
    Layers3,
    Moon,
    Search,
    Sun,
    UserRound,
    ReceiptText,
} from "lucide-react";
import { api, session } from "./api";
import { AppContext, Modal, Resource, useResource } from "./ui";
import {
    Dashboard,
    Sync,
    Traffic,
    Notices,
    Knowledge,
    Servers,
} from "./Dashboard";
import { Plans, Orders, OrderDetail } from "./Commerce";
import { Profile, Support, TicketDetail } from "./Account";
import Auth from "./Auth";

declare global {
    interface Window {
        iosGlass?: {
            title?: string;
            logo?: string;
            description?: string;
            config?: Record<string, string>;
        };
        grecaptcha?: any;
        iosGlassRecaptchaReady?: () => void;
    }
}
const boot = window.iosGlass || {};
export const brand = boot.title || "v2Pro";
const links = [
    { path: "dashboard", label: "Trang chủ", short: "Trang chủ", icon: Home },
    { path: "plans", label: "Gói dịch vụ", short: "Gói", icon: Layers3 },
    { path: "orders", label: "Đơn hàng", short: "Đơn hàng", icon: ReceiptText },
    { path: "support", label: "Hỗ trợ", short: "Hỗ trợ", icon: Headphones },
    {
        path: "profile",
        label: "Tài khoản",
        short: "Tài khoản",
        icon: UserRound,
    },
];
function currentRoute() {
    const route = location.hash.replace(/^#\/?/, "") || "dashboard";
    if (route.startsWith("order/"))
        return `order?trade_no=${encodeURIComponent(route.slice(6).split("?")[0])}`;
    if (route === "plan") return "plans";
    if (route === "ticket") return "support";
    return route;
}
export function Logo() {
    return (
        <span className="logo">
            {boot.logo ? (
                <img src={boot.logo} alt={brand} />
            ) : brand === "v2Pro" ? (
                <>
                    <span>v2</span>Pro
                </>
            ) : (
                brand
            )}
        </span>
    );
}

export default function App() {
    const [route, setRoute] = useState(currentRoute);
    const [logged, setLogged] = useState(!!session.get());
    const [revision, setRevision] = useState(0);
    const [appearance, changeAppearance] = useState(
        () =>
            localStorage.getItem("ios-glass.appearance") ||
            boot.config?.appearance ||
            "system",
    );
    const [dark, setDark] = useState(false);
    const [dialog, setDialog] = useState<{
        title: string;
        content: ReactNode;
    } | null>(null);
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState(false);
    const running = useRef(false);
    const [search, setSearch] = useState("");
    const go = useCallback((path: string) => {
        location.hash = `/${path}`;
    }, []);
    const close = useCallback(() => setDialog(null), []);
    const logout = useCallback(() => {
        session.clear();
        setLogged(false);
        close();
        go("login");
    }, [close, go]);
    useEffect(() => {
        const hash = () => {
            const next = currentRoute();
            setRoute(next);
            if (next === "dashboard") setRevision((n) => n + 1);
            close();
            window.scrollTo({ top: 0 });
        };
        const expired = () => {
            logout();
            setToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        };
        const storage = (event: StorageEvent) => {
            if (event.key === "ios-glass.auth" && !session.get()) logout();
        };
        window.addEventListener("hashchange", hash);
        window.addEventListener("ios-glass:expired", expired);
        window.addEventListener("storage", storage);
        return () => {
            window.removeEventListener("hashchange", hash);
            window.removeEventListener("ios-glass:expired", expired);
            window.removeEventListener("storage", storage);
        };
    }, [close, logout]);
    useEffect(() => {
        const media = matchMedia("(prefers-color-scheme: dark)");
        const update = () => {
            const isDark =
                appearance === "dark" ||
                (appearance === "system" && media.matches);
            setDark(isDark);
            document.documentElement.dataset.appearance = isDark
                ? "dark"
                : "light";
            document
                .querySelector('meta[name="theme-color"]')
                ?.setAttribute("content", isDark ? "#0c1520" : "#eef5fc");
        };
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, [appearance]);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(""), 6000);
        return () => clearTimeout(timer);
    }, [toast]);
    const setAppearance = (value: string) => {
        localStorage.setItem("ios-glass.appearance", value);
        changeAppearance(value);
    };
    const run = async (action: () => Promise<unknown>, message?: string) => {
        if (running.current) return;
        running.current = true;
        setToast("");
        setBusy(true);
        try {
            await action();
            if (message) setToast(message);
        } catch (error) {
            setToast(
                error instanceof Error
                    ? error.message
                    : "Không thể thực hiện yêu cầu.",
            );
        } finally {
            running.current = false;
            setBusy(false);
        }
    };
    const authPage = !logged || /^(login|register|forget)(\?|$)/.test(route);
    return (
        <>
            {authPage ? (
                <Auth
                    page={route}
                    onLogin={() => {
                        setLogged(true);
                        setRevision((n) => n + 1);
                        go("dashboard");
                    }}
                    notify={setToast}
                />
            ) : (
                <Authenticated
                    route={route}
                    revision={revision}
                    dialog={dialog}
                    toast={toast}
                    value={{
                        revision,
                        refresh: () => setRevision((n) => n + 1),
                        go,
                        modal: (title, content) => {
                            setToast("");
                            setDialog({ title, content });
                        },
                        close,
                        busy,
                        run,
                        notify: setToast,
                        appearance,
                        setAppearance,
                        logout,
                    }}
                >
                    <aside className="sidebar">
                        <Logo />
                        <nav aria-label="Điều hướng chính">
                            {links.map(({ path, label, icon: Icon }) => (
                                <a
                                    key={path}
                                    href={`#/${path}`}
                                    className={
                                        route.split(/[/?]/)[0] === path ||
                                        (path === "profile" &&
                                            [
                                                "sync",
                                                "traffic",
                                                "servers",
                                                "invite",
                                            ].includes(route))
                                            ? "active"
                                            : ""
                                    }
                                >
                                    <Icon />
                                    <span>{label}</span>
                                </a>
                            ))}
                        </nav>
                        <div className="sidebar-bottom">
                            <div className="world-card">
                                <Gem />
                                <strong>Kết nối thế giới</strong>
                                <p>An toàn hơn mỗi ngày</p>
                                <small>
                                    {brand} · Kết nối cho cuộc sống số
                                    <br />
                                    bảo mật và tự do hơn.
                                </small>
                            </div>
                            <button
                                className="appearance-toggle"
                                onClick={() =>
                                    setAppearance(dark ? "light" : "dark")
                                }
                            >
                                {dark ? <Sun size={17} /> : <Moon size={17} />}
                                {dark ? "Giao diện sáng" : "Giao diện tối"}
                            </button>
                        </div>
                    </aside>
                    <header className="topbar">
                        <div className="mobile-logo">
                            <Logo />
                        </div>
                        <form
                            className="search"
                            onSubmit={(e) => {
                                e.preventDefault();
                                go(
                                    `knowledge?keyword=${encodeURIComponent(search)}`,
                                );
                            }}
                        >
                            <Search size={21} />
                            <input
                                aria-label="Tìm kiếm hướng dẫn"
                                placeholder="Tìm kiếm thông tin, gói dịch vụ, bài viết…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </form>
                        <div className="header-actions">
                            <button
                                className="icon-button notification-button"
                                onClick={() => go("notices")}
                                aria-label="Thông báo"
                            >
                                <Bell />
                            </button>
                            <button
                                className="header-user"
                                onClick={() => go("profile")}
                            >
                                <span className="avatar">N</span>
                                <span>Tài khoản của tôi</span>
                                <ChevronDown size={17} />
                            </button>
                        </div>
                    </header>
                    <nav
                        className="bottom-nav"
                        aria-label="Điều hướng điện thoại"
                    >
                        {links
                            .filter((x) => x.path !== "orders")
                            .map(({ path, short, icon: Icon }) => (
                                <a
                                    key={path}
                                    href={`#/${path}`}
                                    className={
                                        route.startsWith(path) ||
                                        (path === "profile" &&
                                            [
                                                "sync",
                                                "traffic",
                                                "servers",
                                            ].includes(route))
                                            ? "active"
                                            : ""
                                    }
                                >
                                    <Icon />
                                    <span>{short}</span>
                                </a>
                            ))}
                    </nav>
                </Authenticated>
            )}
            {toast && !dialog && (
                <div
                    className="toast"
                    role="status"
                    onClick={() => setToast("")}
                >
                    {toast}
                </div>
            )}
        </>
    );
}
function Authenticated({
    route,
    revision,
    value,
    children,
    dialog,
    toast,
}: {
    route: string;
    revision: number;
    value: Omit<import("./ui").AppContextValue, "info" | "sub" | "config">;
    children: ReactNode;
    dialog: { title: string; content: ReactNode } | null;
    toast: string;
}) {
    const info = useResource("user/info", revision);
    const sub = useResource("user/getSubscribe", revision);
    const config = useResource("user/comm/config", revision);
    let page: ReactNode;
    const path = route.split("?")[0];
    const query = new URLSearchParams(route.split("?")[1]);
    switch (path) {
        case "dashboard":
            page = <Dashboard />;
            break;
        case "sync":
            page = <Sync />;
            break;
        case "plans":
            page = <Plans renew={query.get("renew")} />;
            break;
        case "orders":
            page = <Orders />;
            break;
        case "order":
            page = <OrderDetail trade={query.get("trade_no") || ""} />;
            break;
        case "support":
            page = <Support />;
            break;
        case "ticket":
            page = <TicketDetail id={query.get("id") || ""} />;
            break;
        case "notices":
            page = <Notices />;
            break;
        case "knowledge":
            page = (
                <Knowledge
                    keyword={query.get("keyword") || ""}
                    id={query.get("id")}
                />
            );
            break;
        case "traffic":
            page = <Traffic />;
            break;
        case "servers":
            page = <Servers />;
            break;
        default:
            page = <Profile />;
    }
    return (
        <AppContext.Provider
            value={{
                ...value,
                info: info.data || {},
                sub: sub.data || {},
                config: config.data || {},
            }}
        >
            <div className={`app-shell route-${path}`}>
                {children}
                <main className="main">
                    <Resource state={info}>
                        <Resource state={sub}>
                            <Resource state={config}>{page}</Resource>
                        </Resource>
                    </Resource>
                </main>
            </div>
            {dialog && (
                <Modal title={dialog.title} close={value.close} message={toast}>
                    {dialog.content}
                </Modal>
            )}
        </AppContext.Provider>
    );
}
