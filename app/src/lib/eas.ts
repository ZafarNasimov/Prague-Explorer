// EAS (Ethereum Attestation Service) helpers for fetching user attestations.
// Contract addresses verified 2026-05-08 from the official EAS deployments repo.

export const EAS_ADDRESS =
  "0xaEF4103A04090071165F78D45D83A0C0782c2B2a" as const;
export const SCHEMA_REGISTRY_ADDRESS =
  "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797" as const;

// EAS GraphQL endpoint for Scroll Sepolia (read-only, no auth needed)
// Source: scroll-sepolia.easscan.org
export const EAS_GRAPHQL_URL =
  "https://scroll-sepolia.easscan.org/graphql" as const;

export interface CacheAttestation {
  id: string;
  cacheId: number;
  cacheName: string;
  displayName: string;
  timestamp: number;
}

// EAS returns uint256 fields as BigNumber objects { type: "BigNumber", hex: "0x..." }
// when the decodedDataJson is produced by the EAS SDK. Handle every variant.
function parseUint256(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "string") {
    try { return Number(BigInt(raw)); } catch { return Number(raw); }
  }
  if (raw !== null && typeof raw === "object" && "hex" in raw) {
    try { return Number(BigInt((raw as { hex: string }).hex)); } catch { return 0; }
  }
  return 0;
}

/**
 * Fetch all Prague Explorer attestations held by a wallet address.
 * Queries the EAS GraphQL API — no on-chain calls required.
 */
export async function fetchUserAttestations(
  walletAddress: string,
  schemaUID: string
): Promise<CacheAttestation[]> {
  const query = `
    query UserAttestations($recipient: String!, $schema: String!) {
      attestations(
        where: {
          recipient: { equals: $recipient }
          schemaId: { equals: $schema }
        }
        orderBy: { timeCreated: desc }
      ) {
        id
        decodedDataJson
        timeCreated
      }
    }
  `;

  const res = await fetch(EAS_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { recipient: walletAddress, schema: schemaUID },
    }),
  });

  if (!res.ok) return [];

  const { data } = await res.json();
  const attestations = data?.attestations ?? [];

  return attestations.map(
    (a: { id: string; decodedDataJson: string; timeCreated: number }) => {
      try {
        const decoded = JSON.parse(a.decodedDataJson) as Array<{
          name: string;
          value: { value: unknown };
        }>;
        console.log("[PROFILE][attestation-raw]", a.decodedDataJson);

        const rawCacheId = decoded.find((f) => f.name === "cacheId")?.value?.value ?? 0;
        const displayName = String(decoded.find((f) => f.name === "displayName")?.value?.value ?? "");

        // EAS encodes uint256 as a BigNumber object { type: "BigNumber", hex: "0x..." }
        // when serialised through the SDK. Handle all variants defensively.
        const cacheId = parseUint256(rawCacheId);

        console.log("[PROFILE][attestation-decoded]", {
          rawCacheId,
          rawCacheIdType: typeof rawCacheId,
          cacheId,
          displayName,
        });

        return {
          id: a.id,
          cacheId,
          cacheName: `Cache ${cacheId}`, // overwritten by the component using caches.ts
          displayName,
          timestamp: a.timeCreated,
        };
      } catch (err) {
        console.error("[PROFILE][attestation-decode-error]", err);
        return null;
      }
    }
  ).filter(Boolean) as CacheAttestation[];
}

/**
 * Check whether a wallet has already claimed a specific cache.
 * Queries EAS by recipient address — works because claimCache sets recipient=msg.sender.
 * Fails open (returns false) on any network error so the user can still attempt the claim.
 */
export async function checkAlreadyClaimed(
  cacheId: number,
  walletAddress: string,
  schemaUID: string
): Promise<boolean> {
  if (!schemaUID || !walletAddress) return false;
  try {
    const attestations = await fetchUserAttestations(walletAddress, schemaUID);
    const claimed = attestations.some((a) => a.cacheId === cacheId);
    console.log("[CACHE-PAGE][already-claimed-check]", {
      cacheId,
      wallet: walletAddress.slice(0, 10) + "…",
      claimed,
      totalAttestations: attestations.length,
    });
    return claimed;
  } catch (err) {
    console.warn("[CACHE-PAGE][already-claimed-check-failed]", err);
    return false;
  }
}
