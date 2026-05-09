// Pimlico ERC-4337 paymaster client for Scroll Sepolia (chain 534351).
// All user-facing transactions (joinCache, claimCache) are routed through here
// so the user pays zero gas. Pimlico sponsors the cost.
//
// Confirmed: Pimlico free tier supports Scroll Sepolia (2026-05-08).
// Bundler RPC: https://api.pimlico.io/v2/534351/rpc?apikey=<NEXT_PUBLIC_PIMLICO_API_KEY>

import { createPublicClient, http, type Chain } from "viem";
import { scrollSepolia } from "viem/chains";
import {
  createPimlicoClient,
  type PimlicoClient,
} from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";

const PIMLICO_RPC = `https://api.pimlico.io/v2/${scrollSepolia.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;

export function getPimlicoClient(): PimlicoClient {
  return createPimlicoClient({
    transport: http(PIMLICO_RPC),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });
}

export function getPublicClient() {
  return createPublicClient({
    chain: scrollSepolia as Chain,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });
}

/** The plain-language transaction summary shown before every signature. */
export function buildTxSummary(cacheName: string, locale: "cs" | "en"): string {
  if (locale === "cs") {
    return `Získáváte ověření „${cacheName}". Cena: 0 Kč (poplatky hrazeny). Obdržíte 1 atestaci. Žádné osobní údaje nejsou sdíleny.`;
  }
  return `You are claiming the "${cacheName}" credential. This costs 0 CZK (gas sponsored). You receive 1 attestation. No personal data is shared.`;
}
