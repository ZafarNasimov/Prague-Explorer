// Contract ABI + transaction helpers.
//
// submitJoinCache and submitClaim are the ONLY places in the codebase that
// write to the chain. They try the Pimlico ERC-4337 paymaster path first;
// if the paymaster is unavailable or over-quota, they fall back to the user's
// EOA paying gas directly (fail-open design).

import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
  parseEther,
  type Address,
  type EIP1193Provider,
} from "viem";
import { scrollSepolia } from "viem/chains";
import { unpackProof } from "./semaphore";
import type { SemaphoreProof } from "@semaphore-protocol/proof";
import { buildSmartAccountClient } from "./smartAccount";

export const PRAGUE_EXPLORER_ABI = [
  {
    name: "joinCache",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cacheId", type: "uint256" },
      { name: "identityCommitment", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "claimCache",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "cacheId", type: "uint256" },
      { name: "merkleTreeDepth", type: "uint256" },
      { name: "merkleTreeRoot", type: "uint256" },
      { name: "nullifier", type: "uint256" },
      { name: "proofPoints", type: "uint256[8]" },
      { name: "displayName", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "getLeaderboard",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "names", type: "string[]" },
      { name: "counts", type: "uint256[]" },
    ],
  },
  {
    name: "cacheGroupIds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "cacheId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "semaphore",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "CacheNotFound",
    type: "error",
    inputs: [{ name: "cacheId", type: "uint256" }],
  },
  {
    name: "NullifierAlreadyUsed",
    type: "error",
    inputs: [
      { name: "cacheId", type: "uint256" },
      { name: "nullifier", type: "uint256" },
    ],
  },
  {
    name: "AttestationSchemaNotSet",
    type: "error",
    inputs: [],
  },
] as const;

export function getContractAddress(): Address {
  return (process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS ?? "0x") as Address;
}

function makeClients(provider: EIP1193Provider, walletAddress: Address) {
  const transport = http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC);
  const publicClient = createPublicClient({ chain: scrollSepolia, transport });
  const walletClient = createWalletClient({
    account: walletAddress,
    chain: scrollSepolia,
    transport: custom(provider),
  });
  return { publicClient, walletClient };
}

export async function submitJoinCache(
  provider: EIP1193Provider,
  walletAddress: Address,
  cacheId: bigint,
  identityCommitment: bigint
): Promise<{ sponsored: boolean }> {
  console.log("[CLAIM][submitJoinCache] start", { cacheId: cacheId.toString(), walletAddress });

  // Sponsored path
  try {
    const { smartAccountClient, pimlicoClient } = await buildSmartAccountClient(provider, walletAddress);
    console.log("[CLAIM][submitJoinCache] smart account built, sending UserOp");
    const userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{
        to: getContractAddress(),
        data: encodeFunctionData({
          abi: PRAGUE_EXPLORER_ABI,
          functionName: "joinCache",
          args: [cacheId, identityCommitment],
        }),
        value: 0n,
      }],
    });
    console.log("[CLAIM][submitJoinCache] UserOp sent:", userOpHash);
    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log("[CLAIM][submitJoinCache] UserOp receipt:", {
      success: (receipt as any)?.success,
      receipt: (receipt as any)?.receipt,
    });
    return { sponsored: true };
  } catch (err) {
    console.error("[CLAIM][submitJoinCache] Pimlico path failed — falling to EOA");
    console.error("[CLAIM][submitJoinCache] error name:", (err as any)?.name);
    console.error("[CLAIM][submitJoinCache] error message:", (err as any)?.message);
    console.error("[CLAIM][submitJoinCache] error cause:", (err as any)?.cause);
    console.error("[CLAIM][submitJoinCache] error stack:", (err as any)?.stack);
    console.error("[CLAIM][submitJoinCache] full JSON:", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
  }

  // EOA fallback
  console.warn("[CLAIM][submitJoinCache] [fallback-to-eoa] attempting EOA writeContract");
  const { publicClient, walletClient } = makeClients(provider, walletAddress);
  const hash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PRAGUE_EXPLORER_ABI,
    functionName: "joinCache",
    args: [cacheId, identityCommitment],
  });
  console.log("[CLAIM][submitJoinCache] EOA tx hash:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("[CLAIM][submitJoinCache] EOA receipt:", {
    status: receipt.status,
    blockNumber: receipt.blockNumber?.toString(),
    gasUsed: receipt.gasUsed?.toString(),
  });
  if (receipt.status === "reverted") {
    console.error("[CLAIM][submitJoinCache] [onchain-revert] EOA tx reverted", receipt);
  }
  return { sponsored: false };
}

