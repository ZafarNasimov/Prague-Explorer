"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CACHES, getCacheName } from "@/lib/caches";

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();

  const contractAddress = process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS ?? "";
  const schemaUID = process.env.NEXT_PUBLIC_EAS_SCHEMA_UID ?? "";

  return (
    <div className="mx-auto max-w-lg px-4">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-400">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          Scroll Sepolia · EthPrague 2026
        </div>

        <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
          {t("home.heroHeadline")}
        </h1>

        <p className="mt-6 max-w-sm text-base leading-relaxed text-zinc-400">
          {t("home.heroSubheadline")}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={`/${locale}/explore`}
            className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            {t("home.heroCta")}
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-zinc-700 px-8 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            {t("home.heroCtaSecondary")}
          </a>
        </div>
      </section>

      {/* ── What it does ─────────────────────────────────────────────────────── */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-semibold">{t("home.whatTitle")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<ShieldIcon />}
            title={t("home.feat1Title")}
            body={t("home.feat1Body")}
          />
          <FeatureCard
            icon={<EyeOffIcon />}
            title={t("home.feat2Title")}
            body={t("home.feat2Body")}
          />
          <FeatureCard
            icon={<HeartIcon />}
            title={t("home.feat3Title")}
            body={t("home.feat3Body")}
          />
        </div>
      </section>

      {/* ── Six caches ───────────────────────────────────────────────────────── */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-semibold">{t("home.cachesTitle")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CACHES.map((cache) => (
            <Link
              key={cache.id}
              href={`/${locale}/explore`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-indigo-500/50 hover:bg-zinc-800/60"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{getCacheName(cache, locale)}</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500 group-hover:bg-zinc-700">#{cache.id}</span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">
                {locale === "cs" ? cache.descriptionCz : cache.descriptionEn}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-12">
        <h2 className="mb-8 text-center text-2xl font-semibold">{t("home.howTitle")}</h2>
        <ol className="flex flex-col gap-4">
          {(["step1", "step2", "step3", "step4"] as const).map((key, idx) => (
            <li key={key} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <p className="text-sm leading-relaxed text-zinc-300">{t(`home.${key}`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-6 pb-20">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-500">
          {contractAddress && (
            <a
              href={`https://sepolia.scrollscan.com/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300"
            >
              {t("verify.contract")} <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
          {schemaUID && (
            <a
              href={`https://scroll-sepolia.easscan.org/schema/view/${schemaUID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300"
            >
              {t("verify.schema")} <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
          {/* TODO(human): replace with your actual GitHub repo URL */}
          <a
            href="https://github.com/placeholder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-zinc-300"
          >
            {t("verify.source")} <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </footer>

    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
        {icon}
      </div>
      <h3 className="mb-1 text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-zinc-500">{body}</p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
