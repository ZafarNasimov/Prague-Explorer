# Prague Explorer — Demo Setup Runbook

> Follow top-to-bottom. Every step is copy-pasteable. No decisions at runtime.
> Time estimate: 35–45 minutes from a clean clone to a live deployment (assumes deployer wallet is pre-funded).
>
> **Shell note:** Steps 2–3 use PowerShell. Steps 4–6 use bash (Git Bash on Windows, or WSL).
> Open a Git Bash terminal before step 4 and keep it open through step 6.

---

## 0. Prerequisites checklist

Run these checks before starting. If any fail, stop and fix them.

```powershell
node --version        # must be 18.x or higher
pnpm --version        # any recent version
cast --version        # Foundry 1.7.x
```

Accounts needed (create all before demo day):
- [ ] **Privy**: https://console.privy.io → new app → copy App ID
- [ ] **Scrollscan**: https://scrollscan.com → register → API Keys → create key (free)

### ETH amounts needed on Scroll Sepolia

| Wallet | Amount | Purpose |
|---|---|---|
| Deployer | **2+ ETH** | Contract deployment + cache registrations + EAS schema + auto-funding ~100 users × 0.002 ETH. Faucet: https://sepolia-faucet.scroll.io |
| Demo user (1 per tester) | **0 ETH** | Wallet is auto-funded by the deployer on first login. |
| 6 beneficiary wallets | **0 ETH** | Receive-only demo addresses. No funding needed. |

---

## 1. Clone and install

```bash
git clone <repo-url> EthPrague2026
cd EthPrague2026
cd app && pnpm install && cd ..
```

---

## 2. Generate QR secrets

Run once only. Regenerating after printing invalidates all physical QR codes.

```powershell
.\scripts\generate-qr-secrets.ps1
```

**Record the 4-character previews printed to the terminal.** You'll verify them against the print page in step 7.

If you already ran this on a previous session, the script will refuse to overwrite. That's correct — do not use `-Force` unless you are reprinting all 6 QR codes.

---

## 3. Configure environment

```powershell
Copy-Item .env.example .env
Copy-Item .env.example app\.env.local
```

Edit `.env` with all values (used by Foundry deploy scripts):

```env
NEXT_PUBLIC_SCROLL_SEPOLIA_RPC=https://sepolia-rpc.scroll.io
NEXT_PUBLIC_PRIVY_APP_ID=<from console.privy.io>
DEPLOYER_PRIVATE_KEY=<deployer wallet private key — never commit>
DEPLOYER_ADDRESS=<deployer wallet address>
SCROLLSCAN_API_KEY=<from scrollscan.com>

# Leave blank for now — filled in after deploy:
NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS=
NEXT_PUBLIC_EAS_SCHEMA_UID=
NEXT_PUBLIC_SEMAPHORE_ADDRESS=
```

Edit `app/.env.local` with the `NEXT_PUBLIC_*` vars and the deployer vars (used by the `/api/fund-wallet` server route):

```env
NEXT_PUBLIC_SCROLL_SEPOLIA_RPC=https://sepolia-rpc.scroll.io
NEXT_PUBLIC_PRIVY_APP_ID=<same as above>
DEPLOYER_PRIVATE_KEY=<same deployer private key — server-side only, never shipped to browser>
DEPLOYER_ADDRESS=<deployer wallet address>

# Leave blank until after deploy:
NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS=
NEXT_PUBLIC_EAS_SCHEMA_UID=
NEXT_PUBLIC_SEMAPHORE_ADDRESS=
```

---

## 4. Deploy Semaphore v4

> ⚠ Run this step in Git Bash, not PowerShell.

Run in **Git Bash**. The Semaphore CLI reads `PRIVATE_KEY` (not `DEPLOYER_PRIVATE_KEY`):

```bash
# From repo root, in Git Bash
export PRIVATE_KEY=<your deployer private key>

cd app
pnpm dlx @semaphore-protocol/cli@latest deploy --network scroll-sepolia 
cd ..
```

The command prints a `SEMAPHORE_ADDRESS=0x...` line. Copy it. Deploy skipped

Add to `.env` (both vars — Foundry reads the unprefixed one, frontend reads the prefixed one):
```env
SEMAPHORE_ADDRESS=0x...
NEXT_PUBLIC_SEMAPHORE_ADDRESS=0x...
```

Add to `app/.env.local`:
```env
NEXT_PUBLIC_SEMAPHORE_ADDRESS=0x...
```

