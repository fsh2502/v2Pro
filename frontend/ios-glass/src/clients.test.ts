import { describe, expect, it } from "vitest";
import { detectSyncPlatform, syncClients } from "./clients";
import { clientSubscriptionUrl, importUrl } from "./domain";

const raw =
    "https://example.com/sub?token=a%2Bb&flag=old&flag=duplicate&raw=old#stale";
const name = "Tên CTV & riêng / cá nhân";

describe("EZ-Theme client coverage", () => {
    const expectedPlatforms = {
        ios: [
            "shadowrocket",
            "surge",
            "stash",
            "quantumultx",
            "hiddify",
            "sing-box",
            "loon",
            "happ",
            "karing",
            "v2box",
            "incy",
        ],
        android: [
            "flclash",
            "v2rayng",
            "clash",
            "surfboard",
            "clash-meta",
            "nekobox",
            "sing-box",
            "hiddify",
            "happ",
            "karing",
            "v2box",
            "incy",
        ],
        windows: [
            "flclash",
            "clashverge",
            "clash",
            "nekoray",
            "sing-box",
            "hiddify",
            "happ",
            "karing",
        ],
        macos: [
            "flclash",
            "clashverge",
            "clashx",
            "clashx-meta",
            "surge",
            "stash",
            "quantumultx",
            "sing-box",
            "hiddify",
            "happ",
            "karing",
        ],
    } as const;
    for (const [platform, expected] of Object.entries(expectedPlatforms)) {
        it(`includes every EZ-Theme application for ${platform}`, () => {
            const actual = syncClients
                .filter((client) =>
                    client.platforms.some((id) => id === platform),
                )
                .map((client) => client.id);
            expect(actual.sort()).toEqual([...expected].sort());
        });
    }
    it("has 21 unique applications and detects the device platform", () => {
        expect(new Set(syncClients.map((client) => client.id)).size).toBe(21);
        expect(detectSyncPlatform("Mozilla iPhone Mac OS X")).toBe("ios");
        expect(detectSyncPlatform("Mozilla Android 14")).toBe("android");
        expect(detectSyncPlatform("Mozilla Windows NT 10.0")).toBe("windows");
        expect(detectSyncPlatform("Mozilla Macintosh Mac OS X")).toBe("macos");
        expect(detectSyncPlatform("unknown")).toBeNull();
    });
    it("recognizes iPad desktop mode while retaining macOS and Windows touch devices", () => {
        const desktopApple =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15";
        expect(detectSyncPlatform(desktopApple, 5)).toBe("ios");
        expect(detectSyncPlatform(desktopApple, 0)).toBe("macos");
        expect(detectSyncPlatform("Mozilla Windows NT 10.0", 10)).toBe(
            "windows",
        );
        expect(detectSyncPlatform("Mozilla Android 14", 5)).toBe("android");
        expect(detectSyncPlatform("Mozilla X11 Linux x86_64", 0)).toBeNull();
    });
});

describe("application subscription formats", () => {
    const flags = {
        shadowrocket: "shadowrocket",
        surge: "surge",
        stash: "stash",
        quantumultx: "quantumult",
        hiddify: "hiddify",
        "sing-box": "singbox",
        loon: "loon",
        happ: "happ",
        karing: "general",
        v2box: "v2box",
        incy: "incy",
        flclash: "meta",
        v2rayng: "v2rayng",
        clash: "clash",
        surfboard: "surfboard",
        "clash-meta": "meta",
        nekobox: "meta",
        clashverge: "verge",
        nekoray: "general",
        clashx: "clash",
        "clashx-meta": "meta",
    };
    for (const [id, flag] of Object.entries(flags)) {
        it(`exports a safe subscription and import link for ${id}`, () => {
            const source = clientSubscriptionUrl(id, raw);
            const parsedSource = new URL(source);
            expect(parsedSource.searchParams.getAll("flag")).toEqual([flag]);
            expect(parsedSource.searchParams.get("token")).toBe("a+b");
            expect(parsedSource.hash).toBe("");
            expect(parsedSource.searchParams.getAll("raw")).toEqual(
                id === "incy" ? ["1"] : [],
            );
            expect(() =>
                clientSubscriptionUrl(id, "javascript:alert(1)"),
            ).toThrow();
            const link = importUrl(id, raw, name);
            if (id === "nekoray") {
                expect(link).toBeNull();
                return;
            }
            expect(link).toBeTruthy();
            const imported = new URL(link!);
            if (id === "shadowrocket") {
                const encoded = imported.pathname
                    .replace("/sub://", "")
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");
                expect(atob(encoded)).toBe(source);
                expect(imported.searchParams.get("remark")).toBe(name);
            } else if (id === "quantumultx") {
                const resource = JSON.parse(
                    imported.searchParams.get("remote-resource")!,
                );
                expect(resource.server_remote).toEqual([
                    `${source}, tag=${encodeURIComponent(name)}`,
                ]);
            } else if (["hiddify", "happ", "incy"].includes(id)) {
                const prefix =
                    id === "happ" ? "happ://add/" : `${id}://import/`;
                expect(link!.startsWith(prefix + source)).toBe(true);
            } else {
                expect(
                    imported.searchParams.get(
                        id === "loon" ? "nodelist" : "url",
                    ),
                ).toBe(source);
                if (["sing-box", "v2rayng"].includes(id)) {
                    expect(decodeURIComponent(imported.hash.slice(1))).toBe(
                        name,
                    );
                } else {
                    expect(imported.searchParams.get("name")).toBe(name);
                }
            }
        });
    }
    it("rejects unknown application IDs", () => {
        expect(() => importUrl("unknown", raw, name)).toThrow();
    });
});
