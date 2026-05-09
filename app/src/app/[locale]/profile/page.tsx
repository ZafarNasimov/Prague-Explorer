"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePrivy } from "@privy-io/react-auth";
import { getCacheById, getCacheName } from "@/lib/caches";
import {
  fetchUserAttestations,
  type CacheAttestation,
} from "@/lib/eas";

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, login, authenticated, exportWallet } = usePrivy();

  const [attestations, setAttestations] = useState<CacheAttestation[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Load display name from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("prague-explorer:displayName") ?? "";
    setDisplayName(stored);
    setDraftName(stored);
  }, []);

  // Fetch EAS attestations once we have the wallet address and schema UID.
  // Phase 5: EAS recipient is the Kernel smart account address (not the EOA).
  // The smart account address is cached in localStorage after the first claim.
  // Fall back to EOA address if no smart account address is cached yet.
  useEffect(() => {
    if (!authenticated || !user) return;
    const eoaAddress = user.wallet?.address;
    const schemaUID = process.env.NEXT_PUBLIC_EAS_SCHEMA_UID ?? "";
    if (!eoaAddress || !schemaUID) return;

    const cachedSA =
      typeof window !== "undefined"
        ? localStorage.getItem(`prague-explorer:sa:${eoaAddress.toLowerCase()}`)
        : null;
    const walletAddress = cachedSA ?? eoaAddress;

    setLoading(true);
    fetchUserAttestations(walletAddress, schemaUID)
      .then((results) => {
        const resolved = results.map((a) => {
          const cache = getCacheById(a.cacheId);
          const cacheName = cache
            ? getCacheName(cache, locale)
            : `Cache ${a.cacheId}`;
          console.log("[PROFILE][cache-lookup]", {
            cacheId: a.cacheId,
            cacheIdType: typeof a.cacheId,
            foundCache: !!cache,
            cacheName,
          });
          return { ...a, cacheName };
        });
        setAttestations(resolved);
      })
      .finally(() => setLoading(false));
  }, [authenticated, user, locale]);

  function saveName() {
    const trimmed = draftName.trim();
    localStorage.setItem("prague-explorer:displayName", trimmed);
    setDisplayName(trimmed);
    setEditingName(false);
  }

  if (!authenticated) {
    return (
      <PageShell title={t("profile.title")}>
        <p className="mb-6 text-sm text-zinc-400">
          {locale === "cs"
            ? "Přihlaste se pro zobrazení vašich ověření."
            : "Log in to view your attestations."}
        </p>
        <button
          onClick={() => login()}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white"
        >
          {locale === "cs" ? "Přihlásit se" : "Log in"}
        </button>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("profile.title")}>
      {/* Display name */}
      <section className="mb-6">
        <p className="mb-1 text-xs text-zinc-500">{t("profile.displayName")}</p>
        {editingName ? (
          <div className="flex gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={32}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={saveName}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              {locale === "cs" ? "Uložit" : "Save"}
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3">
            <span className="text-sm text-white">
              {displayName || (locale === "cs" ? "(nenastaveno)" : "(not set)")}
            </span>
            <button
              onClick={() => setEditingName(true)}
              className="text-xs text-indigo-400 underline underline-offset-2"
            >
              {t("profile.editName")}
            </button>
          </div>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          {locale === "cs"
            ? "Toto jméno bude použito pro příští keš. Jména z minulých keší se nemění — jsou součástí on-chain záznamu."
            : "This name will be used for your next claim. Past claims keep the name you used at the time — it is part of the on-chain record."}
        </p>
      </section>

      {/* Attestations list */}
      <section className="mb-6">
        {loading ? (
          <p className="text-sm text-zinc-400">
            {locale === "cs" ? "Načítám ověření…" : "Loading attestations…"}
          </p>
        ) : attestations.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("profile.noAttestations")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {attestations.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">{a.cacheName}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(a.timestamp * 1000).toLocaleDateString(
                      locale === "cs" ? "cs-CZ" : "en-GB"
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                  ✓
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Advanced — wallet export, gated behind 1+ claim */}
      {attestations.length > 0 && (
        <section>
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-400"
          >
            <span>{locale === "cs" ? "Pokročilé" : "Advanced"}</span>
            <span>{advancedOpen ? "▲" : "▼"}</span>
          </button>

          {advancedOpen && (
            <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-800/60 p-4">
              <p className="mb-3 text-xs leading-relaxed text-zinc-400">
                {locale === "cs"
                  ? "Exportujte soukromý klíč své peněženky. Uschovejte ho na bezpečném místě — kdo ho má, má přístup k vašim ověřením."
                  : "Export your wallet private key. Keep it safe — anyone with this key has access to your attestations."}
              </p>
              <button
                onClick={() => exportWallet()}
                className="w-full rounded-lg border border-zinc-600 py-2 text-sm text-zinc-200"
              >
                {t("profile.exportWallet")}
              </button>
            </div>
          )}
        </section>
      )}
    </PageShell>
  );
}

function PageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <h1 className="mb-6 text-xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
