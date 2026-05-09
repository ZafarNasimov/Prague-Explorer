// Kernel v3 smart account + Pimlico paymaster.
//
// Every user's Privy embedded wallet is an EOA. We wrap it in a Kernel smart account
// so that ERC-4337 UserOperations can be sponsored by Pimlico. The smart account
// address is deterministic (CREATE2 from the EOA address) and cached in localStorage.
//
// Phase 5 swap: submitJoinCache / submitClaim in contract.ts call buildSmartAccountClient
// instead of constructing a plain walletClient. The call signature at component level
// does not change.

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
} from "viem";
import { scrollSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";

function pimlicoRpc(): string {
  return `https://api.pimlico.io/v2/${scrollSepolia.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;
}

function makePublicClient() {
  return createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });
}

async function buildKernelAccount(provider: EIP1193Provider, eoaAddress: Address) {
  const publicClient = makePublicClient();
  const walletClient = createWalletClient({
    account: eoaAddress,
    chain: scrollSepolia,
    transport: custom(provider),
  });
  return toKernelSmartAccount({
    client: publicClient,
    owners: [walletClient],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    version: "0.3.1",
  });
}

/**
 * Derive and cache the Kernel smart account address for an EOA.
 * Deterministic: the address is the same on every call for the same EOA.
 * Cached in localStorage to avoid the publicClient RPC call on repeat loads.
 */
export async function getSmartAccountAddress(
  provider: EIP1193Provider,
  eoaAddress: Address
): Promise<Address> {
  const cacheKey = `prague-explorer:sa:${eoaAddress.toLowerCase()}`;
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached as Address;
  }
  const account = await buildKernelAccount(provider, eoaAddress);
  if (typeof window !== "undefined") {
    localStorage.setItem(cacheKey, account.address);
  }
  return account.address;
}

/**
 * Build a SmartAccountClient with Pimlico paymaster sponsorship.
 * Returns both the smartAccountClient (for sendUserOperation) and the
 * pimlicoClient (for waitForUserOperationReceipt).
 */
export async function buildSmartAccountClient(
  provider: EIP1193Provider,
  eoaAddress: Address
) {
  const account = await buildKernelAccount(provider, eoaAddress);
  const rpc = pimlicoRpc();

  const pimlicoClient = createPimlicoClient({
    transport: http(rpc),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain: scrollSepolia,
    bundlerTransport: http(rpc),
    paymaster: pimlicoClient,
  });

  return { smartAccountClient, pimlicoClient };
}

/**
 * Lightweight health check — calls pm_supportedEntryPoints on the Pimlico bundler.
 * Returns true if the paymaster is reachable and supports EP 0.7.
 * Fails fast (5 s timeout).
 */
export async function checkPaymasterHealth(): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(pimlicoRpc(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "pm_supportedEntryPoints",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { result?: string[] };
    return (
      Array.isArray(json.result) &&
      json.result.some((ep) => ep.toLowerCase() === entryPoint07Address.toLowerCase())
    );
  } catch {
    return false;
  }
}
