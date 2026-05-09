"use client";

import { useEffect, useState } from "react";
import { checkPaymasterHealth } from "@/lib/smartAccount";

export function PaymasterStatus() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const result = await checkPaymasterHealth();
      if (!cancelled) setHealthy(result);
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (healthy === null) return null;

  return (
    <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-400 backdrop-blur-sm">
      <span
        className={`h-2 w-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-zinc-500"}`}
        aria-hidden="true"
      />
      <span>Gas {healthy ? "free" : "off"}</span>
    </div>
  );
}
