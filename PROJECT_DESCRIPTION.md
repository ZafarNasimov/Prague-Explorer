# Cryptocaching-Hedera — EthPrague 2026

## What It Is

A blockchain-based geocaching game built for the EthPrague 2026 hackathon. Players find physical cache locations, answer knowledge quizzes to prove they were there, and claim NFT rewards on the Hedera blockchain. The system uses Poseidon cryptographic hashing for progressive verification and Hedera Token Service (HTS) smart contracts for NFT ownership transfers.

---

## Architecture Overview

```
User Browser
    │
    ▼
Flask Web App (Python, port 5000)          ← map, auth, quizzes, UI
    │
    │ POST /execute-claim
    ▼
Express.js API Server (Node.js, port 7546) ← Hedera SDK bridge
    │
    ▼
Hedera Testnet
    ├─ TokenTransferContract (Solidity)     ← secret-based NFT claims
    └─ Hedera Token Service (HTS)          ← NFT creation & transfers
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Web UI | Flask 2.0.1, Jinja2 templates, Bootstrap 5.1.3, Leaflet.js 1.7.1 |
| Database | SQLite via Flask-SQLAlchemy 1.4.23 |
| Auth | Flask-Login, Werkzeug password hashing |
| Cryptography | py_ecc 6.0.0 (Poseidon hash over BN128 field) |
| Backend API | Node.js, Express.js 4.21.2, CORS |
| Blockchain SDK | @hashgraph/sdk 2.60.1 |
| Smart Contracts | Solidity 0.8.0, compiled at runtime with solc 0.8.28 |
| Blockchain Network | Hedera Testnet |

---

## Directory Structure

```
EthPrague2026/
└── Cryptocaching-Hedera/
    ├── server.js              # Express bridge server (port 7546)
    ├── config.js              # Hedera SDK client + account config
    ├── package.json
    ├── .env.sample            # Required environment variables template
    ├── demo-config.json       # Generated: token IDs, contract ID, secrets
    │
    ├── contracts/
    │   ├── TokenTransferContract.sol   # Core NFT claim logic
    │   ├── HederaTokenService.sol      # Hedera precompile interface
    │   └── HederaResponseCodes.sol     # Error code constants
    │
    ├── lib/
    │   ├── contractUtils.js   # Compile, deploy, interact with contracts
    │   └── tokenUtils.js      # Create/mint/associate/query HTS tokens
    │
    ├── demo/
    │   ├── setupDemo.js       # One-time: create tokens, deploy contract, set secrets
    │   └── claimDemo.js       # Runtime: verify secret + transfer NFT
    │
    ├── web/
    │   ├── claimToken.js      # Web-friendly claim wrapper
    │   └── viewTokens.js      # Token info for UI display
    │
    └── front/
        ├── app.py             # Flask application
        ├── requirements.txt
        ├── geocaching.db      # SQLite database (auto-created)
        └── templates/
            ├── base.html
            ├── index.html              # Interactive map
            ├── cache_detail.html       # Cache info page
            ├── test.html               # Quiz verification
            ├── login.html
            ├── register.html
            ├── add_cache.html          # Admin: create cache
            ├── verification_success.html
            └── verification_failure.html
```

---

## Smart Contracts

### TokenTransferContract.sol

The core contract managing secret-based NFT ownership claims.

**State:**
- `tokenSecrets`: mapping `(tokenId, serial)` → `bytes32` keccak256 hash of secret
- `tokenOwners`: mapping `(tokenId, serial)` → Hedera account address

**Functions:**

| Function | Description |
|---|---|
| `registerTokenOwner(tokenId, serial, owner)` | Register initial NFT owner |
| `setTokenSecret(tokenId, serial, secretHash)` | Owner sets hashed secret |
| `verifySecret(tokenId, serial, secret)` | Check if secret is correct (no transfer) |
| `claimTokenWithSecret(tokenId, serial, secret)` | Verify secret and transfer NFT to caller |
| `cryptoTransferToken(...)` | Internal: execute HTS NFT transfer |

**Events:** `SecretSet`, `SecretVerified`, `TokenClaimed`, `ClaimFailed`

**Error codes on ClaimFailed:**
- `1` — Secret not set
- `2` — Incorrect secret
- `3` — Owner not registered
- Hedera response code — Transfer failed

### HederaTokenService.sol

Interface to Hedera's precompile at `0x0000000000000000000000000000000167`. Handles the actual on-chain NFT transfer.

### HederaResponseCodes.sol

Constants library: `SUCCESS (0)`, `INVALID_TOKEN_ID (150)`, `TRANSFER_FAILED (163)`, etc.

---

## Backend (Node.js)

### config.js

Configures the Hedera SDK client from environment variables:
- `OPERATOR_ACCOUNT_ID` / `OPERATOR_ACCOUNT_PRIVATE_KEY`
- `ACCOUNT_0`, `ACCOUNT_1`, `ACCOUNT_2` with their private keys
- `RPC_URL` for the Hedera JSON-RPC endpoint
- Default gas limit: 200,000

### server.js

Express server on port 7546. CORS is locked to `http://127.0.0.1:5000` (Flask only).

