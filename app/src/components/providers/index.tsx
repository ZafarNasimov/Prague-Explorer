"use client";

import { useEffect } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { scrollSepolia } from "viem/chains";

const queryClient = new QueryClient();

function AutoFunder() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    console.log("[FUND][effect-fire] deps changed:", {
      authenticated,
      walletCount: wallets.length,
      walletTypes: wallets.map((w) => w.walletClientType),
    });

    if (!authenticated) {
      console.log("[FUND][trigger-check] not authenticated — skipping");
      return;
    }

    const embedded = wallets.find((w) => w.walletClientType === "privy");
    console.log("[FUND][trigger-check] auth state:", {
      authenticated,
      walletCount: wallets.length,
      hasEmbedded: !!embedded,
      embeddedAddress: embedded?.address,
    });

    if (!embedded) {
      console.log("[FUND][trigger-check] no embedded wallet yet — skipping");
      return;
    }

    const FUNDING_TRIED_KEY = `pe:funding-tried:${embedded.address}`;
    const previousAttempt = localStorage.getItem(FUNDING_TRIED_KEY);
    console.log("[FUND][cache-check] localStorage key:", FUNDING_TRIED_KEY);
    console.log("[FUND][cache-check] previous attempt:", previousAttempt);

    if (previousAttempt) {
      console.log("[FUND][cache-check] already tried for this address — skipping");
      return;
    }

    localStorage.setItem(FUNDING_TRIED_KEY, "1");
    const url = `${window.location.origin}/api/fund-wallet`;
    console.log("[FUND][fetch-start] calling", url, "for:", embedded.address);

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: embedded.address }),
    })
      .then((r) => {
        console.log("[FUND][fetch-response] status:", r.status, "ok:", r.ok);
        return r.json();
      })
      .then((data) => {
        console.log("[FUND][fetch-body]", data);
      })
      .catch((err) => {
        console.error("[FUND][fetch-error]", err);
      });
  }, [authenticated, wallets]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
      config={{
        defaultChain: scrollSepolia,
        supportedChains: [scrollSepolia],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["email", "google"],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AutoFunder />
        {children}
      </QueryClientProvider>
    </PrivyProvider>
  );
}