export interface ClaimParams {
  cacheId: bigint;
  proof: SemaphoreProof;
  displayName: string;
}

export async function submitClaim(
  provider: EIP1193Provider,
  walletAddress: Address,
  params: ClaimParams
): Promise<{ sponsored: boolean }> {
  const unpacked = unpackProof(params.proof);

  // Sponsored path — v1 frontend never sends msg.value.
  // claimCache is payable for v2 contract-mediated donations; not used here.
  try {
    const { smartAccountClient, pimlicoClient } = await buildSmartAccountClient(provider, walletAddress);
    const userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{
        to: getContractAddress(),
        data: encodeFunctionData({
          abi: PRAGUE_EXPLORER_ABI,
          functionName: "claimCache",
          args: [
            params.cacheId,
            unpacked.merkleTreeDepth,
            unpacked.merkleTreeRoot,
            unpacked.nullifier,
            unpacked.points,
            params.displayName,
          ],
        }),
        value: 0n,
      }],
    });
    await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
    return { sponsored: true };
  } catch {
    // Paymaster unavailable — fall through to EOA
  }

  // EOA fallback
  const { publicClient, walletClient } = makeClients(provider, walletAddress);
  const hash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PRAGUE_EXPLORER_ABI,
    functionName: "claimCache",
    args: [
      params.cacheId,
      unpacked.merkleTreeDepth,
      unpacked.merkleTreeRoot,
      unpacked.nullifier,
      unpacked.points,
      params.displayName,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { sponsored: false };
}

/** Direct ETH transfer from the user's wallet to a beneficiary address. */
export async function sendDirectDonation(
  provider: EIP1193Provider,
  walletAddress: Address,
  beneficiary: Address,
  amountEth: string
): Promise<`0x${string}`> {
  const { publicClient, walletClient } = makeClients(provider, walletAddress);
  const hash = await walletClient.sendTransaction({
    to: beneficiary,
    value: parseEther(amountEth),
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function readLeaderboard(): Promise<
  { name: string; count: number }[]
> {
  const client = createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });
  const raw = (await client.readContract({
    address: getContractAddress(),
    abi: PRAGUE_EXPLORER_ABI,
    functionName: "getLeaderboard",
  })) as unknown as [string[], bigint[]];
  const [names, counts] = raw;
  return names
    .map((name, i) => ({ name, count: Number(counts[i]) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
}

export async function readCacheGroupId(cacheId: bigint): Promise<bigint> {
  const client = createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });
  const result = await client.readContract({
    address: getContractAddress(),
    abi: PRAGUE_EXPLORER_ABI,
    functionName: "cacheGroupIds",
    args: [cacheId],
  });
  return result as bigint;
}

/** Map on-chain revert reasons to localized-friendly message keys. */
export function mapContractError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NullifierAlreadyUsed") || msg.includes("alreadyClaimed"))
    return "errors.alreadyClaimed";
  if (msg.includes("AttestationSchemaNotSet"))
    return "errors.generic";
  if (msg.includes("CacheNotFound"))
    return "errors.generic";
  if (
    msg.includes("Semaphore__InvalidProof") ||
    msg.includes("validateProof") ||
    msg.includes("invalid proof")
  )
    return "errors.proofFailed";
  if (msg.includes("chain") || msg.includes("network") || msg.includes("chainId"))
    return "errors.wrongNetwork";
  return "errors.txReverted";
}
