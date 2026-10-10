// Local synthetic API fixture. Never used by the production Blade entry point.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../public",
);
const port = Number(process.env.IOS_GLASS_DEMO_PORT || 8780);
const now = Math.floor(Date.now() / 1000);
const GB = 1073741824;
const plans = [
    {
        id: 1,
        name: "Premium 100 GB",
        transfer_enable: 100,
        device_limit: 5,
        speed_limit: null,
        month_price: 9900000,
        quarter_price: 26900000,
        year_price: 99900000,
        renew: 1,
        content:
            "Kết nối ổn định, mọi nơi.\n\n- Máy chủ tốc độ cao\n- Hỗ trợ đa nền tảng\n- Đồng bộ chỉ trong một chạm",
    },
    {
        id: 2,
        name: "Essential 50 GB",
        transfer_enable: 50,
        device_limit: 3,
        speed_limit: 100,
        month_price: 5900000,
        year_price: 59000000,
        content: "Lựa chọn gọn nhẹ cho nhu cầu hằng ngày.",
    },
    {
        id: 3,
        name: "Unlimited 300 GB",
        transfer_enable: 300,
        device_limit: 8,
        month_price: 19900000,
        year_price: 199900000,
        content: "Thêm không gian cho công việc và giải trí.",
    },
];
const info = {
    email: "khach-mau@example.com",
    balance: 2500000,
    commission_balance: 0,
    created_at: now - 180 * 86400,
    remind_expire: 1,
    remind_traffic: 1,
    banned: 0,
    device_limit: 5,
};
const sub = {
    plan_id: 1,
    plan: plans[0],
    u: 0.8 * GB,
    d: 12 * GB,
    transfer_enable: 100 * GB,
    expired_at: now + 31 * 86400,
    subscribe_url: "https://example.com/subscription/demo-only",
    alive_ip: 2,
    reset_day: 19,
};
const logs = [0.4, 0.9, 0.7, 1.3, 0.65, 1.6, 2.2].map((value, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 6 + i);
    return {
        record_at: day.getTime() / 1000,
        u: value * 0.1 * GB,
        d: value * 0.9 * GB,
        server_rate: 1,
    };
});
const orders = [
    {
        trade_no: "DEMO202610100001",
        plan: plans[0],
        plan_id: 1,
        period: "month_price",
        total_amount: 9900000,
        status: 3,
        created_at: now - 10 * 86400,
    },
];
const notices = [
    {
        id: 1,
        title: "Chào mừng đến với iOS Glass",
        content:
            "Đây là **bản xem thử với dữ liệu mẫu**. Bạn có thể khám phá các trang và thay đổi giao diện sáng/tối.",
        created_at: now,
    },
];
const tickets = [
    {
        id: 1,
        subject: "Hướng dẫn đồng bộ ứng dụng",
        status: 0,
        level: 1,
        created_at: now - 86400,
        message: [
            {
                id: 1,
                is_me: true,
                message: "Tôi muốn đồng bộ trên iPhone.",
                created_at: now - 86400,
            },
            {
                id: 2,
                is_me: false,
                message:
                    "Bạn hãy mở mục Đồng bộ ứng dụng, chọn ứng dụng đã cài rồi nhấn Mở trong ứng dụng.",
                created_at: now - 80000,
            },
        ],
    },
];
const articles = {
    "Bắt đầu": [
        {
            id: 1,
            title: "Bắt đầu trong 3 bước",
            category: "Bắt đầu",
            body: "## 1. Cài ứng dụng\nChọn Hiddify, Shadowrocket hoặc Sing-box phù hợp với thiết bị của bạn.\n\n## 2. Đồng bộ cấu hình\nMở mục **Đồng bộ ứng dụng** rồi chọn ứng dụng đã cài.\n\n## 3. Bắt đầu sử dụng\nBật kết nối trong ứng dụng của bạn.",
            updated_at: now,
        },
    ],
};
const state = { expired: false, outage: false, empty: false };
const types = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".json": "application/json",
    ".html": "text/html",
};
const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const json = (value, status = 200) => {
        response.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(value));
    };
    try {
        if (url.pathname.startsWith("/api/v1/")) {
            let body = "";
            for await (const chunk of request) body += chunk;
            const input = body ? JSON.parse(body) : {};
            const endpoint = url.pathname.slice(8);
            if (state.outage)
                return json(
                    {
                        message:
                            "Máy chủ tạm thời không phản hồi. Vui lòng thử lại.",
                    },
                    503,
                );
            if (state.expired && endpoint.startsWith("user/"))
                return json({ message: "未登录或登陆已过期" }, 403);
            let data;
            if (
                endpoint === "passport/auth/login" ||
                endpoint === "passport/auth/register" ||
                endpoint === "passport/auth/token2Login"
            ) {
                state.expired = false;
                data = { auth_data: "synthetic-demo-session" };
            } else if (endpoint === "guest/comm/config")
                data = {
                    is_email_verify: 0,
                    is_invite_force: 0,
                    is_recaptcha: 0,
                };
            else if (endpoint === "user/info") data = info;
            else if (endpoint === "user/getSubscribe")
                data = state.empty
                    ? {
                          u: 0,
                          d: 0,
                          transfer_enable: 0,
                          plan_id: null,
                          expired_at: null,
                      }
                    : sub;
            else if (endpoint === "user/comm/config")
                data = { currency: "VND" };
            else if (endpoint === "user/plan/fetch")
                data = url.searchParams.has("id")
                    ? plans.find(
                          (p) => p.id === Number(url.searchParams.get("id")),
                      )
                    : state.empty
                      ? []
                      : plans;
            else if (endpoint === "user/stat/getTrafficLog")
                data = state.empty ? [] : logs;
            else if (endpoint === "user/server/fetch")
                data = [
                    { name: "Singapore · Premium", type: "vless", rate: 1 },
                    { name: "Tokyo · Premium", type: "trojan", rate: 1 },
                ];
            else if (endpoint === "user/notice/fetch")
                data = state.empty
                    ? []
                    : Number(url.searchParams.get("current") || 1) > 1
                      ? []
                      : notices;
            else if (endpoint === "user/knowledge/fetch")
                data = url.searchParams.has("id")
                    ? articles["Bắt đầu"][0]
                    : articles;
            else if (endpoint === "user/order/fetch")
                data = state.empty ? [] : orders;
            else if (endpoint === "user/order/detail")
                data = orders.find(
                    (o) => o.trade_no === url.searchParams.get("trade_no"),
                );
            else if (endpoint === "user/order/getPaymentMethod")
                data = [
                    {
                        id: 1,
                        name: "Thanh toán mẫu",
                        payment: "Demo",
                        handling_fee_percent: 0,
                    },
                ];
            else if (endpoint === "user/order/save") {
                const plan = plans.find((p) => p.id === input.plan_id);
                data = `DEMO${Date.now()}`;
                orders.unshift({
                    trade_no: data,
                    plan,
                    plan_id: input.plan_id,
                    period: input.period,
                    total_amount:
                        input.deposit_amount || plan?.[input.period] || 0,
                    created_at: now,
                    status: 0,
                });
            } else if (endpoint === "user/order/cancel") {
                const order = orders.find((o) => o.trade_no === input.trade_no);
                if (!order)
                    return json({ message: "Không tìm thấy đơn hàng." }, 404);
                order.status = 2;
                data = true;
            } else if (endpoint === "user/order/checkout")
                return json({
                    type: 0,
                    data: "https://example.com/payment/demo-only",
                });
            else if (endpoint === "user/coupon/check") {
                if (input.code !== "GLASS")
                    return json({ message: "Mã giảm giá không tồn tại." }, 422);
                data = { type: 2, value: 10 };
            } else if (endpoint === "user/update") {
                Object.assign(info, input);
                data = true;
            } else if (endpoint === "user/ticket/fetch")
                data = url.searchParams.has("id")
                    ? tickets.find(
                          (t) => t.id === Number(url.searchParams.get("id")),
                      )
                    : state.empty
                      ? []
                      : tickets;
            else if (endpoint === "user/ticket/save") {
                tickets.unshift({
                    id: tickets.length + 1,
                    ...input,
                    status: 0,
                    created_at: now,
                    message: [
                        {
                            id: 1,
                            is_me: true,
                            message: input.message,
                            created_at: now,
                        },
                    ],
                });
                data = true;
            } else if (endpoint === "user/ticket/reply") {
                const ticket = tickets.find((t) => t.id === Number(input.id));
                if (!ticket)
                    return json({ message: "Không tìm thấy yêu cầu." }, 404);
                ticket.message.push({
                    id: ticket.message.length + 1,
                    is_me: true,
                    message: input.message,
                    created_at: now,
                });
                data = true;
            } else if (endpoint === "user/ticket/close") {
                const ticket = tickets.find((t) => t.id === Number(input.id));
                if (ticket) ticket.status = 1;
                data = true;
            } else if (endpoint === "user/getActiveSession")
                data = {
                    demo: {
                        ip: "127.0.0.1",
                        ua: "Trình duyệt xem thử",
                        login_at: now,
                        auth_data: "synthetic-demo-session",
                    },
                };
            else if (endpoint === "user/invite/fetch")
                data = {
                    codes: [{ id: 1, code: "GLASSDEMO" }],
                    stat: [3, 0, 0, 10, 0],
                };
            else if (
                [
                    "passport/auth/forget",
                    "passport/comm/sendEmailVerify",
                    "user/redeemgiftcard",
                    "user/invite/save",
                    "user/removeActiveSession",
                ].includes(endpoint)
            )
                data = true;
            else
                return json(
                    {
                        message:
                            "Chức năng này không được mô phỏng trong bản xem thử.",
                    },
                    404,
                );
            return data === undefined
                ? json({ message: "Không tìm thấy dữ liệu." }, 404)
                : json({ data });
        }
        if (url.pathname.startsWith("/theme/ios-glass/")) {
            const file = path.resolve(publicDir, "." + url.pathname);
            const allowed =
                path.join(publicDir, "theme", "ios-glass") + path.sep;
            if (
                !file.startsWith(allowed) ||
                [".php"].includes(path.extname(file))
            ) {
                response.writeHead(404);
                return response.end();
            }
            response.writeHead(200, {
                "Content-Type":
                    types[path.extname(file)] || "application/octet-stream",
                "Cache-Control": "no-store",
            });
            return response.end(await readFile(file));
        }
        if (url.pathname !== "/") {
            response.writeHead(404);
            return response.end();
        }
        const fixture = url.searchParams.get("fixture");
        state.expired = fixture === "expired";
        state.outage = fixture === "outage";
        state.empty = fixture === "empty";
        const manifest = JSON.parse(
            await readFile(
                path.join(publicDir, "theme/ios-glass/assets/manifest.json"),
                "utf8",
            ),
        );
        const entry = manifest["src/main.tsx"];
        const mode =
            url.searchParams.get("appearance") === "dark" ? "dark" : "light";
        const login = fixture === "login";
        const html = `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#eef5fc"><title>iOS Glass · Xem thử</title>${entry.css.map((css) => `<link rel="stylesheet" href="/theme/ios-glass/assets/${css}">`).join("")}</head><body><div id="root"></div><script>window.iosGlass={title:'v2Pro',config:{appearance:'${mode}'}};localStorage.setItem('ios-glass.appearance','${mode}');${login ? "sessionStorage.removeItem('ios-glass.auth');localStorage.removeItem('ios-glass.auth');" : "sessionStorage.setItem('ios-glass.auth','synthetic-demo-session');"}</script><script type="module" src="/theme/ios-glass/assets/${entry.file}"></script></body></html>`;
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        });
        response.end(html);
    } catch (error) {
        json({ message: "Lỗi máy chủ xem thử." }, 500);
        console.error(error.message);
    }
});
server.listen(port, "127.0.0.1", () =>
    console.log(`Theme demo: http://127.0.0.1:${port}/ (synthetic data only)`),
);
