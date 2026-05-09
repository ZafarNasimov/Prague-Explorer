"use client";

// This file is imported only client-side via dynamic() in MapView.tsx.
// Safe to import Leaflet here — window is guaranteed to exist.

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import { CACHES, getCacheName } from "@/lib/caches";

// Fix Leaflet's default marker icon path (broken by webpack asset hashing)
// This is the canonical solution; do not remove.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapInner() {
  const t = useTranslations("map");
  const locale = useLocale();

  return (
    <div className="relative h-screen w-full">
      <MapContainer
        center={[50.0755, 14.4378]}
        zoom={13}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {CACHES.map((cache) => (
          <Marker key={cache.id} position={[cache.lat, cache.lon]}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-semibold">
                  {getCacheName(cache, locale)}
                </p>
                <Link
                  href={`/${locale}/cache/${cache.id}`}
                  className="mt-2 inline-block rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                >
                  {t("startCache")}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute left-4 top-4 z-[1000] rounded-xl bg-zinc-900/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-zinc-400">{t("subtitle")}</p>
      </div>
    </div>
  );
}
