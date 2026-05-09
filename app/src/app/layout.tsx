import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Prague Explorer",
  description: "Privacy-preserving geocaching on Scroll",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

// Root layout is intentionally minimal — locale and providers live in [locale]/layout.tsx.
// The <html> lang attribute is set per-locale there.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
