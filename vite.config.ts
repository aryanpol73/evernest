import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { buildContentSecurityPolicy } from "./src/lib/contentSecurityPolicy";

// Production only, because the dev server relies on inline scripts.
function securityMetaTags(supabaseUrl: string | undefined): Plugin {
  return {
    name: "evernest-security-meta-tags",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: buildContentSecurityPolicy(supabaseUrl) },
        injectTo: "head-prepend",
      },
      { tag: "meta", attrs: { name: "referrer", content: "no-referrer" }, injectTo: "head-prepend" },
    ],
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Inlined assets become data: URLs, which the Content-Security-Policy blocks for fonts.
    assetsInlineLimit: 0,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    securityMetaTags(loadEnv(mode, process.cwd(), "VITE_").VITE_SUPABASE_URL),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icons/icon-192x192.png", "icons/icon-512x512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: "EverNest",
        short_name: "EverNest",
        description: "A digital home for your family's most important information.",
        theme_color: "#2D6A4F",
        background_color: "#F8F9FA",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
