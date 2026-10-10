export type Row = Record<string, any>;
export const GIB = 1073741824;
export const periods: Record<string, string> = {
    month_price: "1 tháng",
    quarter_price: "3 tháng",
    half_year_price: "6 tháng",
    year_price: "1 năm",
    two_year_price: "2 năm",
    three_year_price: "3 năm",
    onetime_price: "Không giới hạn thời gian",
    reset_price: "Đặt lại lưu lượng",
};
export const orderStatuses = [
    "Chờ thanh toán",
    "Đang xử lý",
    "Đã hủy",
    "Hoàn tất",
    "Đã chuyển đổi",
];
export function usage(sub: Row) {
    const used = Math.max(0, Number(sub.u || 0) + Number(sub.d || 0));
    const total = Math.max(0, Number(sub.transfer_enable || 0));
    return {
        used,
        total,
        remaining: Math.max(0, total - used),
        percent: total > 0 ? Math.min(100, (used / total) * 100) : 0,
    };
}
export function subscriptionState(sub: Row, now = Date.now()) {
    if (
        !sub.plan_id &&
        !sub.plan &&
        !sub.staff_plan_id &&
        !Number(sub.transfer_enable)
    )
        return { label: "Chưa có gói", tone: "muted" };
    if (
        sub.expired_at !== null &&
        sub.expired_at !== undefined &&
        Number(sub.expired_at) * 1000 <= now
    )
        return { label: "Hết hạn", tone: "red" };
    if (usage(sub).used >= usage(sub).total && usage(sub).total > 0)
        return { label: "Hết lưu lượng", tone: "red" };
    return { label: "Còn hạn", tone: "green" };
}
export const number = (n: number, digits = 1) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(
        Number.isFinite(n) ? n : 0,
    );
export const gb = (n: number) => `${number(n / GIB)} GB`;
export const date = (n: number | null | undefined) =>
    n == null
        ? "Không giới hạn"
        : new Date(n * 1000).toLocaleDateString("vi-VN");
export function money(cents: number, currency = "VND") {
    try {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency,
        }).format(Number(cents || 0) / 100);
    } catch {
        return `${number(Number(cents || 0) / 100, 2)} ${currency}`;
    }
}
export function httpUrl(value: string): string | null {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}
export function importUrl(client: string, raw: string, name: string) {
    const safe = httpUrl(raw);
    if (!safe) throw new Error("URL đồng bộ không hợp lệ.");
    const url = new URL(safe);
    url.hash = "";
    url.searchParams.set("flag", client === "sing-box" ? "singbox" : client);
    const source = url.href;
    if (client === "hiddify")
        return `hiddify://import/${source}#${encodeURIComponent(name)}`;
    if (client === "sing-box")
        return `sing-box://import-remote-profile?url=${encodeURIComponent(source)}#${encodeURIComponent(name)}`;
    if (client === "shadowrocket")
        return `shadowrocket://add/sub://${btoa(
            unescape(encodeURIComponent(source)),
        )
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")}?remark=${encodeURIComponent(name)}`;
    throw new Error("Ứng dụng không được hỗ trợ.");
}
export function trafficWeek(logs: Row[], now = new Date()) {
    const days = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - 6 + i);
        return {
            start: day.getTime() / 1000,
            label: day.toLocaleDateString("vi-VN", { weekday: "short" }),
            value: 0,
        };
    });
    for (const log of logs) {
        const day = days.find(
            (d) =>
                Number(log.record_at) >= d.start &&
                Number(log.record_at) < d.start + 86400,
        );
        if (day)
            day.value +=
                ((Number(log.u || 0) + Number(log.d || 0)) *
                    Number(log.server_rate ?? 1)) /
                GIB;
    }
    return days;
}
