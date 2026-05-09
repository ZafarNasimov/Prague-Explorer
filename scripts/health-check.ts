/**
 * Prague Explorer — pre-demo health check.
 *
 * Hits every external dependency and reports green/red.
 * Run from repo root: cd app && npx tsx ../scripts/health-check.ts
 *
 * Reads app/.env.local automatically — no manual env sourcing required.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load app/.env.local ────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dirname, "../app/.env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local missing — env must come from shell
  }
}

loadEnv();

const RPC   = process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC ?? "https://sepolia-rpc.scroll.io";
const PIMLICO_KEY   = process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? "";
const CONTRACT_ADDR = process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS ?? "";
const SCHEMA_UID    = process.env.NEXT_PUBLIC_EAS_SCHEMA_UID ?? "";
const PRIVY_APP_ID  = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const SEMAPHORE_ADDR = process.env.NEXT_PUBLIC_SEMAPHORE_ADDRESS ?? "";

const EP_07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const CHAIN_ID = 534351;

// ── Known beneficiary addresses (from caches.ts) ─────────────────────────────

const BENEFICIARIES: Record<number, string> = {
  1: "0x7B98698fc5F430b9f4b51691ed78Fe5a805902aB",
  2: "0x8890e8f0D89bec707C99e80Ed4F0e463eb5B8E80",
  3: "0xc8B427BE431bcD3a104070A629523a3b7EA8772c",
  4: "0x5906F65B373Ca0E172C704a05c9736838D7257C0",
  5: "0xd9cbb64461b29751f38Befbc20223181D6e70762",
  6: "0x665eF14222739A667A16198B6b62dc204f1771E4",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type Result = { ok: boolean; detail: string };

function pass(detail: string): Result { return { ok: true, detail }; }
function fail(detail: string): Result { return { ok: false, detail }; }
function skip(detail: string): Result { return { ok: true, detail: `SKIP — ${detail}` }; }

async function rpcCall(url: string, method: string, params: unknown[] = [], timeoutMs = 5000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      signal: ctrl.signal,
    });
    const json = await res.json() as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function encodeUint256(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkRpc(): Promise<Result> {
  try {
    const blockHex = await rpcCall(RPC, "eth_blockNumber") as string;
    const block = parseInt(blockHex, 16);
    const chainHex = await rpcCall(RPC, "eth_chainId") as string;
    const chain = parseInt(chainHex, 16);
    if (chain !== CHAIN_ID) return fail(`wrong chain: got ${chain}, want ${CHAIN_ID}`);
    return pass(`reachable (block ${block.toLocaleString()})`);
  } catch (e) {
    return fail(String(e));
  }
}

async function checkContractDeployed(): Promise<Result> {
  if (!CONTRACT_ADDR) return skip("NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS not set");
  try {
    const code = await rpcCall(RPC, "eth_getCode", [CONTRACT_ADDR, "latest"]) as string;
    if (!code || code === "0x") return fail(`no code at ${CONTRACT_ADDR}`);
    return pass(CONTRACT_ADDR);
  } catch (e) {
    return fail(String(e));
  }
}

async function checkCachesRegistered(): Promise<Result> {
  if (!CONTRACT_ADDR) return skip("NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS not set");
  // Use cacheBeneficiary(uint256) public mapping getter — keccak256 selector 0x1c859169.
  // Public storage reads cannot revert, unlike cacheExists() which reverts on the Scroll Sepolia RPC.
  // Cross-checks the returned address against hardcoded BENEFICIARIES to catch mis-registration.
  const selector = "1c859169";
  const wrong: string[] = [];
  try {
    for (let id = 1; id <= 6; id++) {
      const data = `0x${selector}${encodeUint256(BigInt(id))}`;
      const result = await rpcCall(RPC, "eth_call", [
        { to: CONTRACT_ADDR, data },
        "latest",
      ]) as string;
      // ABI-encoded address: 32 bytes, address occupies the last 20 (40 hex chars).
      const returned = ("0x" + result.slice(-40)).toLowerCase();
      const expected = BENEFICIARIES[id].toLowerCase();
      if (returned !== expected) {
        wrong.push(`cache ${id}: got ${returned.slice(0, 10)}… want ${expected.slice(0, 10)}…`);
      }
    }
    if (wrong.length > 0) return fail(wrong.join("; "));
    return pass(`all 6 registered`);
  } catch (e) {
    return fail(String(e));
  }
}

async function checkPimlico(): Promise<Result> {
  if (!PIMLICO_KEY) return fail("NEXT_PUBLIC_PIMLICO_API_KEY not set");
  const url = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_KEY}`;
  try {
    const result = await rpcCall(url, "pm_supportedEntryPoints", [], 5000) as string[];
    if (!Array.isArray(result)) return fail("unexpected response");
    const supported = result.some(ep => ep.toLowerCase() === EP_07.toLowerCase());
    if (!supported) return fail(`EP 0.7 not in supported list: ${result.join(", ")}`);
    return pass("healthy (EP 0.7 supported)");
  } catch (e) {
    return fail(String(e));
  }
}

async function checkPrivy(): Promise<Result> {
  if (!PRIVY_APP_ID) return fail("NEXT_PUBLIC_PRIVY_APP_ID not set");
  if (!PRIVY_APP_ID.startsWith("clp") && !PRIVY_APP_ID.startsWith("cm")) {
    return fail(`unexpected format: ${PRIVY_APP_ID.slice(0, 8)}… (expected clp… or cm…)`);
  }
  return pass(`configured (${PRIVY_APP_ID.slice(0, 8)}…)`);
}

async function checkEasSchema(): Promise<Result> {
  if (!SCHEMA_UID) return skip("NEXT_PUBLIC_EAS_SCHEMA_UID not set — fill in after deploy");
  if (!SCHEMA_UID.startsWith("0x") || SCHEMA_UID.length !== 66) {
    return fail(`malformed UID: ${SCHEMA_UID}`);
  }
  // Verify it's non-zero
  if (SCHEMA_UID === "0x" + "0".repeat(64)) return fail("UID is zero — schema not registered");
  return pass(SCHEMA_UID.slice(0, 10) + "…");
}

async function checkSemaphore(): Promise<Result> {
  if (!SEMAPHORE_ADDR) return skip("NEXT_PUBLIC_SEMAPHORE_ADDRESS not set — fill in after Semaphore deploy");
  try {
    const code = await rpcCall(RPC, "eth_getCode", [SEMAPHORE_ADDR, "latest"]) as string;
    if (!code || code === "0x") return fail(`no code at ${SEMAPHORE_ADDR}`);
    return pass(SEMAPHORE_ADDR);
  } catch (e) {
    return fail(String(e));
  }
}

function checkBeneficiaries(): Result {
  const allNonZero = Object.values(BENEFICIARIES).every(
    addr => addr && addr !== "0x0000000000000000000000000000000000000000"
  );
  if (!allNonZero) return fail("one or more beneficiary addresses are zero");
  return pass(`6/6 non-zero (demo addresses, private keys discarded)`);
}

// ── Run all checks ────────────────────────────────────────────────────────────

const CHECKS: [string, () => Promise<Result> | Result][] = [
  ["Scroll Sepolia RPC  ", checkRpc],
  ["Contract deployed   ", checkContractDeployed],
  ["Semaphore deployed  ", checkSemaphore],
  ["All 6 caches        ", checkCachesRegistered],
  ["Pimlico paymaster   ", checkPimlico],
  ["Privy app ID        ", checkPrivy],
  ["EAS schema UID      ", checkEasSchema],
  ["Beneficiary addrs   ", checkBeneficiaries],
];

console.log("\nPrague Explorer — Pre-Demo Health Check");
console.log("─".repeat(55));

let failures = 0;
for (const [label, fn] of CHECKS) {
  const { ok, detail } = await fn();
  const icon = ok ? "✓" : "✗";
  const color = ok ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${icon}\x1b[0m  ${label}  ${detail}`);
  if (!ok) failures++;
}

console.log("─".repeat(55));
if (failures === 0) {
  console.log("\x1b[32mAll checks passed. Ready for demo.\x1b[0m\n");
  process.exit(0);
} else {
  console.log(`\x1b[31m${failures} check(s) failed. Fix before demoing.\x1b[0m\n`);
  process.exit(1);
}
