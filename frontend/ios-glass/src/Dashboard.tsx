import { useEffect, useId, useState } from "react";
import {
    ArrowRight,
    BarChart3,
    BookOpen,
    CalendarDays,
    Check,
    ChevronRight,
    Copy,
    Download,
    ExternalLink,
    Layers3,
    RefreshCw,
    TrendingUp,
    UserRound,
} from "lucide-react";
import QRCode from "qrcode";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
    Badge,
    Card,
    copy,
    Empty,
    PageTitle,
    Resource,
    useApp,
    useResource,
} from "./ui";
import { brand } from "./App";
import { clientIcons } from "./client-icons";
import {
    detectSyncPlatform,
    getSyncClient,
    syncClients,
    syncPlatforms,
} from "./clients";
import {
    clientSubscriptionUrl,
    date,
    gb,
    GIB,
    httpUrl,
    importUrl,
    number,
    subscriptionState,
    trafficWeek,
    usage,
    type Row,
} from "./domain";

export function RichText({ value = "" }: { value?: string }) {
    return (
        <div
            className="rich-text"
            dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                    marked.parse(value, { async: false }),
                    {
                        ADD_ATTR: ["target"],
                        FORBID_TAGS: ["style", "iframe", "form"],
                        FORBID_ATTR: ["style"],
                    },
                ),
            }}
        />
    );
}
function Ring({ sub }: { sub: Row }) {
    const { percent } = usage(sub);
    const id = useId().replace(/:/g, "");
    return (
        <div className="ring">
            <svg
                viewBox="0 0 200 200"
                role="img"
                aria-label={`${number(percent)}% lưu lượng đã dùng`}
            >
                <defs>
                    <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
                        <stop stopColor="#3dc7ff" />
                        <stop offset="1" stopColor="#087aff" />
                    </linearGradient>
                </defs>
                <circle className="ring-track" cx="100" cy="100" r="80" />
                <circle
                    cx="100"
                    cy="100"
                    r="80"
                    stroke={`url(#${id})`}
                    className="ring-value"
                    strokeDasharray={`${(percent / 100) * 502.65} 502.65`}
                    transform="rotate(-90 100 100)"
                />
            </svg>
            <div>
                <strong>{number(percent)}%</strong>
                <small>đã sử dụng</small>
            </div>
        </div>
    );
}
function Chart({ logs }: { logs: Row[] }) {
    const days = trafficWeek(logs);
    const maximum = Math.max(1, ...days.map((d) => d.value));
    const ceiling = Math.max(1, Math.ceil(maximum / 3) * 3);
    const points = days.map((d, i) => [
        52 + i * 53,
        130 - (d.value / ceiling) * 104,
    ]);
    const line = points
        .map((p, i) =>
            i === 0
                ? `M${p[0]},${p[1]}`
                : `C${points[i - 1][0] + 27},${points[i - 1][1]} ${p[0] - 27},${p[1]} ${p[0]},${p[1]}`,
        )
        .join(" ");
    const id = useId().replace(/:/g, "");
    return (
        <svg
            className="traffic-chart"
            viewBox="0 0 390 167"
            role="img"
            aria-label="Biểu đồ lưu lượng 7 ngày gần đây"
        >
            <defs>
                <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#138bff" stopOpacity=".3" />
                    <stop offset="1" stopColor="#138bff" stopOpacity=".02" />
                </linearGradient>
            </defs>
            {[0, 1, 2].map((i) => (
                <g key={i}>
                    <line
                        className="chart-grid"
                        x1="52"
                        x2="370"
                        y1={26 + i * 52}
                        y2={26 + i * 52}
                    />
                    <text x="4" y={30 + i * 52}>
                        {number((ceiling * (2 - i)) / 2)} GB
                    </text>
                </g>
            ))}
            {points.map((p, i) => (
                <g key={i}>
                    <line
                        className="chart-grid vertical"
                        x1={p[0]}
                        x2={p[0]}
                        y1="26"
                        y2="130"
                    />
                    <text x={p[0]} y="157" textAnchor="middle">
                        {days[i].label}
                    </text>
                </g>
            ))}
            <path d={`${line} L370,130 L52,130 Z`} fill={`url(#${id})`} />
            <path d={line} fill="none" stroke="#1685ff" strokeWidth="2.2" />
            {points.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="3.3" fill="#1888ff">
                    <title>
                        {days[i].label}: {number(days[i].value)} GB
                    </title>
                </circle>
            ))}
        </svg>
    );
}
export function Dashboard() {
    const { sub, go, revision } = useApp();
    const log = useResource<Row[]>("user/stat/getTrafficLog", revision);
    const status = subscriptionState(sub);
    const data = usage(sub);
    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? "Chào buổi sáng"
            : hour < 18
              ? "Chào buổi chiều"
              : "Chào buổi tối";
    const planName =
        sub.plan?.name ||
        sub.staff_plan?.name ||
        (data.total > 0 ? `Gói ${gb(data.total)}` : "Chưa có gói dịch vụ");
    const mobileDarkSummary = (
        <div className="mobile-dark-summary">
            <div className="mobile-dark-ring">
                <Ring sub={sub} />
            </div>
            <div className="mobile-dark-metrics">
                {[
                    { name: "Đã dùng", value: data.used },
                    { name: "Tổng", value: data.total },
                    { name: "Còn lại", value: data.remaining },
                ].map((x) => (
                    <div key={x.name}>
                        <small>
                            <i />
                            {x.name}
                        </small>
                        <strong>{gb(x.value)}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
    return (
        <div className="dashboard">
            <div className="greeting">
                <h1>
                    {greeting} <span>👋</span>
                </h1>
                <p>
                    {window.iosGlass?.config?.welcome_text ||
                        "Chúc bạn một ngày làm việc hiệu quả"}{" "}
                    cùng {brand}.
                </p>
            </div>
            <div className="overview-heading">
                <h2>Tổng quan tài khoản</h2>
                <span>
                    {new Date().toLocaleDateString("vi-VN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    })}
                </span>
            </div>
            <div className="summary-grid">
                <Card className="subscription-card">
                    <div className="card-heading">
                        <Layers3 />
                        <span>Gói đang sử dụng</span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <h2 className="plan-name">{planName}</h2>
                    <div className="mobile-dark-badge">
                        <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="expiry">
                        <CalendarDays size={19} />
                        Hết hạn: {date(sub.expired_at)}
                    </p>
                    {mobileDarkSummary}
                    <div className="glass-stack" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </div>
                    <div className="plan-actions">
                        <button
                            className="button secondary"
                            disabled={!httpUrl(sub.subscribe_url || "")}
                            onClick={() => go("sync")}
                        >
                            <Download size={20} />
                            Đồng bộ ứng dụng
                        </button>
                        <button
                            className="button primary"
                            onClick={() =>
                                go(
                                    sub.plan_id
                                        ? `plans?renew=${sub.plan_id}`
                                        : "plans",
                                )
                            }
                        >
                            <RefreshCw size={20} />
                            {sub.plan_id ? "Gia hạn" : "Xem gói dịch vụ"}
                        </button>
                    </div>
                </Card>
                <Card className="usage-card">
                    <button
                        className="card-heading card-link"
                        onClick={() => go("traffic")}
                    >
                        <BarChart3 />
                        <strong>Lưu lượng sử dụng</strong>
                        <ChevronRight size={19} />
                    </button>
                    <div className="usage-content">
                        <Ring sub={sub} />
                        <div className="usage-legend">
                            {[
                                {
                                    name: "Đã dùng",
                                    value: data.used,
                                    color: "blue",
                                },
                                {
                                    name: "Tổng",
                                    value: data.total,
                                    color: "gray",
                                },
                                {
                                    name: "Còn lại",
                                    value: data.remaining,
                                    color: "pale",
                                },
                            ].map((x) => (
                                <div key={x.name}>
                                    <i className={x.color} />
                                    <span>
                                        <small>{x.name}</small>
                                        <strong>{gb(x.value)}</strong>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
            <div className="detail-grid">
                <Card className="weekly-card">
                    <button
                        className="card-heading card-link"
                        onClick={() => go("traffic")}
                    >
                        <TrendingUp />
                        <strong>Lưu lượng tuần này</strong>
                        <small>
                            {log.data
                                ? `${number(trafficWeek(log.data).reduce((sum, d) => sum + d.value, 0))} GB`
                                : ""}
                        </small>
                        <ChevronRight size={18} />
                    </button>
                    <Resource state={log}>
                        <Chart logs={log.data || []} />
                    </Resource>
                </Card>
                <Card className="guide-card">
                    <button
                        className="card-heading card-link"
                        onClick={() => go("knowledge")}
                    >
                        <BookOpen />
                        <strong>Hướng dẫn sử dụng</strong>
                        <ChevronRight size={19} />
                    </button>
                    <h3>Bắt đầu trong 3 bước</h3>
                    <p>
                        Cài đặt ứng dụng, đồng bộ cấu hình và bắt đầu trải
                        nghiệm {brand} chỉ trong vài phút.
                    </p>
                    <div className="guide-illustration" aria-hidden="true">
                        <i />
                        <i />
                        <i>
                            <span />
                            <span />
                            <span />
                        </i>
                    </div>
                    <div className="guide-steps">
                        {[Download, UserRound, Check].map((Icon, i) => (
                            <div key={i}>
                                <Icon />
                                <small>
                                    {
                                        [
                                            "1. Tải ứng dụng",
                                            "2. Đồng bộ",
                                            "3. Bắt đầu sử dụng",
                                        ][i]
                                    }
                                </small>
                            </div>
                        ))}
                    </div>
                    <button
                        className="button secondary guide-button"
                        onClick={() => go("knowledge")}
                    >
                        Xem hướng dẫn <ArrowRight size={18} />
                    </button>
                </Card>
            </div>
        </div>
    );
}
export function Sync() {
    const { sub, go, run, notify } = useApp();
    const [platform] = useState(() =>
        detectSyncPlatform(navigator.userAgent, navigator.maxTouchPoints),
    );
    const [client, setClient] = useState("hiddify");
    const [qr, setQr] = useState("");
    const url = httpUrl(sub.subscribe_url || "");
    const selectedClient = getSyncClient(client);
    const clientUrl =
        url && platform ? clientSubscriptionUrl(client, url) : url;
    const appUrl =
        url && platform
            ? importUrl(client, url, sub.profile_name || brand)
            : null;
    const platformName = syncPlatforms.find(
        (item) => item.id === platform,
    )?.name;
    useEffect(() => {
        let active = true;
        setQr("");
        if (clientUrl)
            QRCode.toDataURL(clientUrl, {
                width: 256,
                margin: 2,
                color: { dark: "#16304b", light: "#ffffff" },
            })
                .then((value) => {
                    if (active) setQr(value);
                })
                .catch(() =>
                    notify("Không thể tạo mã QR. Hãy dùng nút sao chép URL."),
                );
        return () => {
            active = false;
        };
    }, [clientUrl]);
    return (
        <>
            <PageTitle title="Đồng bộ ứng dụng" back="dashboard" />
            <div className="sync-layout">
                <Card className="sync-card">
                    <h2>Nhập cấu hình vào ứng dụng</h2>
                    <p>
                        {platformName
                            ? `Thiết bị: ${platformName}. Chọn ứng dụng bạn đang sử dụng.`
                            : "Chưa nhận diện được thiết bị. Bạn có thể sao chép URL hoặc quét mã QR để nhập thủ công."}
                    </p>
                    {platform && (
                        <fieldset className="client-options">
                            <legend className="sr-only">Ứng dụng</legend>
                            {syncClients
                                .filter((item) =>
                                    item.platforms.includes(platform),
                                )
                                .map(({ id, name }) => (
                                    <label
                                        key={id}
                                        className={`client-option ${client === id ? "selected" : ""}`}
                                    >
                                        <span className={`client-icon ${id}`}>
                                            <img
                                                src={clientIcons[id]}
                                                alt=""
                                                width={43}
                                                height={43}
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        </span>
                                        <strong>{name}</strong>
                                        <input
                                            type="radio"
                                            name="client"
                                            value={id}
                                            checked={client === id}
                                            onChange={() => setClient(id)}
                                        />
                                        <ChevronRight size={17} />
                                    </label>
                                ))}
                        </fieldset>
                    )}
                    {url ? (
                        <>
                            {appUrl ? (
                                <a className="button primary" href={appUrl}>
                                    Mở trong {selectedClient.name}{" "}
                                    <ExternalLink size={17} />
                                </a>
                            ) : platform && selectedClient.id === "nekoray" ? (
                                <p className="sync-hint">
                                    Nekoray: sao chép URL bên dưới, mở phần quản
                                    lý nhóm đăng ký trong ứng dụng, thêm nhóm và
                                    dán URL.
                                </p>
                            ) : null}
                            <button
                                className="button neutral"
                                onClick={() =>
                                    run(
                                        () => copy(clientUrl!),
                                        "Đã sao chép URL đồng bộ.",
                                    )
                                }
                            >
                                <Copy size={18} />
                                Sao chép URL
                            </button>
                            <small className="sync-hint">
                                {platform
                                    ? `URL và mã QR dùng định dạng dành cho ${selectedClient.name}. Cần cài đặt ứng dụng để đồng bộ.`
                                    : "Dán URL vào ứng dụng của bạn để thêm đăng ký."}
                            </small>
                        </>
                    ) : (
                        <Empty>
                            Chưa có URL đồng bộ. Vui lòng liên hệ hỗ trợ.
                        </Empty>
                    )}
                </Card>
                <Card className="qr-card">
                    <h2>
                        {platform ? `Mã QR · ${selectedClient.name}` : "Mã QR"}
                    </h2>
                    {qr ? (
                        <img
                            className="qr-image"
                            src={qr}
                            alt="Mã QR URL đồng bộ của bạn"
                        />
                    ) : (
                        <Empty>Không có mã QR</Empty>
                    )}
                    <p>Quét để nhập cấu hình</p>
                    <button
                        className="text-link"
                        onClick={() => go("knowledge")}
                    >
                        Cần trợ giúp? Xem hướng dẫn <ChevronRight size={19} />
                    </button>
                </Card>
            </div>
        </>
    );
}
export function Traffic() {
    const { sub, revision } = useApp();
    const log = useResource<Row[]>("user/stat/getTrafficLog", revision);
    const data = usage(sub);
    return (
        <>
            <PageTitle
                title="Lưu lượng sử dụng"
                subtitle="Dữ liệu tháng hiện tại, theo hệ số tính lưu lượng của máy chủ."
                back="dashboard"
            />
            <div className="metric-grid">
                {[
                    { label: "Đã dùng", value: gb(data.used) },
                    { label: "Tổng lưu lượng", value: gb(data.total) },
                    { label: "Còn lại", value: gb(data.remaining) },
                ].map((x) => (
                    <Card key={x.label}>
                        <small>{x.label}</small>
                        <h2>{x.value}</h2>
                    </Card>
                ))}
            </div>
            <Card>
                <Resource state={log}>
                    <Chart logs={log.data || []} />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ngày</th>
                                    <th>Tải lên</th>
                                    <th>Tải xuống</th>
                                    <th>Hệ số</th>
                                </tr>
                            </thead>
                            <tbody>
                                {log.data?.map((x, i) => (
                                    <tr key={i}>
                                        <td>{date(x.record_at)}</td>
                                        <td>{gb(Number(x.u))}</td>
                                        <td>{gb(Number(x.d))}</td>
                                        <td>×{x.server_rate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!log.data?.length && (
                        <Empty>
                            Chưa có lịch sử lưu lượng trong tháng này.
                        </Empty>
                    )}
                </Resource>
            </Card>
        </>
    );
}
export function Notices() {
    const { revision } = useApp();
    const [page, setPage] = useState(1);
    const resource = useResource<Row[]>(
        `user/notice/fetch?current=${page}&pageSize=10`,
        revision,
    );
    return (
        <>
            <PageTitle title="Thông báo" back="dashboard" />
            <Resource state={resource}>
                {resource.data?.map((x) => (
                    <Card key={x.id} className="notice-card">
                        <small>{date(x.created_at)}</small>
                        <h2>{x.title}</h2>
                        <RichText value={x.content} />
                    </Card>
                ))}
                {!resource.data?.length && (
                    <Card>
                        <Empty>Chưa có thông báo mới.</Empty>
                    </Card>
                )}
                <div className="pagination">
                    <button
                        className="button secondary"
                        disabled={page === 1}
                        onClick={() => setPage((n) => n - 1)}
                    >
                        Trang trước
                    </button>
                    <span>Trang {page}</span>
                    <button
                        className="button secondary"
                        disabled={(resource.data?.length || 0) < 10}
                        onClick={() => setPage((n) => n + 1)}
                    >
                        Trang sau
                    </button>
                </div>
            </Resource>
        </>
    );
}
export function Knowledge({
    keyword,
    id,
}: {
    keyword: string;
    id: string | null;
}) {
    const { go } = useApp();
    const resource = useResource(
        id
            ? `user/knowledge/fetch?id=${encodeURIComponent(id)}`
            : `user/knowledge/fetch?language=vi-VN&keyword=${encodeURIComponent(keyword)}`,
    );
    return (
        <>
            <PageTitle
                title={
                    id
                        ? resource.data?.title || "Hướng dẫn"
                        : "Hướng dẫn sử dụng"
                }
                subtitle={keyword ? `Kết quả cho “${keyword}”` : undefined}
                back={id ? "knowledge" : "dashboard"}
            />
            <Resource state={resource}>
                {id ? (
                    <Card>
                        <RichText value={resource.data?.body} />
                    </Card>
                ) : Object.keys(resource.data || {}).length ? (
                    Object.entries(resource.data || {}).map(
                        ([category, articles]) => (
                            <Card className="knowledge-category" key={category}>
                                <h2>{category}</h2>
                                {(articles as Row[]).map((x) => (
                                    <button
                                        className="menu-row"
                                        key={x.id}
                                        onClick={() =>
                                            go(`knowledge?id=${x.id}`)
                                        }
                                    >
                                        <BookOpen size={20} />
                                        <span>{x.title}</span>
                                        <ChevronRight size={18} />
                                    </button>
                                ))}
                            </Card>
                        ),
                    )
                ) : (
                    <Card>
                        <Empty>Chưa có bài hướng dẫn tiếng Việt phù hợp.</Empty>
                    </Card>
                )}
            </Resource>
        </>
    );
}
export function Servers() {
    const resource = useResource<Row[]>("user/server/fetch");
    return (
        <>
            <PageTitle
                title="Máy chủ"
                subtitle="Danh sách máy chủ được cấp cho tài khoản."
                back="profile"
            />
            <Card>
                <Resource state={resource}>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tên máy chủ</th>
                                    <th>Loại</th>
                                    <th>Hệ số lưu lượng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resource.data?.map((x, i) => (
                                    <tr key={i}>
                                        <td>{x.name}</td>
                                        <td>{x.type}</td>
                                        <td>×{x.rate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!resource.data?.length && (
                        <Empty>Chưa có máy chủ được cấp.</Empty>
                    )}
                </Resource>
            </Card>
        </>
    );
}
