import withPWA from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Semaphore packages ship ESM-only; transpile them for Next.js
  transpilePackages: [
    "@semaphore-protocol/identity",
    "@semaphore-protocol/group",
    "@semaphore-protocol/proof",
    "@semaphore-protocol/core",
  ],

  webpack(config, { isServer }) {
    // ── WASM support (required for snarkjs / Semaphore proof generation) ──────
    // snarkjs runs a Groth16 verifier compiled to WASM in the browser.
    // asyncWebAssembly + layers lets Next.js bundle and stream the .wasm chunks.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // ── Browser polyfills for Node.js built-ins used by snarkjs ──────────────
    // snarkjs references fs and readline at import time even in browser builds.
    // Setting them to false tells webpack to replace them with empty modules.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        readline: false,
        path: false,
        crypto: false,
      };
    }

    // ── Stub optional Privy deps we don't use ────────────────────────────────
    // @privy-io/react-auth v3 optionally imports @farcaster/mini-app-solana for
    // Farcaster frame support. We don't use this feature; resolve to an empty
    // module stub so webpack doesn't fail the build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": require.resolve(
        "./src/lib/stubs/empty-module.js"
      ),
    };

    return config;
  },
};

export default withNextIntl(
  withPWA({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
      // Cache Leaflet map tiles for offline use
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "map-tiles",
            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
      ],
      disableDevLogs: true,
    },
  })(nextConfig)
);
