import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { NavBar } from "@/components/NavBar";
import "@/app/globals.css";
import "leaflet/dist/leaflet.css";

// params is a plain object in Next.js 14 (not a Promise — that's Next.js 15)
export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="bg-zinc-950 text-white">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {/* pb-16 reserves space for the fixed bottom NavBar */}
            <main className="pb-16">{children}</main>
            <NavBar />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
