// POST /api/fund-wallet
// Funds a fresh embedded wallet with 0.002 ETH from the deployer so users can pay
// gas on Scroll Sepolia without any ERC-4337 paymaster complexity.
//
// SECURITY: DEPLOYER_PRIVATE_KEY is server-side only. This file must never be
// imported by any client bundle. Verify with: grep -r DEPLOYER_PRIVATE_KEY .next/static/

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  parseEther,
} from "viem";
import { scrollSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const FUND_AMOUNT = parseEther("0.002");
const MIN_RECIPIENT_BALANCE = parseEther("0.0005"); // skip if already has enough
const MIN_DEPLOYER_BALANCE = parseEther("0.005");   // warn below this

// ── In-memory rate limits (reset on server restart — fine for hackathon) ──────

const lastFundedAt = new Map<string, number>(); // normalised address → epoch ms
const RATE_LIMIT_MS = 60 * 60 * 1000;          // 1 fund per address per hour
let totalFunded = 0;
const MAX_TOTAL_FUNDS = 100;                    // hard cap for the server lifetime

// ── Module-level init log — fires once when the route is first imported ────────

const rawKeyInit = process.env.DEPLOYER_PRIVATE_KEY ?? "";
console.log("[FUND-API][module-init]", {
  hasDeployerKey: !!rawKeyInit,
  deployerKeyPreview: rawKeyInit
    ? rawKeyInit.slice(0, 4) + "…" + rawKeyInit.slice(-4)
    : "(not set)",
  hasRpc: !!process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC,
  rpcUrl: process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC ?? "(not set — will use public fallback)",
});

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log("[FUND-API][request-received]", {
    method: req.method,
    url: req.url,
    totalFunded,
    rateLimitMapSize: lastFundedAt.size,
  });

  try {
    const body = (await req.json()) as { address?: unknown };
    console.log("[FUND-API][body-parsed]", body);

    const raw = body?.address;

    if (typeof raw !== "string" || !isAddress(raw)) {
      console.log("[FUND-API][address-invalid] raw value:", raw);
      return NextResponse.json({ funded: false, reason: "invalid_address" }, { status: 400 });
    }

    const address = raw as `0x${string}`;
    const key = address.toLowerCase();
    console.log("[FUND-API][address-valid]", address);

    // Rate limit: per address
    const last = lastFundedAt.get(key);
    const msAgo = last ? Date.now() - last : null;
    console.log("[FUND-API][rate-limit-check]", {
      address,
      lastFundedMsAgo: msAgo,
      rateLimitMs: RATE_LIMIT_MS,
      totalFunded,
      maxTotalFunds: MAX_TOTAL_FUNDS,
    });

    if (last && Date.now() - last < RATE_LIMIT_MS) {
      console.log("[FUND-API][rate-limited] per-address cooldown active, returning rate_limited");
      return NextResponse.json({ funded: false, reason: "rate_limited" });
    }

    if (totalFunded >= MAX_TOTAL_FUNDS) {
      console.log("[FUND-API][rate-limited] global cap reached, returning rate_limited");
      return NextResponse.json({ funded: false, reason: "rate_limited" });
    }

    const rpc = process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC ?? "https://sepolia-rpc.scroll.io";
    const transport = http(rpc);
    const publicClient = createPublicClient({ chain: scrollSepolia, transport });

    // Skip if recipient already has enough ETH
    const recipientBalance = await publicClient.getBalance({ address });
    console.log("[FUND-API][recipient-balance]", {
      address,
      balanceWei: recipientBalance.toString(),
      balanceEth: formatEther(recipientBalance),
      thresholdEth: formatEther(MIN_RECIPIENT_BALANCE),
      willSkip: recipientBalance >= MIN_RECIPIENT_BALANCE,
    });

    if (recipientBalance >= MIN_RECIPIENT_BALANCE) {
      console.log("[FUND-API][already-funded] returning already_has_balance");
      return NextResponse.json({ funded: false, reason: "already_has_balance" });
    }

    // Deployer setup
    const rawKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!rawKey) {
      console.error("[FUND-API][deployer-key-missing] DEPLOYER_PRIVATE_KEY not set — returning internal_error");
      return NextResponse.json({ funded: false, reason: "internal_error" }, { status: 500 });
    }
    const privKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const deployerAccount = privateKeyToAccount(privKey);
    console.log("[FUND-API][deployer-account]", { deployerAddress: deployerAccount.address });

    // Guard: deployer must have enough to fund + keep a reserve
    const deployerBalance = await publicClient.getBalance({ address: deployerAccount.address });
    console.log("[FUND-API][deployer-balance]", {
      deployerAddress: deployerAccount.address,
      balanceWei: deployerBalance.toString(),
      balanceEth: formatEther(deployerBalance),
      floorEth: formatEther(MIN_DEPLOYER_BALANCE),
      willBlock: deployerBalance < MIN_DEPLOYER_BALANCE,
    });

    if (deployerBalance < MIN_DEPLOYER_BALANCE) {
      console.warn("[FUND-API][deployer-low] balance below floor — returning deployer_low");
      return NextResponse.json({ funded: false, reason: "deployer_low" });
    }

    // Send
    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: scrollSepolia,
      transport,
    });

    console.log("[FUND-API][sending-tx]", {
      from: deployerAccount.address,
      to: address,
      valueWei: FUND_AMOUNT.toString(),
      valueEth: formatEther(FUND_AMOUNT),
    });

    const hash = await walletClient.sendTransaction({ to: address, value: FUND_AMOUNT });
    console.log("[FUND-API][tx-sent]", { txHash: hash });

    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    console.log("[FUND-API][tx-confirmed]", {
      txHash: receipt.transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber?.toString(),
    });

    lastFundedAt.set(key, Date.now());
    totalFunded++;
    console.log("[FUND-API][funded-ok]", { address, txHash: hash, totalFunded });

    return NextResponse.json({
      funded: true,
      txHash: hash,
      amountWei: FUND_AMOUNT.toString(),
    });
  } catch (err) {
    const e = err as Error & { cause?: unknown };
    console.error("[FUND-API][error]", {
      name: e?.name,
      message: e?.message,
      cause: e?.cause,
      stack: e?.stack,
    });
    return NextResponse.json({ funded: false, reason: "internal_error" }, { status: 500 });
  }
}
