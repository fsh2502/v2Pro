import { describe, expect, it } from "vitest";
import {
    date,
    GIB,
    httpUrl,
    importUrl,
    subscriptionState,
    trafficWeek,
    usage,
} from "./domain";
import { createApi } from "./api";

describe("subscription calculations", () => {
    it("counts upload and download and clamps remaining traffic", () => {
        expect(
            usage({ u: 4 * GIB, d: 9 * GIB, transfer_enable: 10 * GIB }),
        ).toEqual({
            used: 13 * GIB,
            total: 10 * GIB,
            remaining: 0,
            percent: 100,
        });
    });
    it("handles an account without a subscription and unlimited expiry", () => {
        expect(
            subscriptionState({ plan_id: null, transfer_enable: 0 }).label,
        ).toBe("Chưa có gói");
        expect(
            subscriptionState({
                plan_id: 1,
                transfer_enable: GIB,
                expired_at: null,
            }).label,
        ).toBe("Còn hạn");
        expect(date(null)).toBe("Không giới hạn");
    });
    it("marks an expired or exhausted subscription correctly", () => {
        expect(
            subscriptionState({ plan_id: 1, expired_at: 100 }, 100000).tone,
        ).toBe("red");
        expect(
            subscriptionState({
                plan_id: 1,
                expired_at: null,
                transfer_enable: GIB,
                d: GIB,
            }).label,
        ).toBe("Hết lưu lượng");
    });
    it("aggregates multiple server rates on the same day, without fabricated usage", () => {
        const now = new Date(2026, 9, 10, 12);
        const midnight = new Date(2026, 9, 10).getTime() / 1000;
        const days = trafficWeek(
            [
                { record_at: midnight, u: GIB, d: 2 * GIB, server_rate: 2 },
                { record_at: midnight + 20, d: GIB, server_rate: 1 },
                { record_at: midnight - 10 * 86400, d: 99 * GIB },
            ],
            now,
        );
        expect(days).toHaveLength(7);
        expect(days[6].value).toBe(7);
        expect(days.slice(0, 6).every((d) => d.value === 0)).toBe(true);
    });
});
describe("import links", () => {
    it("rejects script URLs and preserves existing query parameters", () => {
        expect(httpUrl("javascript:alert(1)")).toBeNull();
        expect(() =>
            importUrl("hiddify", "javascript:alert(1)", "Demo"),
        ).toThrow();
        expect(
            importUrl(
                "hiddify",
                "https://example.com/sub?token=demo",
                "Tên cá nhân",
            ),
        ).toBe(
            "hiddify://import/https://example.com/sub?token=demo&flag=hiddify#T%C3%AAn%20c%C3%A1%20nh%C3%A2n",
        );
    });
    it("encodes a sing-box URL with a single import flag", () => {
        const result = importUrl(
            "sing-box",
            "https://example.com/sub?flag=old&token=x",
            "Demo",
        );
        const parsed = new URL(result);
        expect(
            new URL(parsed.searchParams.get("url")!).searchParams.getAll(
                "flag",
            ),
        ).toEqual(["singbox"]);
    });
});
describe("API session and errors", () => {
    const response = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    it("sends the original JWT format, Vietnamese locale and JSON body", async () => {
        let options: RequestInit | undefined;
        const api = createApi(
            () => "jwt-demo",
            () => {},
            async (_, input) => {
                options = input;
                return response({ data: true });
            },
        );
        await api("user/update", { remind_expire: 1 });
        expect(options?.method).toBe("POST");
        expect(options?.headers).toMatchObject({
            Authorization: "jwt-demo",
            "Accept-Language": "vi-VN",
        });
        expect(options?.body).toBe('{"remind_expire":1}');
    });
    it("logs out only for confirmed authentication failure, never a server outage", async () => {
        let expired = 0;
        const api = createApi(
            () => "jwt",
            () => expired++,
            async () => response({ message: "Gateway failed" }, 503),
        );
        await expect(api("user/info")).rejects.toThrow("Gateway failed");
        expect(expired).toBe(0);
        const forbidden = createApi(
            () => "jwt",
            () => expired++,
            async () => response({ message: "Permission denied" }, 403),
        );
        await expect(forbidden("user/info")).rejects.toThrow();
        expect(expired).toBe(0);
        const unauthorized = createApi(
            () => "jwt",
            () => expired++,
            async () => response({ message: "未登录或登陆已过期" }, 403),
        );
        await expect(unauthorized("user/info")).rejects.toThrow(
            "Phiên đăng nhập",
        );
        expect(expired).toBe(1);
    });
    it("reports invalid HTML responses instead of assuming success", async () => {
        const api = createApi(
            () => null,
            () => {},
            async () => new Response("<html>proxy</html>"),
        );
        await expect(api("guest/comm/config")).rejects.toThrow(
            "dữ liệu không hợp lệ",
        );
    });
    it("translates live coupon errors without ending the customer session", async () => {
        let expired = false;
        const api = createApi(
            () => "jwt",
            () => {
                expired = true;
            },
            async () => response({ message: "Invalid coupon" }, 500),
        );
        await expect(
            api("user/coupon/check", { code: "invalid", plan_id: 1 }),
        ).rejects.toThrow("Mã giảm giá không hợp lệ.");
        expect(expired).toBe(false);
    });
    it("reports network failure without deleting a session", async () => {
        let expired = false;
        const api = createApi(
            () => "jwt",
            () => {
                expired = true;
            },
            async () => {
                throw new TypeError("Network failed");
            },
        );
        await expect(api("user/info")).rejects.toThrow("Không thể kết nối");
        expect(expired).toBe(false);
    });
});
