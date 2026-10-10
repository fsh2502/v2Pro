export const syncPlatforms = [
    { id: "ios", name: "iOS" },
    { id: "android", name: "Android" },
    { id: "windows", name: "Windows" },
    { id: "macos", name: "macOS" },
] as const;

export type SyncPlatform = (typeof syncPlatforms)[number]["id"];
type ImportScheme =
    | "hiddify"
    | "shadowrocket"
    | "sing-box"
    | "surge"
    | "stash"
    | "quantumult-x"
    | "loon"
    | "v2rayng"
    | "clash"
    | "surfboard"
    | "happ"
    | "karing"
    | "v2box"
    | "incy"
    | "manual";

export type SyncClient = {
    id: string;
    name: string;
    platforms: readonly SyncPlatform[];
    flag: string;
    scheme: ImportScheme;
};

// Application/platform coverage from EZ-Theme Dashboard.vue, revision 10dfdba.
// Flags target v2Pro exporters rather than relying on the app's User-Agent.
export const syncClients: readonly SyncClient[] = [
    {
        id: "shadowrocket",
        name: "Shadowrocket",
        platforms: ["ios"],
        flag: "shadowrocket",
        scheme: "shadowrocket",
    },
    {
        id: "surge",
        name: "Surge",
        platforms: ["ios", "macos"],
        flag: "surge",
        scheme: "surge",
    },
    {
        id: "stash",
        name: "Stash",
        platforms: ["ios", "macos"],
        flag: "stash",
        scheme: "stash",
    },
    {
        id: "quantumultx",
        name: "Quantumult X",
        platforms: ["ios", "macos"],
        flag: "quantumult",
        scheme: "quantumult-x",
    },
    {
        id: "hiddify",
        name: "Hiddify",
        platforms: ["ios", "android", "windows", "macos"],
        flag: "hiddify",
        scheme: "hiddify",
    },
    {
        id: "sing-box",
        name: "Sing-box",
        platforms: ["ios", "android", "windows", "macos"],
        flag: "singbox",
        scheme: "sing-box",
    },
    {
        id: "loon",
        name: "Loon",
        platforms: ["ios"],
        flag: "loon",
        scheme: "loon",
    },
    {
        id: "happ",
        name: "Happ",
        platforms: ["ios", "android", "windows", "macos"],
        flag: "happ",
        scheme: "happ",
    },
    {
        id: "karing",
        name: "Karing",
        platforms: ["ios", "android", "windows", "macos"],
        flag: "general",
        scheme: "karing",
    },
    {
        id: "v2box",
        name: "V2BOX",
        platforms: ["ios", "android"],
        flag: "v2box",
        scheme: "v2box",
    },
    {
        id: "incy",
        name: "Incy",
        platforms: ["ios", "android"],
        flag: "incy",
        scheme: "incy",
    },
    {
        id: "flclash",
        name: "FlClash",
        platforms: ["android", "windows", "macos"],
        flag: "meta",
        scheme: "clash",
    },
    {
        id: "v2rayng",
        name: "v2rayNG",
        platforms: ["android"],
        flag: "v2rayng",
        scheme: "v2rayng",
    },
    {
        id: "clash",
        name: "Clash",
        platforms: ["android", "windows"],
        flag: "clash",
        scheme: "clash",
    },
    {
        id: "surfboard",
        name: "Surfboard",
        platforms: ["android"],
        flag: "surfboard",
        scheme: "surfboard",
    },
    {
        id: "clash-meta",
        name: "Clash Meta",
        platforms: ["android"],
        flag: "meta",
        scheme: "clash",
    },
    {
        id: "nekobox",
        name: "NekoBox",
        platforms: ["android"],
        flag: "meta",
        scheme: "clash",
    },
    {
        id: "clashverge",
        name: "Clash Verge",
        platforms: ["windows", "macos"],
        flag: "verge",
        scheme: "clash",
    },
    // Upstream NekoRay has no OS install-config handler. Offer copy/QR import.
    {
        id: "nekoray",
        name: "Nekoray",
        platforms: ["windows"],
        flag: "general",
        scheme: "manual",
    },
    {
        id: "clashx",
        name: "ClashX",
        platforms: ["macos"],
        flag: "clash",
        scheme: "clash",
    },
    {
        id: "clashx-meta",
        name: "ClashX Meta",
        platforms: ["macos"],
        flag: "meta",
        scheme: "clash",
    },
];

export function getSyncClient(id: string): SyncClient {
    const client = syncClients.find((item) => item.id === id);
    if (!client) throw new Error("Ứng dụng không được hỗ trợ.");
    return client;
}

export function detectSyncPlatform(userAgent: string): SyncPlatform {
    if (/android/i.test(userAgent)) return "android";
    if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
    if (/windows/i.test(userAgent)) return "windows";
    if (/macintosh|mac os/i.test(userAgent)) return "macos";
    return "ios";
}
