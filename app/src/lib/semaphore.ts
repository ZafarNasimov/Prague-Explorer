"use client";

// All Semaphore imports are dynamic to prevent SSR — snarkjs requires browser APIs.
// Call generateCacheProof() only inside useEffect or event handlers.

import type { SemaphoreProof } from "@semaphore-protocol/proof";

export type { SemaphoreProof };

/**
 * Derive a deterministic Semaphore identity from Privy user ID + QR secret.
 *
 * Privacy guarantee: the identity private key never leaves this function.
 * Both inputs stay client-side; neither is transmitted to the contract.
 *
 * @param privyUserId  Stable Privy auth identifier (string).
 * @param qrSecret     Per-cache secret decoded from the physical QR code.
 */
export async function deriveIdentity(privyUserId: string, qrSecret: string) {
  const { Identity } = await import("@semaphore-protocol/identity");
  // Concatenate then hash to produce a uniform 32-byte seed
  const encoder = new TextEncoder();
  const data = encoder.encode(privyUserId + "|" + qrSecret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const seed = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return new Identity(seed);
}

/**
 * Compute the Semaphore proof message from a display name.
 *
 * message = keccak256(abi.encodePacked(displayName)) >> 8
 *
 * The >> 8 shift ensures the value fits inside the BN254 scalar field.
 * This matches the Solidity calculation in PragueExplorer.claimCache().
 * Binding the display name to the message prevents front-running.
 *
 * Call this from a client component that already imports viem:
 *   import { keccak256, encodePacked } from 'viem';
 *   const message = BigInt(keccak256(encodePacked(['string'], [displayName]))) >> 8n;
 */
// computeMessage is intentionally not exported as a standalone function;
// the calculation is inlined inside generateCacheProof and documented above.

/**
 * Generate a Semaphore ZK proof for a cache claim.
 *
 * Runs entirely in the browser using snarkjs + WASM (~3 seconds).
 * Circuit artifacts are fetched from the PSE trusted-setup server:
 *   https://www.trusted-setup-pse.org/semaphore/{depth}/semaphore.{wasm,zkey}
 *
 * @param privyUserId  Privy auth ID (never sent to chain).
 * @param qrSecret     QR code secret (never sent to chain).
 * @param groupMembers Array of identity commitments in the cache's Semaphore group.
 * @param cacheId      Numeric cache ID (used as scope — scopes nullifiers per cache).
 * @param displayName  User-chosen display name (used as message to prevent front-run).
 */
export async function generateCacheProof(
  privyUserId: string,
  qrSecret: string,
  groupMembers: bigint[],
  cacheId: bigint,
  displayName: string
): Promise<SemaphoreProof> {
  const { Group } = await import("@semaphore-protocol/group");
  const { generateProof } = await import("@semaphore-protocol/proof");
  const { keccak256, encodePacked } = await import("viem");

  const identity = await deriveIdentity(privyUserId, qrSecret);

  const group = new Group(groupMembers);

  const messageHash = keccak256(encodePacked(["string"], [displayName]));
  const message = BigInt(messageHash) >> 8n;
  const scope = cacheId;

  // snarkjs fetches the WASM + zkey from the PSE trusted-setup CDN.
  // No local files needed; the fetch happens transparently in the browser.
  return generateProof(identity, group, message, scope);
}

/**
 * Unpack a SemaphoreProof into the flat arguments expected by PragueExplorer.claimCache().
 */
export function unpackProof(proof: SemaphoreProof): {
  merkleTreeDepth: bigint;
  merkleTreeRoot: bigint;
  nullifier: bigint;
  points: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
} {
  return {
    merkleTreeDepth: BigInt(proof.merkleTreeDepth),
    merkleTreeRoot: BigInt(proof.merkleTreeRoot),
    nullifier: BigInt(proof.nullifier),
    points: proof.points.map(BigInt) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ],
  };
}