Routes:
- `POST /claim` — run `claimDemo.js` and return result
- `POST /claimDemo` — alternative claim endpoint

### lib/contractUtils.js

- `compileContract()` — compile `.sol` files with solc at runtime
- `deployContract()` — deploy compiled bytecode to Hedera testnet
- `registerTokenOwner()`, `setTokenSecret()`, `verifySecret()`, `claimTokenWithSecret()` — contract interaction wrappers

### lib/tokenUtils.js

- `createNftToken()` — create a new HTS NFT token
- `mintNft()` — mint with metadata
- `associateTokenWithAccount()` — associate before transfer (Hedera requirement)
- `getTokenBalances()` — query balances
- `getNftMetadata()` — retrieve NFT metadata

### demo/setupDemo.js

Run once to bootstrap the demo environment:
1. Create 3 NFT tokens on Hedera testnet
2. Mint one NFT per token
3. Associate tokens with 3 test accounts
4. Compile and deploy `TokenTransferContract`
5. Register owners and set secrets: `"SECRET_1"`, `"SECRET_2"`, `"SECRET_3"`
6. Save all IDs and secrets to `demo-config.json`

### demo/claimDemo.js

Runtime claim execution:
1. Load `demo-config.json`
2. Check initial NFT balances
3. Verify provided secret against contract
4. Transfer NFT if secret matches
5. Check final balances
6. Return JSON result to Express server

---

## Frontend (Flask)

### Database Models

```
User          id, username, password_hash, is_admin
Cache         id, name, description, latitude, longitude, current_hash
Test          id, cache_id, question, option_a, option_b, option_c, answer
Verification  id, user_id, cache_id, verified
```

### Routes

| Route | Description |
|---|---|
| `GET /` | Home — interactive Leaflet map with cache markers |
| `GET/POST /register` | User registration |
| `GET/POST /login` | Login |
| `GET /logout` | Logout |
| `GET /cache/<id>` | Cache detail page |
| `GET /verify/<id>` | Serve a random quiz question for the cache |
| `POST /submit_test/<id>` | Check answer; record verification if correct |
| `GET /success` | Success page showing user_id and current_hash |
| `GET /failure` | Failure page |
| `GET/POST /add_cache` | Admin: add a cache with 3 quiz questions |
| `POST /execute-claim` | Proxy claim request to Node.js at localhost:7546 |

### Key Logic

**Poseidon Hash Chain**

On each successful cache verification:
```python
poseidon_hash(user_id, prev_hash)  # BN128 field arithmetic
```
The hash accumulates across all cache verifications, forming a chain that proves the user visited caches in order. The current hash is shown on the success page and submitted to the smart contract as the claim secret.

**Verification Flow**
1. User visits cache page
2. One-time verification per (user, cache) pair — stored in `Verification` table
3. Correct quiz answer → hash updated → success page
4. Wrong answer → failure page

**Auto-seeding**
On first run, Flask auto-creates:
- Admin user (`admin` / `admin`)
- One test cache with 3 sample quiz questions

---

## End-to-End User Flow

```
1.  Admin creates a cache (location + 3 quiz questions)
2.  User registers and logs in
3.  User views interactive map → clicks a cache marker
4.  User reads cache description → clicks "Verify Cache"
5.  User answers a random quiz question
6.  Correct → Verification recorded in DB
             → Poseidon hash updated: H_new = poseidon(user_id, H_old)
             → Success page shows user_id + H_new
7.  User clicks "Claim Smart Contract"
8.  Flask POSTs to Express at localhost:7546
9.  Express runs claimDemo.js
10. Contract verifies secret hash → transfers NFT to user's Hedera account
11. Flask displays claim success/failure
```

---

## Environment Variables (.env)

```
OPERATOR_ACCOUNT_ID=
OPERATOR_ACCOUNT_PRIVATE_KEY=

ACCOUNT_0=
ACCOUNT_0_PRIVATE_KEY=

ACCOUNT_1=
ACCOUNT_1_PRIVATE_KEY=

ACCOUNT_2=
ACCOUNT_2_PRIVATE_KEY=

RPC_URL=
```

---

## Running the Project

**Install backend dependencies:**
```bash
npm install
```

**Install frontend dependencies:**
```bash
cd front
pip install -r requirements.txt
```

**Bootstrap the demo (run once):**
```bash
node demo/setupDemo.js
```

**Start the Express server:**
```bash
node server.js
```

**Start the Flask frontend:**
```bash
cd front
python app.py
```

Access the app at `http://127.0.0.1:5000`.

---

## Key Design Decisions

- **Hedera over Ethereum**: Uses Hedera Token Service natively instead of ERC-721; token association is mandatory before transfer.
- **Secret-based claims**: NFTs are not transferred by wallet address alone — the claimer must know the secret set by the cache owner, linking physical presence (quiz verification) to blockchain ownership.
- **Poseidon hashing**: Uses BN128-friendly Poseidon hash (instead of SHA-256) to produce values compatible with potential future ZK-proof circuits.
- **Dual-server architecture**: Flask handles UI/auth; Node.js handles Hedera SDK calls (no Python Hedera SDK with equivalent feature coverage).
- **SQLite for simplicity**: Appropriate for a hackathon — single-file database, no server required.
