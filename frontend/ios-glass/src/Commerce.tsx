import { useEffect, useState } from "react";
import {
    ArrowRight,
    Check,
    CreditCard,
    Layers3,
    ReceiptText,
    RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import { api } from "./api";
import {
    Badge,
    Card,
    Empty,
    PageTitle,
    Resource,
    useApp,
    useResource,
} from "./ui";
import {
    date,
    httpUrl,
    money,
    orderStatuses,
    periods,
    type Row,
} from "./domain";
import { RichText } from "./Dashboard";

export function Plans({ renew }: { renew: string | null }) {
    const { config, sub, go, modal } = useApp();
    const plans = useResource<Row[] | Row>(
        renew
            ? `user/plan/fetch?id=${encodeURIComponent(renew)}`
            : "user/plan/fetch",
    );
    const list: Row[] = plans.data
        ? Array.isArray(plans.data)
            ? plans.data
            : [plans.data]
        : [];
    return (
        <>
            <PageTitle
                title={renew ? "Gia hạn gói dịch vụ" : "Gói dịch vụ"}
                subtitle="Chọn gói phù hợp với nhu cầu của bạn."
                back={renew ? "dashboard" : undefined}
            />
            <Resource state={plans}>
                <div className="plans-grid">
                    {list.map((plan) => {
                        const options = Object.keys(periods).filter(
                            (key) =>
                                plan[key] !== null &&
                                plan[key] !== undefined &&
                                (key !== "reset_price" ||
                                    Number(sub.plan_id) === Number(plan.id)),
                        );
                        const available =
                            plan.capacity_limit == null ||
                            Number(plan.capacity_limit) > 0 ||
                            Number(sub.plan_id) === Number(plan.id);
                        return (
                            <Card className="product-card" key={plan.id}>
                                <div className="card-heading">
                                    <Layers3 />
                                    <Badge tone={available ? "green" : "muted"}>
                                        {available
                                            ? Number(sub.plan_id) ===
                                              Number(plan.id)
                                                ? "Đang sử dụng"
                                                : "Có sẵn"
                                            : "Hết chỗ"}
                                    </Badge>
                                </div>
                                <h2>{plan.name}</h2>
                                <p className="product-quota">
                                    {plan.transfer_enable} GB{" "}
                                    <small>/ chu kỳ</small>
                                </p>
                                <div className="product-price">
                                    {options.length
                                        ? money(
                                              Math.min(
                                                  ...options.map((key) =>
                                                      Number(plan[key]),
                                                  ),
                                              ),
                                              config.currency,
                                          )
                                        : "Chưa mở bán"}
                                    <small>Giá từ</small>
                                </div>
                                <RichText value={plan.content} />
                                <ul className="product-features">
                                    <li>
                                        <Check size={17} />
                                        {plan.speed_limit
                                            ? `Tốc độ tối đa ${plan.speed_limit} Mbps`
                                            : "Không giới hạn tốc độ"}
                                    </li>
                                    <li>
                                        <Check size={17} />
                                        {plan.device_limit
                                            ? `${plan.device_limit} thiết bị`
                                            : "Không giới hạn thiết bị"}
                                    </li>
                                </ul>
                                <button
                                    className="button primary"
                                    disabled={!options.length || !available}
                                    onClick={() =>
                                        modal(
                                            "Chọn chu kỳ",
                                            <Purchase
                                                plan={plan}
                                                options={options}
                                            />,
                                        )
                                    }
                                >
                                    Chọn gói <ArrowRight size={18} />
                                </button>
                            </Card>
                        );
                    })}
                </div>
                {!list.length && (
                    <Card>
                        <Empty>Chưa có gói dịch vụ được mở bán.</Empty>
                        <button
                            className="button secondary"
                            onClick={() => go("support")}
                        >
                            Liên hệ hỗ trợ
                        </button>
                    </Card>
                )}
            </Resource>
        </>
    );
}
function Purchase({ plan, options }: { plan: Row; options: string[] }) {
    const { config, go, run, busy, close } = useApp();
    const [period, setPeriod] = useState(options[0]);
    const [coupon, setCoupon] = useState("");
    const [couponMessage, setCouponMessage] = useState("");
    return (
        <form
            className="form-stack"
            onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                    const result = await api<string>("user/order/save", {
                        plan_id: plan.id,
                        period,
                        ...(coupon.trim()
                            ? { coupon_code: coupon.trim() }
                            : {}),
                    });
                    close();
                    go(`order?trade_no=${encodeURIComponent(result.data)}`);
                });
            }}
        >
            <h3>{plan.name}</h3>
            <label>
                Chu kỳ
                <select
                    value={period}
                    onChange={(e) => {
                        setPeriod(e.target.value);
                        setCouponMessage("");
                    }}
                >
                    {options.map((key) => (
                        <option key={key} value={key}>
                            {periods[key]} · {money(plan[key], config.currency)}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Mã giảm giá (nếu có)
                <div className="input-action">
                    <input
                        value={coupon}
                        onChange={(e) => {
                            setCoupon(e.target.value);
                            setCouponMessage("");
                        }}
                    />
                    <button
                        className="button secondary"
                        type="button"
                        disabled={busy || !coupon.trim()}
                        onClick={() =>
                            run(async () => {
                                await api("user/coupon/check", {
                                    code: coupon.trim(),
                                    plan_id: plan.id,
                                });
                                setCouponMessage(
                                    "Mã hợp lệ. Giá cuối cùng được tính khi tạo đơn hàng.",
                                );
                            })
                        }
                    >
                        Kiểm tra
                    </button>
                </div>
            </label>
            {couponMessage && <p className="success-text">{couponMessage}</p>}
            <p className="muted">
                Số dư, ưu đãi và phí thanh toán được máy chủ tính ở bước tiếp
                theo.
            </p>
            <button className="button primary" disabled={busy} type="submit">
                {busy ? "Đang tạo đơn…" : "Tạo đơn hàng"}
            </button>
        </form>
    );
}
export function Orders() {
    const { config, go, revision } = useApp();
    const resource = useResource<Row[]>("user/order/fetch", revision);
    return (
        <>
            <PageTitle
                title="Đơn hàng"
                subtitle="Theo dõi lịch sử mua và gia hạn gói dịch vụ."
            />
            <Card>
                <Resource state={resource}>
                    {resource.data?.map((order) => (
                        <button
                            className="order-row"
                            key={order.trade_no}
                            onClick={() =>
                                go(
                                    `order?trade_no=${encodeURIComponent(order.trade_no)}`,
                                )
                            }
                        >
                            <span className="order-icon">
                                <ReceiptText />
                            </span>
                            <span>
                                <strong>
                                    {order.plan?.name === "deposit" ||
                                    order.period === "deposit"
                                        ? "Nạp số dư"
                                        : order.plan?.name || "Gói dịch vụ"}
                                </strong>
                                <small>
                                    {date(order.created_at)} ·{" "}
                                    {periods[order.period] || "Nạp số dư"}
                                </small>
                                <small className="order-number">
                                    {order.trade_no}
                                </small>
                            </span>
                            <span className="order-amount">
                                <strong>
                                    {money(order.total_amount, config.currency)}
                                </strong>
                                <Badge
                                    tone={
                                        order.status === 3 || order.status === 4
                                            ? "green"
                                            : order.status === 2
                                              ? "muted"
                                              : "blue"
                                    }
                                >
                                    {orderStatuses[order.status] ||
                                        "Không xác định"}
                                </Badge>
                            </span>
                            <ArrowRight size={18} />
                        </button>
                    ))}
                    {!resource.data?.length && (
                        <Empty>Bạn chưa có đơn hàng nào.</Empty>
                    )}
                </Resource>
            </Card>
        </>
    );
}
export function OrderDetail({ trade }: { trade: string }) {
    const { config, refresh, run, busy, notify, modal, close } = useApp();
    const [revision, setRevision] = useState(0);
    const resource = useResource<Row>(
        `user/order/detail?trade_no=${encodeURIComponent(trade)}`,
        revision,
    );
    const methods = useResource<Row[]>("user/order/getPaymentMethod");
    const [method, setMethod] = useState("");
    const [paymentQr, setPaymentQr] = useState("");
    const [paymentUrl, setPaymentUrl] = useState("");
    const order = resource.data;
    const reload = () => setRevision((n) => n + 1);
    useEffect(() => {
        setPaymentQr("");
        setPaymentUrl("");
    }, [trade]);
    const checkout = () =>
        run(async () => {
            const result = await api("user/order/checkout", {
                trade_no: trade,
                ...(method ? { method: Number(method) } : {}),
            });
            if (result.type === -1) {
                notify("Thanh toán đã được tiếp nhận.");
                reload();
                refresh();
            } else if (result.type === 0 && typeof result.data === "string") {
                setPaymentQr(
                    await QRCode.toDataURL(result.data, {
                        width: 280,
                        margin: 2,
                    }),
                );
                setPaymentUrl(httpUrl(result.data) || "");
            } else if (
                result.type === 1 &&
                typeof result.data === "string" &&
                httpUrl(result.data)
            ) {
                location.assign(httpUrl(result.data)!);
            } else {
                throw new Error(
                    "Phương thức này cần giao diện thanh toán chuyên dụng. Hãy chọn phương thức khác hoặc liên hệ hỗ trợ.",
                );
            }
        });
    return (
        <>
            <PageTitle title="Chi tiết đơn hàng" back="orders" />
            <Resource state={resource}>
                {order && (
                    <div className="order-detail-layout">
                        <Card>
                            <Badge tone={order.status === 3 ? "green" : "blue"}>
                                {orderStatuses[order.status]}
                            </Badge>
                            <h2>
                                {order.period === "deposit"
                                    ? "Nạp số dư"
                                    : order.plan?.name}
                            </h2>
                            <dl className="details">
                                <div>
                                    <dt>Mã đơn hàng</dt>
                                    <dd>{trade}</dd>
                                </div>
                                <div>
                                    <dt>Ngày tạo</dt>
                                    <dd>{date(order.created_at)}</dd>
                                </div>
                                <div>
                                    <dt>Chu kỳ</dt>
                                    <dd>
                                        {periods[order.period] || "Nạp số dư"}
                                    </dd>
                                </div>
                                {[
                                    ["discount_amount", "Giảm giá"],
                                    ["balance_amount", "Thanh toán bằng số dư"],
                                    ["handling_amount", "Phí thanh toán"],
                                ]
                                    .filter(([key]) => order[key])
                                    .map(([key, label]) => (
                                        <div key={key}>
                                            <dt>{label}</dt>
                                            <dd>
                                                {money(
                                                    order[key],
                                                    config.currency,
                                                )}
                                            </dd>
                                        </div>
                                    ))}
                                <div className="total">
                                    <dt>Cần thanh toán</dt>
                                    <dd>
                                        {money(
                                            Number(order.total_amount) +
                                                Number(
                                                    order.handling_amount || 0,
                                                ),
                                            config.currency,
                                        )}
                                    </dd>
                                </div>
                            </dl>
                            {order.status === 0 && (
                                <button
                                    className="button danger-outline"
                                    disabled={busy}
                                    onClick={() =>
                                        modal(
                                            "Hủy đơn hàng?",
                                            <>
                                                <p>
                                                    Đơn hàng {trade} sẽ được
                                                    hủy. Số dư đã dùng được xử
                                                    lý theo quy định của hệ
                                                    thống.
                                                </p>
                                                <button
                                                    className="button danger-solid"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(async () => {
                                                            await api(
                                                                "user/order/cancel",
                                                                {
                                                                    trade_no:
                                                                        trade,
                                                                },
                                                            );
                                                            close();
                                                            reload();
                                                        }, "Đã hủy đơn hàng.")
                                                    }
                                                >
                                                    Xác nhận hủy
                                                </button>
                                            </>,
                                        )
                                    }
                                >
                                    Hủy đơn hàng
                                </button>
                            )}
                        </Card>
                        <Card>
                            <h2>
                                <CreditCard />
                                Thanh toán
                            </h2>
                            {order.status === 0 ? (
                                <>
                                    <Resource state={methods}>
                                        {Number(order.total_amount) > 0 && (
                                            <label className="field">
                                                Phương thức
                                                <select
                                                    value={method}
                                                    onChange={(e) =>
                                                        setMethod(
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Chọn phương thức
                                                    </option>
                                                    {methods.data?.map((m) => (
                                                        <option
                                                            key={m.id}
                                                            value={m.id}
                                                        >
                                                            {m.name}
                                                            {m.payment ===
                                                            "StripeCredit"
                                                                ? " (cần giao diện chuyên dụng)"
                                                                : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        <button
                                            className="button primary"
                                            disabled={
                                                busy ||
                                                (Number(order.total_amount) >
                                                    0 &&
                                                    (!method ||
                                                        methods.data?.find(
                                                            (m) =>
                                                                String(m.id) ===
                                                                method,
                                                        )?.payment ===
                                                            "StripeCredit"))
                                            }
                                            onClick={checkout}
                                        >
                                            {Number(order.total_amount) > 0
                                                ? "Tiếp tục thanh toán"
                                                : "Xác nhận đơn miễn phí"}
                                        </button>
                                    </Resource>
                                    {paymentQr && (
                                        <div className="payment-qr">
                                            <img
                                                src={paymentQr}
                                                alt="Mã QR thanh toán"
                                            />
                                            <p>
                                                Quét mã bằng ứng dụng thanh
                                                toán.
                                            </p>
                                            {paymentUrl && (
                                                <a
                                                    className="text-link"
                                                    href={paymentUrl}
                                                    rel="noreferrer"
                                                >
                                                    Mở trang thanh toán{" "}
                                                    <ArrowRight size={17} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Empty>
                                    {order.status === 1
                                        ? "Đang xử lý. Bạn có thể kiểm tra lại trạng thái."
                                        : "Đơn hàng này không cần thanh toán thêm."}
                                </Empty>
                            )}
                            <button
                                className="button secondary"
                                disabled={busy}
                                onClick={reload}
                            >
                                <RefreshCw size={18} />
                                Kiểm tra trạng thái
                            </button>
                        </Card>
                    </div>
                )}
            </Resource>
        </>
    );
}
