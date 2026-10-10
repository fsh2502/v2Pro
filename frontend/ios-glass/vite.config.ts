import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/theme/ios-glass/assets/",
    build: {
        outDir: "../../public/theme/ios-glass/assets",
        emptyOutDir: true,
        assetsDir: "",
        manifest: "manifest.json",
        rollupOptions: { input: "src/main.tsx" },
    },
});
