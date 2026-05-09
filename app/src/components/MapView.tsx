"use client";

// Leaflet uses `window` at import time → must be client-only and loaded dynamically.
// Phase 4 will build this out fully; this stub proves the dynamic import pattern works.

import dynamic from "next/dynamic";

const Map = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-900">
      <span className="text-zinc-400">Načítám mapu…</span>
    </div>
  ),
});

export function MapView() {
  return <Map />;
}
