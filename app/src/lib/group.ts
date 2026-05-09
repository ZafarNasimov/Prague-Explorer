// Fetch Semaphore group members by reading MemberAdded events on-chain.
// Used to reconstruct the local Merkle group before generating a ZK proof.
//
// Scroll Sepolia public RPC rejects eth_getLogs ranges larger than ~10k blocks.
// This module scans in bounded chunks from the PragueExplorer deploy block (not
// block 0), caches results in localStorage, and updates incrementally on reuse.

import { createPublicClient, http, parseAbiItem } from "viem";
import { scrollSepolia } from "viem/chains";

const MEMBER_ADDED = parseAbiItem(
  "event MemberAdded(uint256 indexed groupId, uint256 index, uint256 identityCommitment, uint256 merkleTreeRoot)"
);

// Floor block for log scans — members can only be added after PragueExplorer deploys.
// Override via NEXT_PUBLIC_PRAGUE_EXPLORER_DEPLOY_BLOCK.
// Default is a conservative lower bound; slightly too low is safe, too high misses events.
const DEPLOY_BLOCK_DEFAULT = 18_052_900n;

function getDeployBlock(): bigint {
  const env = process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_DEPLOY_BLOCK;
  if (env) {
    try {
      return BigInt(env);
    } catch {
      // malformed — fall through to default
    }
  }
  return DEPLOY_BLOCK_DEFAULT;
}

// ── Pagination constants ───────────────────────────────────────────────────────

const CHUNK_SIZE = 5_000n; // Scroll Sepolia public RPC block-range limit
const MAX_CHUNKS = 50;     // hard ceiling — makes infinite loops mathematically impossible
const SAFETY_TIMEOUT_MS = 15_000; // wall-clock cap per fetchGroupMembers call

// ── localStorage cache ────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = "pe:group-members:";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

interface CachedMembers {
  members: string[]; // bigints serialized to string for JSON
  toBlock: string;   // highest block scanned (inclusive)
  cachedAt: number;
}

function loadCache(groupId: bigint): CachedMembers | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + groupId.toString());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMembers;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(groupId: bigint, members: bigint[], toBlock: bigint): void {
  try {
    if (typeof window === "undefined") return;
    const data: CachedMembers = {
      members: members.map((m) => m.toString()),
      toBlock: toBlock.toString(),
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY_PREFIX + groupId.toString(), JSON.stringify(data));
  } catch {
    // localStorage full or disabled — skip caching
  }
}

// ── Chunked log fetcher ───────────────────────────────────────────────────────

type PublicClient = ReturnType<typeof createPublicClient>;

async function fetchLogsChunk(
  client: PublicClient,
  semaphoreAddress: `0x${string}`,
  groupId: bigint,
  fromBlock: bigint,
  toBlock: bigint
): Promise<bigint[]> {
  const logs = await client.getLogs({
    address: semaphoreAddress,
    event: MEMBER_ADDED,
    args: { groupId },
    fromBlock,
    toBlock,
  });
  return logs
    .sort((a, b) => Number(a.args.index ?? 0n) - Number(b.args.index ?? 0n))
    .map((log) => log.args.identityCommitment as bigint);
}

