"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { scrollSepolia } from "viem/chains";

// @privy-io/wagmi (the Privy wagmi connector package) is intentionally not
// installed in this scaffold — the wagmi integration is wired up in Phase 5
// when we set up the paymaster tx flow. PrivyProvider alone is sufficient for
// Phase 3/4 UI work (embedded wallets, auth state, etc.).

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
      config={{
        defaultChain: scrollSepolia,
        supportedChains: [scrollSepolia],
        // Privy v3 API: createOnLogin is nested under the chain type
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["email", "google"],
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
}