> **If the Semaphore CLI fails for Scroll Sepolia:** the Semaphore repo at
> https://github.com/semaphore-protocol/semaphore has a `deploy` Hardhat task.
> Run `npx hardhat deploy --network scroll-sepolia` from the semaphore repo root.
> The SEMAPHORE_ADDRESS is the address of the `Semaphore` contract (not the verifier).
> The `PRIVATE_KEY` env var applies there too.

---

## 5. Deploy PragueExplorer

> ⚠ Run this step in Git Bash, not PowerShell.

```bash
# Load env vars into the current bash session
set -a; source .env; set +a

cd contracts

forge script script/Deploy.s.sol:Deploy \
  --rpc-url scroll_sepolia \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  -vvvv
```

Expected terminal output at the end:
```
---------------------------------------------
Deployment complete. Add to .env:
NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS= 0x<address>
NEXT_PUBLIC_EAS_SCHEMA_UID= 0x<bytes32>
---------------------------------------------
```

Add both values to `.env` and `app/.env.local`.

### If --verify fails

Run separately after the deploy broadcast completes:

```bash
forge verify-contract $NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS \
  src/PragueExplorer.sol:PragueExplorer \
  --chain 534351 \
  --etherscan-api-key $SCROLLSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address)" \
    $SEMAPHORE_ADDRESS \
    0xaEF4103A04090071165F78D45D83A0C0782c2B2a)
```

Check verification at:
`https://sepolia-blockscout.scroll.io/address/<CONTRACT_ADDRESS>`

---

## 6. Run the health check — all green before continuing

> ⚠ Run this step in Git Bash, not PowerShell.

```bash
cd app && npx tsx ../scripts/health-check.ts
```

Expected output:
```
✓  Scroll Sepolia RPC    reachable (block 1,234,567)
✓  Contract deployed     0x...
✓  Semaphore deployed    0x...
✓  All 6 caches          all 6 registered
✓  Deployer balance      0.5000 ETH
✓  Privy app ID          configured (clp12345…)
✓  EAS schema UID        0x1a2b3c4d…
✓  Beneficiary addrs     6/6 non-zero (demo addresses, private keys discarded)
```

**Do not proceed to step 7 until all checks are green.** If any check fails, fix it now.

---

## 7. Print QR codes

Serve the scripts directory:

```bash
cd <repo-root>
npx serve scripts/
```

Open http://localhost:3000/print-qrs.html in Chrome.

**Verify**: the 4-character previews shown on screen match those from step 2.

Print: `Ctrl+P` → Paper size: A4 → Margins: None → Scale: 100% → **Print**.

One page per cache site. Laminate if possible — outdoor placement means weather exposure.

Place at each site before the demo starts. Suggested placement: fixed to a wall or sign at eye level, QR code facing outward.

---

## 8. Smoke test — do not skip any substep

**8.1** Start the app locally:
```bash
cd app && pnpm dev
```

**8.2** Open http://localhost:3000/en in a **private browsing window** (fresh Privy session — do not reuse an account that already claimed).

**8.3** Full claim flow for Cache 1:
1. Log in with a new email address
2. Navigate to Cache 1 (Vyšehrad) via the map or `/en/cache/1`
3. Open `scripts/qr-secrets.json`, find `caches[0].qrValue` (looks like `1:a3f7c2...`). Paste that exact string into the manual code entry field. If the value doesn't start with a number followed by a colon, you're looking at the wrong field — `qrSecret` is the raw secret, `qrValue` is what the QR encodes.
4. Answer the 3 quiz questions
5. Wait for ZK proof generation (3–10 seconds; "Still working" message is normal on mobile)
6. Click **Confirm** on the confirm screen
7. Wait for submission (wallet pays gas from the pre-funded balance)
8. Verify success screen shows "Vyšehrad Fortress" and the green checkmark

**8.4 Donation flow — DO NOT SKIP even if pressed for time.**
This is the "value flowing to Prague institutions" story for the Future Society track.
If it breaks during judging, it will be noticed.

1. On the success screen, enter `0.001` in the tip amount input
2. Click **Send 0.001 ETH**
3. Approve in the Privy wallet popup
4. Confirm a Scrollscan link appears on the success screen
5. Open the link and verify the ETH arrived at `0x7B98698fc5F430b9f4b51691ed78Fe5a805902aB` (Správa Vyšehrad)

