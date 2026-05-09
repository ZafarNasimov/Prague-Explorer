# Prague Explorer — EthPrague 2026

Privacy-first geocaching on Scroll. Find caches at Prague landmarks, prove you were there with a quiz, claim an on-chain attestation — without the contract ever knowing who you are.

---

## Architecture

```
Browser (Next.js 14 + Privy embedded wallet)
    │
    ├── Public map (Leaflet, no login)
    └── Claim flow
            │
            ▼
    Semaphore proof — generated client-side, runs entirely in-browser (~3s)
            │
            ▼
    Scroll Sepolia (zkEVM L2)
        ├── PragueExplorer.sol   — caches, nullifiers, EAS attestation hook
        ├── Semaphore verifier   — deployed once, reused per cache group
        ├── EAS schema           — one attestation per successful claim
        └── Pimlico paymaster    — every tx is gasless for the user
```

### Why these choices

| Decision | Reason |
|---|---|
| Scroll Sepolia | zkEVM L2, full EVM equivalence, EthPrague-aligned |
| Semaphore v4 | Mature ZK protocol; scope = cacheId prevents cross-cache linkability |
| Privy embedded wallets | Email/Google login, no MetaMask required for judges or tourists |
| Pimlico ERC-4337 | Confirmed support for Scroll Sepolia (chain 534351); free tier OK for demo |
| EAS attestations | Composable credentials; users own their proof, not a custodied badge |
| No GPS | Presence proved by QR scan + correct quiz — no geolocation API required |

---

## Tracks & Bounties

| Track / Bounty | How we qualify |
|---|---|
| **Ethereum Core** | Scroll is an Ethereum L2; EAS is Ethereum-native attestation |
| **Network Economy** | Cache beneficiary addresses receive optional donations on claim |
| **Future Society** | Czech history quizzes, local institution donations, Prague cultural layer |
| **Best Privacy by Design** | Semaphore nullifiers; no user address emitted on-chain; display names only |
| **Best UX Flow** | Embedded wallets, gasless, Czech-first i18n, plain-language tx summaries |

---

## Directory Layout

```
/
├── app/              # Next.js 14 frontend (TypeScript, Tailwind, App Router)
├── contracts/        # Foundry project (Solidity 0.8.24)
│   ├── src/          # PragueExplorer.sol
│   ├── test/         # Foundry tests
│   └── script/       # Deploy.s.sol + caches.json
├── scripts/          # Demo tooling (QR printer, setup guide)
├── Cryptocaching-Hedera/   # Original Hedera prototype — frozen, pending deletion
├── .env.example      # Environment variable template
├── .gitignore
├── PRIVACY.md        # Data collection & ZK guarantees (Phase 8)
└── THREAT_MODEL.md   # What the system protects against (Phase 8)
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Foundry | ≥ 1.7 | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |

---

## Quick Start

```bash
# 1. Copy env template and fill in your keys
cp .env.example .env

# 2. Install frontend dependencies
cd app && pnpm install && cd ..

# 3. Compile contracts
cd contracts && forge build && cd ..

# 4. Run local Anvil chain + frontend together (single command — Phase 7)
#    pnpm dev   ← TODO: wire up in Phase 7
```

### Deploy to Scroll Sepolia

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url scroll_sepolia \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify
```

---

## Presence Verification

No GPS. No IP logging. Two factors only:

1. **QR scan** at the physical cache site — each QR encodes a per-cache secret string used as a salt in Semaphore identity derivation. A user who hasn't visited can't complete the proof.
2. **Quiz** — 3 Czech-language questions about the landmark's history. All 3 must be correct.

The Semaphore proof is generated in-browser after both factors pass. The contract sees only a valid proof + nullifier, never the user's wallet address or identity commitment.

---

## Privacy Guarantees

See [`PRIVACY.md`](PRIVACY.md) (generated in Phase 8) for the full breakdown. Short version:

- **What stays client-side:** Semaphore identity, QR secret, Privy user ID
- **What hits the chain:** nullifier (opaque), Merkle root, proof bytes, display name (user-chosen)
- **What the contract learns:** that *someone* with a valid identity claimed cache X — not who
- **Linkability:** nullifiers are scoped per-cache (`scope = cacheId`), so claiming cache A and cache B produces different nullifiers that cannot be correlated on-chain

---

## Known Limitations (v1)

- ENS L2 subname minting skipped — display names stored on-chain, user-chosen, unverified
- "Undo claim" toast is cosmetic — the on-chain attestation is final; the 60-second window suppresses UI display only
- `joinCache` (group membership) is observable — an attacker watching mempool knows *someone* is attempting cache X, but not who

---

## Built with

[Semaphore](https://semaphore.pse.dev/) · [Scroll](https://scroll.io/) · [EAS](https://attest.sh/) · [Privy](https://privy.io/) · [Pimlico](https://pimlico.io/) · [Foundry](https://getfoundry.sh/) · [Next.js](https://nextjs.org/)
