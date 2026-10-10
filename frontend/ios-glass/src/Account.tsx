import { useState } from "react";
import {
    Bell,
    ChevronRight,
    Gift,
    Globe2,
    Headphones,
    KeyRound,
    LogOut,
    Moon,
    ReceiptText,
    Server,
    ShieldCheck,
    UserRound,
    Wallet,
    UsersRound,
    Monitor,
    ArrowRight,
    Copy,
} from "lucide-react";
import { api, session } from "./api";
import {
    Badge,
    Card,
    copy,
    Empty,
    MenuRow,
    PageTitle,
    Resource,
    useApp,
    useResource,
} from "./ui";
import { date, money, type Row } from "./domain";

export function Profile() {
    const { info, sub, modal, go, appearance, logout } = useApp();
    return (
        <div className="profile-page">
            <PageTitle title="Tài khoản" />
            <Card className="profile-hero">
                <div className="profile-avatar">
                    <UserRound size={37} />
                </div>
                <h2>{info.email}</h2>
                <Badge tone={info.banned ? "red" : "green"}>
                    {info.banned ? "Đã bị khóa" : "Đang hoạt động"}
                </Badge>
            </Card>
            <Card className="menu-card">
                <MenuRow
                    icon={<UserRound />}
                    onClick={() =>
                        modal(
                            "Thông tin tài khoản",
                            <dl className="details">
                                <div>
                                    <dt>Email</dt>
                                    <dd>{info.email}</dd>
                                </div>
                                <div>
                                    <dt>Ngày đăng ký</dt>
                                    <dd>{date(info.created_at)}</dd>
                                </div>
                                <div>
                                    <dt>Gói đang dùng</dt>
                                    <dd>
                                        {sub.plan?.name ||
                                            "Theo hạn mức được cấp"}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Thiết bị trực tuyến</dt>
                                    <dd>
                                        {sub.alive_ip || 0}
                                        {sub.device_limit
                                            ? ` / ${sub.device_limit}`
                                            : ""}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Ngày đặt lại lưu lượng</dt>
                                    <dd>
                                        {sub.reset_day == null
                                            ? "Không áp dụng"
                                            : `Sau ${sub.reset_day} ngày`}
                                    </dd>
                                </div>
                            </dl>,
                        )
                    }
                >
                    Thông tin tài khoản
                </MenuRow>
                <MenuRow
                    icon={<KeyRound />}
                    onClick={() => modal("Đổi mật khẩu", <Password />)}
                >
                    Đổi mật khẩu
                </MenuRow>
                <MenuRow
                    icon={<ShieldCheck />}
                    onClick={() =>
                        modal("Đặt lại URL đồng bộ", <ResetSubscription />)
                    }
                >
                    Đặt lại URL đồng bộ
                </MenuRow>
                <MenuRow
                    icon={<Bell />}
                    onClick={() => modal("Thông báo", <NotificationSettings />)}
                >
                    Thông báo
                </MenuRow>
                <MenuRow
                    icon={<Globe2 />}
                    value="Tiếng Việt"
                    onClick={() =>
                        modal(
                            "Ngôn ngữ",
                            <p>
                                Theme hiện sử dụng tiếng Việt cho toàn bộ giao
                                diện khách hàng.
                            </p>,
                        )
                    }
                >
                    Ngôn ngữ
                </MenuRow>
                <MenuRow
                    icon={<Moon />}
                    value={
                        { system: "Theo thiết bị", light: "Sáng", dark: "Tối" }[
                            appearance
                        ]
                    }
                    onClick={() => modal("Giao diện", <Appearance />)}
                >
                    Giao diện
                </MenuRow>
            </Card>
            <Card className="menu-card">
                <MenuRow icon={<ReceiptText />} onClick={() => go("orders")}>
                    Đơn hàng
                </MenuRow>
                <MenuRow icon={<Headphones />} onClick={() => go("support")}>
                    Hỗ trợ
                </MenuRow>
            </Card>
            <section
                className="account-extras"
                aria-labelledby="account-extras-title"
            >
                <h2 id="account-extras-title">Tiện ích tài khoản</h2>
                <Card className="menu-card">
                    <MenuRow
                        icon={<Wallet />}
                        value={money(info.balance, useApp().config.currency)}
                        onClick={() => modal("Ví tài khoản", <WalletForm />)}
                    >
                        Số dư tài khoản
                    </MenuRow>
                    <MenuRow
                        icon={<Gift />}
                        onClick={() => modal("Đổi thẻ quà tặng", <GiftForm />)}
                    >
                        Thẻ quà tặng
                    </MenuRow>
                    <MenuRow
                        icon={<UsersRound />}
                        onClick={() => modal("Mời bạn bè", <Invites />)}
                    >
                        Mời bạn bè
                    </MenuRow>
                    <MenuRow icon={<Server />} onClick={() => go("servers")}>
                        Máy chủ
                    </MenuRow>
                    <MenuRow
                        icon={<Monitor />}
                        onClick={() => modal("Phiên đăng nhập", <Sessions />)}
                    >
                        Phiên đăng nhập
                    </MenuRow>
                </Card>
            </section>
            <Card className="menu-card logout-card">
                <MenuRow danger icon={<LogOut />} onClick={logout}>
                    Đăng xuất
                </MenuRow>
            </Card>
        </div>
    );
}
function Password() {
    const { run, busy, logout } = useApp();
    const [old, setOld] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    return (
        <form
            className="form-stack"
            onSubmit={(e) => {
                e.preventDefault();
                if (password !== confirm) {
                    e.currentTarget
                        .querySelector<HTMLInputElement>('[name="confirm"]')
                        ?.setCustomValidity("Mật khẩu xác nhận chưa khớp.");
                    e.currentTarget.reportValidity();
                    return;
                }
                run(async () => {
                    await api("user/changePassword", {
                        old_password: old,
                        new_password: password,
                    });
                    logout();
                }, "Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
            }}
        >
            <label>
                Mật khẩu hiện tại
                <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={old}
                    onChange={(e) => setOld(e.target.value)}
                />
            </label>
            <label>
                Mật khẩu mới
                <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </label>
            <label>
                Xác nhận mật khẩu mới
                <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirm}
                    onChange={(e) => {
                        e.target.setCustomValidity("");
                        setConfirm(e.target.value);
                    }}
                />
            </label>
            <p className="muted">
                Đổi mật khẩu sẽ kết thúc các phiên đăng nhập hiện tại.
            </p>
            <button className="button primary" disabled={busy}>
                Lưu mật khẩu
            </button>
        </form>
    );
}
function NotificationSettings() {
    const { info, run, busy, close, refresh } = useApp();
    const [expire, setExpire] = useState(!!info.remind_expire);
    const [traffic, setTraffic] = useState(!!info.remind_traffic);
    return (
        <form
            className="form-stack"
            onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                    await api("user/update", {
                        remind_expire: Number(expire),
                        remind_traffic: Number(traffic),
                    });
                    refresh();
                    close();
                }, "Đã lưu cài đặt thông báo.");
            }}
        >
            <label className="switch-row">
                Nhắc khi sắp hết hạn
                <input
                    role="switch"
                    type="checkbox"
                    checked={expire}
                    onChange={(e) => setExpire(e.target.checked)}
                />
            </label>
            <label className="switch-row">
                Nhắc khi sắp hết lưu lượng
                <input
                    role="switch"
                    type="checkbox"
                    checked={traffic}
                    onChange={(e) => setTraffic(e.target.checked)}
                />
            </label>
            <button className="button primary" disabled={busy}>
                Lưu cài đặt
            </button>
        </form>
    );
}
function Appearance() {
    const { appearance, setAppearance } = useApp();
    return (
        <fieldset className="appearance-options">
            <legend className="sr-only">Chọn giao diện</legend>
            {[
                { id: "system", label: "Theo thiết bị", icon: Monitor },
                { id: "light", label: "Sáng", icon: Globe2 },
                { id: "dark", label: "Tối", icon: Moon },
            ].map(({ id, label, icon: Icon }) => (
                <label key={id} className={appearance === id ? "selected" : ""}>
                    <Icon />
                    <span>{label}</span>
                    <input
                        name="appearance"
                        type="radio"
                        checked={appearance === id}
                        onChange={() => setAppearance(id)}
                    />
                </label>
            ))}
        </fieldset>
    );
}
function GiftForm() {
    const { run, busy, refresh, close } = useApp();
    const [code, setCode] = useState("");
    return (
        <form
            className="form-stack"
            onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                    await api("user/redeemgiftcard", { giftcard: code.trim() });
                    refresh();
                    close();
                }, "Đã sử dụng thẻ quà tặng.");
            }}
        >
            <label>
                Mã thẻ
                <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                />
            </label>
            <button className="button primary" disabled={busy || !code.trim()}>
                Sử dụng thẻ
            </button>
        </form>
    );
}
function WalletForm() {
    const { info, config, run, busy, close, go, refresh } = useApp();
    const [amount, setAmount] = useState("");
    return (
        <form
            className="form-stack"
            onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                    const result = await api<string>("user/order/save", {
                        plan_id: 0,
                        period: "deposit",
                        deposit_amount: Math.round(Number(amount) * 100),
                    });
                    close();
                    go(`order?trade_no=${encodeURIComponent(result.data)}`);
                });
            }}
        >
            <div className="wallet-balance">
                <small>Số dư hiện có</small>
                <h2>{money(info.balance, config.currency)}</h2>
            </div>
            <label>
                Số tiền nạp ({config.currency})
                <input
                    type="number"
                    min="0.01"
                    max="99999.98"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </label>
            <button className="button primary" disabled={busy}>
                Tạo đơn nạp số dư
            </button>
            {Number(info.commission_balance) > 0 && (
                <>
                    <hr />
                    <p>
                        Hoa hồng có thể chuyển:{" "}
                        {money(info.commission_balance, config.currency)}
                    </p>
                    <button
                        className="button secondary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            run(async () => {
                                await api("user/transfer", {
                                    transfer_amount: Number(
                                        info.commission_balance,
                                    ),
                                });
                                refresh();
                                close();
                            }, "Đã chuyển hoa hồng vào số dư.")
                        }
                    >
                        Chuyển toàn bộ vào số dư
                    </button>
                </>
            )}
        </form>
    );
}
function ResetSubscription() {
    const { run, busy, refresh, close } = useApp();
    return (
        <>
            <p>
                URL đồng bộ và UUID cũ sẽ mất hiệu lực. Sau khi đặt lại, bạn cần
                đồng bộ cấu hình mới trên các thiết bị.
            </p>
            <button
                className="button danger-solid"
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        await api("user/resetSecurity");
                        refresh();
                        close();
                    }, "Đã đặt lại URL. Hãy đồng bộ lại ứng dụng.")
                }
            >
                Xác nhận đặt lại
            </button>
        </>
    );
}
function Sessions() {
    const { run, busy, logout } = useApp();
    const [revision, setRevision] = useState(0);
    const resource = useResource<Record<string, Row>>(
        "user/getActiveSession",
        revision,
    );
    return (
        <Resource state={resource}>
            {Object.entries(resource.data || {}).map(([id, entry]) => (
                <div className="session-row" key={id}>
                    <strong>{entry.ip}</strong>
                    <small>{entry.ua}</small>
                    <small>
                        {date(entry.login_at)}{" "}
                        {entry.auth_data === session.get()
                            ? "· Phiên hiện tại"
                            : ""}
                    </small>
                    <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                            run(async () => {
                                await api("user/removeActiveSession", {
                                    session_id: id,
                                });
                                if (entry.auth_data === session.get()) logout();
                                else setRevision((n) => n + 1);
                            }, "Đã kết thúc phiên đăng nhập.")
                        }
                    >
                        Kết thúc phiên
                    </button>
                </div>
            ))}
        </Resource>
    );
}
function Invites() {
    const { run, busy, config } = useApp();
    const [revision, setRevision] = useState(0);
    const resource = useResource<Row>("user/invite/fetch", revision);
    return (
        <Resource state={resource}>
            <div className="invite-stats">
                <p>
                    Đã giới thiệu:{" "}
                    <strong>{resource.data?.stat?.[0] || 0} người</strong>
                </p>
                <p>
                    Hoa hồng: <strong>{resource.data?.stat?.[3] || 0}%</strong>
                </p>
                <p>
                    Hoa hồng có thể dùng:{" "}
                    <strong>
                        {money(resource.data?.stat?.[4], config.currency)}
                    </strong>
                </p>
            </div>
            {resource.data?.codes?.map((item: Row) => (
                <div key={item.id} className="invite-code">
                    <code>{item.code}</code>
                    <button
                        className="icon-button"
                        aria-label="Sao chép liên kết mời"
                        onClick={() =>
                            run(
                                () =>
                                    copy(
                                        `${location.origin}/#/register?invite_code=${encodeURIComponent(item.code)}`,
                                    ),
                                "Đã sao chép liên kết mời.",
                            )
                        }
                    >
                        <Copy size={18} />
                    </button>
                </div>
            ))}
            <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        await api("user/invite/save");
                        setRevision((n) => n + 1);
                    })
                }
            >
                Tạo mã mời
            </button>
        </Resource>
    );
}
export function Support() {
    const { go, modal, revision } = useApp();
    const resource = useResource<Row[]>("user/ticket/fetch", revision);
    return (
        <>
            <PageTitle
                title="Hỗ trợ"
                subtitle="Chúng tôi luôn sẵn sàng giúp bạn."
            />
            <div className="support-heading">
                <button
                    className="button primary"
                    onClick={() => modal("Gửi yêu cầu hỗ trợ", <NewTicket />)}
                >
                    <Headphones size={18} />
                    Tạo yêu cầu
                </button>
                <button
                    className="button secondary"
                    onClick={() => go("knowledge")}
                >
                    Xem hướng dẫn <ArrowRight size={18} />
                </button>
            </div>
            <Card>
                <Resource state={resource}>
                    {resource.data?.map((ticket) => (
                        <button
                            className="order-row"
                            key={ticket.id}
                            onClick={() => go(`ticket?id=${ticket.id}`)}
                        >
                            <span className="order-icon">
                                <Headphones />
                            </span>
                            <span>
                                <strong>{ticket.subject}</strong>
                                <small>
                                    {date(ticket.created_at)} ·{" "}
                                    {
                                        ["Thấp", "Trung bình", "Cao"][
                                            ticket.level
                                        ]
                                    }
                                </small>
                            </span>
                            <Badge tone={ticket.status ? "muted" : "blue"}>
                                {ticket.status ? "Đã đóng" : "Đang mở"}
                            </Badge>
                            <ChevronRight size={18} />
                        </button>
                    ))}
                    {!resource.data?.length && (
                        <Empty>Bạn chưa có yêu cầu hỗ trợ nào.</Empty>
                    )}
                </Resource>
            </Card>
        </>
    );
}
function NewTicket() {
    const { run, busy, refresh, close } = useApp();
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [level, setLevel] = useState("1");
    return (
        <form
            className="form-stack"
            onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                    await api("user/ticket/save", {
                        subject: subject.trim(),
                        message: message.trim(),
                        level: Number(level),
                    });
                    refresh();
                    close();
                }, "Đã gửi yêu cầu hỗ trợ.");
            }}
        >
            <label>
                Tiêu đề
                <input
                    required
                    maxLength={255}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                />
            </label>
            <label>
                Mức ưu tiên
                <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                >
                    <option value="0">Thấp</option>
                    <option value="1">Trung bình</option>
                    <option value="2">Cao</option>
                </select>
            </label>
            <label>
                Nội dung
                <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
            </label>
            <button
                className="button primary"
                disabled={busy || !subject.trim() || !message.trim()}
            >
                Gửi yêu cầu
            </button>
        </form>
    );
}
export function TicketDetail({ id }: { id: string }) {
    const { run, busy, modal, close } = useApp();
    const [revision, setRevision] = useState(0);
    const resource = useResource<Row>(
        `user/ticket/fetch?id=${encodeURIComponent(id)}`,
        revision,
    );
    const [message, setMessage] = useState("");
    return (
        <>
            <PageTitle
                title={resource.data?.subject || "Yêu cầu hỗ trợ"}
                back="support"
            />
            <Resource state={resource}>
                <Card>
                    <div className="ticket-header">
                        <Badge tone={resource.data?.status ? "muted" : "blue"}>
                            {resource.data?.status ? "Đã đóng" : "Đang mở"}
                        </Badge>
                        {!resource.data?.status && (
                            <button
                                className="button secondary"
                                disabled={busy}
                                onClick={() =>
                                    modal(
                                        "Đóng yêu cầu?",
                                        <>
                                            <p>
                                                Bạn sẽ không thể trả lời thêm
                                                trong yêu cầu này.
                                            </p>
                                            <button
                                                className="button primary"
                                                disabled={busy}
                                                onClick={() =>
                                                    run(async () => {
                                                        await api(
                                                            "user/ticket/close",
                                                            { id },
                                                        );
                                                        close();
                                                        setRevision(
                                                            (n) => n + 1,
                                                        );
                                                    })
                                                }
                                            >
                                                Xác nhận đóng
                                            </button>
                                        </>,
                                    )
                                }
                            >
                                Đóng yêu cầu
                            </button>
                        )}
                    </div>
                    <div className="messages">
                        {resource.data?.message?.map((item: Row) => (
                            <div
                                className={`message ${item.is_me ? "mine" : ""}`}
                                key={item.id}
                            >
                                <small>
                                    {item.is_me ? "Bạn" : "Hỗ trợ"} ·{" "}
                                    {date(item.created_at)}
                                </small>
                                <p>{item.message}</p>
                            </div>
                        ))}
                    </div>
                    {!resource.data?.status && (
                        <form
                            className="form-stack"
                            onSubmit={(e) => {
                                e.preventDefault();
                                run(async () => {
                                    await api("user/ticket/reply", {
                                        id,
                                        message: message.trim(),
                                    });
                                    setMessage("");
                                    setRevision((n) => n + 1);
                                });
                            }}
                        >
                            <label>
                                Trả lời
                                <textarea
                                    required
                                    rows={3}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </label>
                            <button
                                className="button primary"
                                disabled={busy || !message.trim()}
                            >
                                Gửi trả lời
                            </button>
                        </form>
                    )}
                </Card>
            </Resource>
        </>
    );
}
