import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Karto",
        short_name: "Karto",
        description: "Local-first чтение и карточки для изучения языков.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#101318",
        background_color: "#101318",
        lang: "ru",
        icons: [
          {
            src: "/logo.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
        navigateFallback: "/index.html"
      }
    })
  ]
});
