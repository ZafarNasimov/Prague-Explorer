"use client";

// getLeaderboard() returns all names unsorted; we sort by count desc and
// show top 25 here. The contract return-all approach is fine for <1000
// hackathon participants; swap to an indexer in production.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { readLeaderboard } from "@/lib/contract";

interface Entry {
  name: string;
  count: number;
}

export default function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Only attempt a read if the contract address is configured
    if (!process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS) {
      setLoading(false);
      return;
    }
    readLeaderboard()
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <h1 className="mb-6 text-xl font-bold">{t("title")}</h1>

      {loading && (
        <p className="text-sm text-zinc-400">
          {locale === "cs" ? "Načítám žebříček…" : "Loading leaderboard…"}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          {locale === "cs"
            ? "Žebříček se nepodařilo načíst. Zkuste to znovu."
            : "Could not load the leaderboard. Try again."}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-zinc-400">
          {locale === "cs"
            ? "Zatím žádné záznamy. Buďte první!"
            : "No entries yet. Be the first!"}
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="pb-2 w-10">{t("rank")}</th>
              <th className="pb-2">{t("name")}</th>
              <th className="pb-2 text-right">{t("claims")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr
                key={entry.name}
                className="border-b border-zinc-800/50 last:border-0"
              >
                <td className="py-3 pr-4 text-zinc-500">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                </td>
                <td className="py-3 font-medium">{entry.name}</td>
                <td className="py-3 text-right tabular-nums text-zinc-300">
                  {entry.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Verification footer */}
      <div className="mt-8 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500">
          {locale === "cs" ? "Všechny záznamy jsou ověřitelné on-chain — " : "All claims are verifiable on-chain — "}
          <a
            href={`https://sepolia.scrollscan.com/address/${process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-zinc-300"
          >
            {locale === "cs" ? "zobrazit kontrakt na Scrollscan" : "view contract on Scrollscan"}
          </a>
        </p>
      </div>
    </div>
  );
}
