// Fetch Semaphore group members by reading MemberAdded events on-chain.
// Used to reconstruct the local Merkle group before generating a ZK proof.

import { createPublicClient, http, parseAbiItem } from "viem";
import { scrollSepolia } from "viem/chains";

const MEMBER_ADDED = parseAbiItem(
  "event MemberAdded(uint256 indexed groupId, uint256 index, uint256 identityCommitment, uint256 merkleTreeRoot)"
);

/**
 * Return all identity commitments in a Semaphore group, ordered by insertion index.
 *
 * Uses getLogs from block 0. For a freshly-deployed testnet contract with <1000
 * members this is fast. In production, replace with an off-chain indexer.
 */
export async function fetchGroupMembers(
  semaphoreAddress: `0x${string}`,
  groupId: bigint
): Promise<bigint[]> {
  const client = createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });

  const logs = await client.getLogs({
    address: semaphoreAddress,
    event: MEMBER_ADDED,
    args: { groupId },
    fromBlock: 0n,
  });

  return logs
    .sort((a, b) => Number(a.args.index ?? 0n) - Number(b.args.index ?? 0n))
    .map((log) => log.args.identityCommitment as bigint);
}

/**
 * Read the Semaphore contract address from PragueExplorer on-chain.
 * Prefer setting NEXT_PUBLIC_SEMAPHORE_ADDRESS in env to avoid this extra call.
 */
export async function readSemaphoreAddress(
  explorerAddress: `0x${string}`
): Promise<`0x${string}`> {
  if (process.env.NEXT_PUBLIC_SEMAPHORE_ADDRESS) {
    return process.env.NEXT_PUBLIC_SEMAPHORE_ADDRESS as `0x${string}`;
  }
  const client = createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });
  return client.readContract({
    address: explorerAddress,
    abi: [
      {
        name: "semaphore",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
      },
    ] as const,
    functionName: "semaphore",
  }) as Promise<`0x${string}`>;
}
