# Prague Explorer — Privacy by Design

This document explains the privacy decisions in Prague Explorer for judges evaluating the Privacy by Design bounty. It is written to be read alongside the contract source (`contracts/src/PragueExplorer.sol`) and the engineering threat model (`THREAT_MODEL.md`).

---

## The core claim

Prague Explorer lets a user prove they visited a physical location without revealing *who* they are, *which other locations* they have visited, or *when* they will claim. The proof is a zero-knowledge Semaphore proof generated entirely inside the user's browser. Nothing leaves the device except the proof itself — a set of numbers that verify membership without exposing identity.

---

## What the chain learns from a completed claim

A successful `claimCache` transaction makes three facts public:

| Public | Value | Notes |
|---|---|---|
| `nullifier` | opaque `uint256` | Cannot be reverse-engineered to any identity. Unique per `(identity, cacheId)` pair. |
| `displayName` | user-chosen string | Unverified. Anyone can pick any name. |
| `cacheId` | which cache was claimed | The only location information that is public. |

Nothing else is public. In particular:

- The user's wallet address does not appear in the `CacheClaimed` event (intentional — see the contract comment on line 133).
- The user's email, Privy user ID, and any other auth identity never touch the chain.
- The ZK identity commitment (the Semaphore "public key") is added to the Merkle tree in `joinCache`, but is not linkable to any external identity without knowledge of both the Privy user ID and the QR secret.

---

## Identity derivation

The user's Semaphore identity is derived entirely client-side:

```
semaphoreIdentity = Identity(keccak256(privyUserId + "|" + qrSecret))
```

- `privyUserId` is a stable identifier from Privy authentication. It never leaves the browser in this flow.
- `qrSecret` is a random string embedded in the physical QR code at the cache site. Obtaining it requires physical presence (or receiving it from someone who was present — a known limitation discussed below).
- The identity private key is derived deterministically from these two inputs. It is never stored, transmitted, or exported.

The result: an on-chain identity commitment that is computationally indistinguishable from random to any observer who does not know both inputs.

---

## Cross-cache unlinkability

This is the most important privacy property for multi-cache deployments.

The Semaphore proof uses `scope = cacheId` as the domain separator for the nullifier:

```
nullifier = hash(identity_secret, cacheId)
```

A different `cacheId` produces a completely different nullifier. An observer who sees that nullifier `0xabc...` claimed cache 1 and nullifier `0xdef...` claimed cache 2 cannot determine whether these were the same person. The two nullifiers share no mathematical relationship that an observer can exploit.

This is not a property we added on top of Semaphore — it is Semaphore's core design. We use it correctly by setting `scope = cacheId` and not reusing scope values.

---

## What joinCache reveals

When a user completes the quiz and begins proof generation, their identity commitment is added to the Semaphore Merkle tree via `joinCache`. This transaction is public: an observer sees "someone is preparing to claim cache X."

The identity commitment itself reveals nothing about the user — it is the output of a Poseidon hash of the identity secret. But the transaction is gas-funded via the Pimlico ERC-4337 paymaster, which means the gas payer is the paymaster contract, not the user's wallet. This decouples the funding identity from the identity being registered.

Residual leak: the user's smart account address initiates the `joinCache` UserOperation. An observer with access to bundler mempool data could potentially correlate the smart account with the `joinCache` transaction. In production, this would be mitigated by routing through a mixing relay.

---

## What we chose not to protect (v1 scope)

### Physical presence

The QR secret is the sole gate. If a user shares the QR code value with a friend who did not visit the site, that friend can complete the claim. We accepted this because:

1. The secret is in a physical sign, not transmitted digitally by the app.
2. In a hackathon context, the social cost of cheating ("you didn't actually go there") is sufficient deterrent.
3. Hardware attestation (Secure Enclave signatures, NFC tags) is the correct v2 solution but is out of scope.

Importantly, sharing the QR secret does not break the ZK properties. Each claimer still generates their own distinct proof with their own Privy identity. There is no replay — the nullifier prevents double-claiming from the same identity.

### Display name authenticity

Display names are user-chosen strings. There is no verification. Anyone can claim to be "Vitalik" on the leaderboard. In v2, ENS L2 subnames would replace free-text display names. For the demo, the leaderboard is a convenience feature, not a trust anchor.

### EAS attestation address linkage

The EAS attestation recipient is `msg.sender` — the user's Kernel smart account address. This is necessary so users can look up their own attestations. It creates a weak link between a wallet address and a specific cache claim. An observer who knows a wallet address can see which caches that address has claimed, but cannot link the wallet address to an email, name, or Privy identity without additional data.

---

## The donation flow

Post-claim tip donations are a direct ETH transfer from the user's embedded wallet to the cache's beneficiary address. This is a separate transaction, not part of the ZK claim. The donation is:

- **Optional** — the claim is always free and always sponsored
- **User-initiated** — the user explicitly enters an amount and confirms
- **Honest** — the UI says "you pay a small gas fee" because you do

The claim transaction never carries `msg.value`. Gas sponsorship covers 100% of the claim cost. Tip donations are the user's choice to make after they have already received their attestation.

---

## Honest disclosure summary

| Property | Status | Notes |
|---|---|---|
| Claim unlinkable to identity | ✓ | Nullifier opaque; msg.sender not indexed |
| Cross-cache unlinkability | ✓ | Scope-separated nullifiers |
| Identity never leaves browser | ✓ | Client-side derivation only |
| Gas payer ≠ claimer | ✓ | Pimlico paymaster covers gas |
| Physical presence required | ~ | QR sharing is possible; no hardware attestation in v1 |
| Display name verified | ✗ | Free-text; ENS required for v2 |
| EAS attestation is anonymous | ~ | Smart account address is public; not linked to auth identity |
| Claim is free | ✓ | msg.value is always 0 in v1 frontend |
