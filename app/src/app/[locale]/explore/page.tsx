import { MapView } from "@/components/MapView";

// Public page — no auth gate.
// MapView uses dynamic import (ssr: false) because Leaflet references window.
export default function ExplorePage() {
  return <MapView />;
}