async function fetchMembersChunked(
  client: PublicClient,
  semaphoreAddress: `0x${string}`,
  groupId: bigint,
  startBlock: bigint,
  endBlock: bigint
): Promise<bigint[]> {
  const startTime = Date.now();
  const allMembers: bigint[] = [];
  let chunksProcessed = 0;
  let cursor = startBlock;

  while (cursor <= endBlock) {
    // Termination condition 1: hard chunk ceiling
    if (chunksProcessed >= MAX_CHUNKS) {
      console.warn("[group] hit MAX_CHUNKS; scan may be incomplete", {
        groupId: groupId.toString(),
        chunksProcessed,
        remaining: (endBlock - cursor).toString(),
      });
      break;
    }
    // Termination condition 2: wall-clock cap
    if (Date.now() - startTime > SAFETY_TIMEOUT_MS) {
      console.warn("[group] fetchGroupMembers timed out, returning partial result", {
        groupId: groupId.toString(),
        chunksProcessed,
      });
      break;
    }

    const chunkEnd = cursor + CHUNK_SIZE - 1n < endBlock ? cursor + CHUNK_SIZE - 1n : endBlock;

    try {
      const members = await fetchLogsChunk(client, semaphoreAddress, groupId, cursor, chunkEnd);
      console.log("[group] chunk ok", {
        from: cursor.toString(),
        to: chunkEnd.toString(),
        found: members.length,
        chunk: chunksProcessed + 1,
      });
      allMembers.push(...members);
      cursor = chunkEnd + 1n;
      chunksProcessed++;
    } catch (err: unknown) {
      // Chunk failed — halve size and retry once
      const halfEnd = cursor + CHUNK_SIZE / 2n - 1n;
      const smallerEnd = halfEnd < endBlock ? halfEnd : endBlock;
      console.warn("[group] chunk failed, retrying with halved range", {
        from: cursor.toString(),
        to: chunkEnd.toString(),
        err: (err as Error)?.message,
      });
      try {
        const members = await fetchLogsChunk(client, semaphoreAddress, groupId, cursor, smallerEnd);
        allMembers.push(...members);
        cursor = smallerEnd + 1n;
        chunksProcessed++;
      } catch (retryErr: unknown) {
        // Termination conditions 3 + 4: retry also failed — throw, don't loop
        console.error("[group] chunk retry also failed, aborting scan", {
          from: cursor.toString(),
          to: chunkEnd.toString(),
          retryErr,
        });
        throw new Error(
          `fetchGroupMembers: chunk ${cursor}-${chunkEnd} unreachable for group ${groupId}: ${(retryErr as Error)?.message}`
        );
      }
    }
  }

  return allMembers;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return all identity commitments in a Semaphore group, ordered by insertion index.
 *
 * Scans from the PragueExplorer deploy block in 5k-block chunks to stay within
 * Scroll Sepolia's RPC range limit. Results are cached in localStorage (5-min TTL)
 * and updated incrementally on subsequent calls.
 */
export async function fetchGroupMembers(
  semaphoreAddress: `0x${string}`,
  groupId: bigint
): Promise<bigint[]> {
  const client = createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC),
  });

  const currentBlock = await client.getBlockNumber();
  const cached = loadCache(groupId);

  if (cached) {
    const cachedToBlock = BigInt(cached.toBlock);
    const cachedMembers = cached.members.map(BigInt);

    if (cachedToBlock >= currentBlock) {
      // Fully up to date — no RPC calls needed
      console.log("[group] cache hit (current)", {
        groupId: groupId.toString(),
        members: cachedMembers.length,
      });
      return cachedMembers;
    }

    // Incremental: scan only the gap since last cache
    const newFrom = cachedToBlock + 1n;
    console.log("[group] cache hit (incremental)", {
      groupId: groupId.toString(),
      cachedMembers: cachedMembers.length,
      from: newFrom.toString(),
      to: currentBlock.toString(),
    });
    const newMembers = await fetchMembersChunked(
      client, semaphoreAddress, groupId, newFrom, currentBlock
    );
    const allMembers = [...cachedMembers, ...newMembers];
    saveCache(groupId, allMembers, currentBlock);
    return allMembers;
  }

  // Full scan from deploy block
  const startBlock = getDeployBlock();
  console.log("[group] full scan", {
    groupId: groupId.toString(),
    from: startBlock.toString(),
    to: currentBlock.toString(),
    blocks: (currentBlock - startBlock).toString(),
  });
  const members = await fetchMembersChunked(
    client, semaphoreAddress, groupId, startBlock, currentBlock
  );
  saveCache(groupId, members, currentBlock);
  return members;
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
