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
        const decoded = JSON.parse(a.decodedDataJson);
        const cacheId = Number(decoded.find((f: { name: string }) => f.name === "cacheId")?.value?.value ?? 0);
        const displayName = decoded.find((f: { name: string }) => f.name === "displayName")?.value?.value ?? "";
        return {
          id: a.id,
          cacheId,
          cacheName: `Cache ${cacheId}`, // resolved from caches.json in the component
          displayName,
          timestamp: a.timeCreated,
        };
      } catch {
        return null;
      }
    }
  ).filter(Boolean) as CacheAttestation[];
}
