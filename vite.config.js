import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        vue(),
        VitePWA({
            registerType: "autoUpdate",
            // Registered from src/main.js so the CSP can stay script-src 'self'.
            injectRegister: null,
            manifest: {
                name: "Pomodoro Timer",
                short_name: "Pomodoro",
                description:
                    "A Pomodoro timer with task list, ambient music and notifications.",
                start_url: "/",
                display: "standalone",
                background_color: "#121212",
                theme_color: "#121212",
                icons: [
                    {
                        src: "/icons/android-chrome-192x192.png",
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: "/icons/android-chrome-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable"
                    }
                ]
            },
            workbox: {
                // Precache the app shell and the three short cues; the four
                // 25-28 MB music tracks are cached on first play instead.
                globPatterns: [
                    "**/*.{js,css,html,woff2,svg,png,ico}",
                    "audio/audio_{break,work,finish}.mp3"
                ],
                runtimeCaching: [
                    {
                        urlPattern: /\/audio\/.*\.mp3$/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "music",
                            rangeRequests: true,
                            expiration: { maxEntries: 8 }
                        }
                    }
                ],
                importScripts: ["sw-notify.js"]
            }
        })
    ]
});
