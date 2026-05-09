# Prague Explorer — Threat Model

Privacy-preserving geocaching on Scroll Sepolia.
This document covers what we protect, what we knowingly leak, and scaling limits that affect a future production deployment.

---

## What we protect

| Asset | How |
|---|---|
| User's real identity | Privy auth; Privy ID never leaves the browser |
| QR secret | Never transmitted to the contract or server |
| Semaphore identity key | Derived client-side, never exported |
| Cross-cache linkability | `scope = cacheId` — nullifiers are cache-scoped and uncorrelated on-chain |
| Wallet ↔ claim linkage | `CacheClaimed` event does **not** index `msg.sender`; EAS recipient is the smart account (not the Privy auth identity) |

---

## What we knowingly leak

### joinCache on-chain visibility
When a user passes the quiz and starts proof generation, their identity commitment is added to the Semaphore group for that cache. This is visible on-chain as "someone is preparing to claim cache X." The identity commitment cannot be linked to an external identity (wallet, email, Privy account) — it is a hash derived from `keccak256(privyUserId || qrSecret)`, both of which stay client-side.

**Mitigation in production:** Route `joinCache` through a mixing service or relay to decouple the gas payer's identity from the identity commitment being registered.

### Display name on leaderboard
Display names are user-chosen, unverified strings committed on-chain. Anyone can impersonate a name. In v1 this is acceptable; v2 should require ENS L2 subnames for Sybil resistance. See `TODO(human)` markers in the contract.

### Display name: localStorage (future intent) vs on-chain (immutable record)
The frontend stores the user's chosen display name in `localStorage` under `prague-explorer:displayName`. This represents their *intended name for the next claim*. Once `claimCache` is called, the display name is embedded in the ZK proof's message field and committed on-chain permanently — it cannot be changed retroactively. These are two distinct concepts: the localStorage value is mutable intent; the on-chain value is an immutable record. A user who changes their display name between claims gets different names on different leaderboard entries. This is intentional and documented in the UI.

### QR secret sharing
The QR secret is the sole gate on physical presence. Anyone with knowledge of the secret (e.g., a friend who was given the QR value remotely) can complete the claim flow without visiting the site. This is a known limitation in v1.

**Why accepted:** The QR secret is embedded in a physical sign at the cache site, not transmitted digitally by the app. Obtaining it requires either visiting the site or receiving it from someone who did. For a hackathon this trust assumption is acceptable. In production, the secret would be rotated per-claim or supplemented with a server-side challenge that requires the device to submit a location-timestamped payload signed by a hardware-backed key (e.g., Secure Enclave attestation). That is out of scope for v1.

**What this attack does NOT break:** even if the secret is shared, the ZK identity is derived from `keccak256(privyUserId || qrSecret)`. Each Privy user ID produces a distinct identity commitment. Sharing the QR secret does not allow claim replay or nullifier collision — each unauthorized claimer still submits their own distinct proof. The privacy properties (unlinkability across caches, no identity exposure) are unaffected.

### EAS attestation recipient
The EAS attestation recipient is `msg.sender` (the smart account address). This is required so users can look up their own attestations by address. It creates a weak link: an observer knows the smart account has claimed cache X, but cannot link it to an email/identity without additional data.

---

## Known scaling limits

### getLeaderboard() gas footprint
`getLeaderboard()` iterates the full `_leaderboardNames` array. At ~1000 entries, this approaches the block gas limit and will start reverting for read calls. This is acceptable for EthPrague (expected ≤ a few hundred claims). For post-hackathon production:
- Replace with `getTopN(uint256 n)` with a loop cap
- Or use an off-chain indexer (EAS subgraph, custom event indexer)

### Pimlico free tier
The Pimlico free tier allows ~950 sponsored UserOperations per month. A fully-attended EthPrague with 100 participants each claiming 3 caches = 600 UserOps (joinCache + claimCache). This fits the quota but leaves no buffer. The UI falls back to user-pays-gas silently if the quota is exceeded; see `src/lib/smartAccount.ts`.

### Semaphore group member fetch
`fetchGroupMembers` reads `MemberAdded` events from block 0 via `getLogs`. This works for a fresh testnet contract but will become slow as block depth grows. In production: maintain an off-chain cache of group members and serve via API route.

---

### Donation architecture (v1 vs v2)

`claimCache` is `payable` and will forward `msg.value` to `cacheBeneficiary[cacheId]` — but only if beneficiary is non-zero. If `msg.value > 0` and `cacheBeneficiary == address(0)`, the ETH is silently trapped in the contract with no recovery path. The v1 frontend never sends `msg.value` in `claimCache` (donations are handled as a separate direct transfer post-claim), so this path is never triggered. No claims with `msg.value > 0` have been submitted to the deployed contract. In v2, the contract should `revert` on `msg.value > 0 && cacheBeneficiary[cacheId] == address(0)` to make the invariant explicit.

---

## Out of scope (v1)

- Smart contract upgradeability (intentionally non-upgradeable for demo)
- Front-running attacks (display name is bound to proof at circuit level)
- MEV / transaction reordering (nullifier double-spend prevented by Semaphore + local check)
- Denial of service on Pimlico (fail-open: falls back to user-pays-gas)
- Compromised QR code at physical site (trusted deployer assumption for demo)
