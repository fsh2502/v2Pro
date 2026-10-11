import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import { clientIcons } from "./client-icons";
import { syncClients } from "./clients";

describe("bundled client artwork", () => {
    it("provides a local icon for every supported application", () => {
        expect(Object.keys(clientIcons).sort()).toEqual(syncClients.map((client) => client.id).sort());
        for (const icon of Object.values(clientIcons)) {
            expect(icon).toBeTruthy();
            expect(icon).not.toMatch(/^https?:/);
            const file = basename(new URL(icon, "https://local.invalid").pathname);
            const bytes = readFileSync(new URL(`./assets/clients/${file}`, import.meta.url));
            if (file.endsWith(".png")) {
                expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
            } else {
                expect(file.endsWith(".jpg")).toBe(true);
                expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
            }
        }
    });
});