**8.5** Profile attestation:
1. Navigate to `/en/profile`
2. Confirm "Vyšehrad Fortress" appears with today's date

**8.6** Leaderboard:
1. Navigate to `/en/leaderboard`
2. Confirm your display name appears with count 1

If any substep fails, stop and debug before proceeding.

---

## 9. Deployer balance — monitor during the event

The deployer auto-funds each new embedded wallet with **0.002 ETH** on first login (capped at 100 wallets total, 1 fund per address per hour).

**Budget math for EthPrague:**
- 100 attendees × 0.002 ETH = 0.2 ETH for auto-funding
- Add deployment costs + registration gas: ~0.05 ETH
- Recommended deployer balance before the event: **≥ 0.5 ETH**

**If the deployer runs low mid-event:** the `/api/fund-wallet` route returns `deployer_low` and users may not receive auto-funding. Users who already received funding (localStorage guard `pe:funding-tried:{address}`) are unaffected. Top up the deployer wallet via faucet or a transfer from another wallet.

---

## 10. Pre-demo final check — Sunday morning, 5 minutes

Run in this order. Should take under 5 minutes.

```bash
cd app && npx tsx ../scripts/health-check.ts
```

Then manually verify:

- [ ] http://localhost:3000/en loads without console errors
- [ ] Map renders with all 6 cache markers visible
- [ ] Navigating to `/en/cache/1` shows the QR scan screen
- [ ] Profile page loads (attestation list, even if empty)
- [ ] Leaderboard loads and shows your test claim from step 8
- [ ] Backup demo video plays on this device (step 11)

If any item fails, fix it now. Do not start the demo with a known broken state.

---

## 11. Backup demo video plan

Record **Saturday night** after step 8 succeeds. A 90-second recording of the exact thing you just tested.

### What to record (target: 90 seconds total)

| Segment | Content | Duration |
|---|---|---|
| 1 | Open map — show all 6 cache markers | 5 s |
| 2 | Navigate to Cache 1, enter QR code manually | 10 s |
| 3 | Answer quiz questions | 10 s |
| 4 | Watch ZK proof generate — narrate: *"running privately in the browser"* | 10 s |
| 5 | Click Confirm — narrate: *"wallet was pre-funded, no action from user"* | 5 s |
| 6 | Success screen | 5 s |
| 7 | Profile — show the on-chain attestation | 10 s |
| 8 | Leaderboard — show name appearing | 5 s |
| 9 | Donation tip — enter amount, send, show Scrollscan tx | 15 s |
| 10 | Closing: *"ZK proof of location. Claim is free. Donation goes to the institution."* | 15 s |

### Format and storage

- Format: MP4, 1080p, 30fps
- Filename: `docs/demo-backup-YYYYMMDD.mp4` (gitignored — do not commit a 100MB video)
- Upload a copy to Google Drive or Dropbox as insurance against laptop issues

### Verify before Sunday

Open the file on the demo laptop in Windows Media Player or VLC. Confirm:
- Audio plays
- Playback does not stutter
- The Scrollscan transaction link is visible in the recording

### If the live demo fails mid-presentation

Say: *"Let me show you the recording from last night's test run."* Play it without apologizing. Judges see demos fail constantly; how you recover is part of the evaluation. A backup video that runs clean is better than a live demo that hangs.

---

## Appendix — Key addresses

| Item | Address / Value |
|---|---|
| Scroll Sepolia chain ID | 534351 |
| EAS contract | `0xaEF4103A04090071165F78D45D83A0C0782c2B2a` |
| EAS Schema Registry | `0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797` |
| Vyšehrad beneficiary | `0x7B98698fc5F430b9f4b51691ed78Fe5a805902aB` |
| Národní třída beneficiary | `0x8890e8f0D89bec707C99e80Ed4F0e463eb5B8E80` |
| Staroměstské nám. beneficiary | `0xc8B427BE431bcD3a104070A629523a3b7EA8772c` |
| Žižkov TV Tower beneficiary | `0x5906F65B373Ca0E172C704a05c9736838D7257C0` |
| Letná beneficiary | `0xd9cbb64461b29751f38Befbc20223181D6e70762` |
| Museum Kampa beneficiary | `0x665eF14222739A667A16198B6b62dc204f1771E4` |

Beneficiary addresses: demo-only receive addresses generated 2026-05-08, private keys discarded. Represent Prague cultural institutions pending live partnership outreach.
