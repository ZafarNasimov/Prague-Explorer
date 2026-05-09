"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { scrollSepolia } from "viem/chains";
import type { EIP1193Provider } from "viem";
import { QrScanner } from "@/components/QrScanner";
import { getCacheById, getCacheName } from "@/lib/caches";
import { deriveIdentity, generateCacheProof } from "@/lib/semaphore";
import type { SemaphoreProof } from "@semaphore-protocol/proof";
import {
  mapContractError,
  sendDirectDonation,
  submitClaim,
  submitJoinCache,
  readCacheGroupId,
} from "@/lib/contract";
import { fetchGroupMembers, readSemaphoreAddress } from "@/lib/group";
import { checkPaymasterHealth } from "@/lib/smartAccount";

type Step =
  | "scan"
  | "quiz"
  | "proving"
  | "confirm"
  | "submitting"
  | "success"
  | "error";

interface FlowState {
  step: Step;
  qrSecret: string;
  currentQuestion: number;
  wrongAnswer: boolean;
  proof: SemaphoreProof | null;
  displayName: string;
  errorKey: string;
  scanError: string; // inline message shown in the scan step (wrong QR, etc.)
  undoVisible: boolean;
}

const INITIAL: FlowState = {
  step: "scan",
  qrSecret: "",
  currentQuestion: 0,
  wrongAnswer: false,
  proof: null,
  displayName: "",
  errorKey: "",
  scanError: "",
  undoVisible: false,
};

export default function CachePage() {
  const params = useParams();
  const cacheId = Number(params.id);
  const locale = useLocale();
  const t = useTranslations();
  const { user, login, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [state, setState] = useState<FlowState>(INITIAL);
  const [provingTooLong, setProvingTooLong] = useState(false);
  const [paymasterHealthy, setPaymasterHealthy] = useState<boolean | null>(null);
  const [donationEth, setDonationEth] = useState("");
  const [donating, setDonating] = useState(false);
  const [donateTxHash, setDonateTxHash] = useState("");
  const [donateError, setDonateError] = useState("");
  const provingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cache = getCacheById(cacheId);
  const cacheName = cache ? getCacheName(cache, locale) : `Cache ${cacheId}`;

  // ── QR validation ──────────────────────────────────────────────────────────

  function handleQrResult(raw: string) {
    // QR format: "{cacheId}:{secret}"  e.g. "1:abc123def456"
    // Manual entry may omit the prefix; treat bare text as the secret directly.
    const colonIdx = raw.indexOf(":");
    if (colonIdx === -1) {
      setState((s) => ({ ...s, step: "quiz", qrSecret: raw }));
      return;
    }
    const scannedId = Number(raw.slice(0, colonIdx));
    const secret = raw.slice(colonIdx + 1);
    if (scannedId !== cacheId) {
      const wrongCache = getCacheById(scannedId);
      const hint = wrongCache ? getCacheName(wrongCache, locale) : String(scannedId);
      setState((s) => ({
        ...s,
        scanError: t("cache.wrongQrFor", { cacheName: hint }),
      }));
      return;
    }
    setState((s) => ({ ...s, step: "quiz", qrSecret: secret }));
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────

  function handleAnswer(optionIndex: number) {
    if (!cache) return;
    const q = cache.quiz[state.currentQuestion];
    if (optionIndex !== q.answer) {
      setState((s) => ({ ...s, wrongAnswer: true }));
      return;
    }
    const nextQ = state.currentQuestion + 1;
    if (nextQ < cache.quiz.length) {
      setState((s) => ({ ...s, currentQuestion: nextQ, wrongAnswer: false }));
    } else {
      setState((s) => ({ ...s, step: "proving", wrongAnswer: false }));
    }
  }

  // ── Post-claim donation ────────────────────────────────────────────────────

  async function handleDonate() {
    if (!donationEth || !cache?.beneficiary) return;
    setDonating(true);
    setDonateError("");
    try {
      const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
      if (!embeddedWallet) throw new Error("no wallet");
      const provider = (await embeddedWallet.getEthereumProvider()) as EIP1193Provider;
      const hash = await sendDirectDonation(
        provider,
        embeddedWallet.address as `0x${string}`,
        cache.beneficiary as `0x${string}`,
        donationEth
      );
      setDonateTxHash(hash);
    } catch {
      setDonateError(t("cache.donateError"));
    } finally {
      setDonating(false);
    }
  }

  // ── Proving ────────────────────────────────────────────────────────────────
  // joinCache fires HERE (proving step, not confirm) because ZK proof
  // generation requires the identity commitment to be in the on-chain Merkle
  // tree before the proof can be verified by the contract.
  // Users who abandon after the quiz never appear on-chain.

  useEffect(() => {
    if (state.step !== "proving") return;

    setProvingTooLong(false);
    provingTimer.current = setTimeout(() => setProvingTooLong(true), 8000);

    async function runProving() {
      try {
        if (!user?.id) throw new Error("not authenticated");
        const privyUserId = user.id;

        const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
        if (!embeddedWallet) throw new Error("no embedded wallet");

        // Silent network switch — embedded wallets stay on the configured chain,
        // but we call switchChain defensively for external-wallet edge cases.
        try {
          await embeddedWallet.switchChain(scrollSepolia.id);
        } catch { }

        const provider = (await embeddedWallet.getEthereumProvider()) as EIP1193Provider;
        const walletAddress = embeddedWallet.address as `0x${string}`;

        const identity = await deriveIdentity(privyUserId, state.qrSecret);

        const groupId = await readCacheGroupId(BigInt(cacheId));
        const semaphoreAddress = await readSemaphoreAddress(
          process.env.NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS as `0x${string}`
        );

        const existingMembers = await fetchGroupMembers(semaphoreAddress, groupId);
        const alreadyJoined = existingMembers.some((m) => m === identity.commitment);

        if (!alreadyJoined) {
          await submitJoinCache(provider, walletAddress, BigInt(cacheId), identity.commitment);
        }

        const groupMembers = alreadyJoined
          ? existingMembers
          : [...existingMembers, identity.commitment];

        // Display name is fixed before proof generation because the message
        // baked into the circuit is keccak256(displayName) >> 8.
        const storedName =
          typeof window !== "undefined"
            ? (localStorage.getItem("prague-explorer:displayName") ?? "")
            : "";
        const displayName = storedName || "Explorer";

        const proof = await generateCacheProof(
          privyUserId,
          state.qrSecret,
          groupMembers,
          BigInt(cacheId),
          displayName
        );

        setState((s) => ({ ...s, step: "confirm", proof, displayName }));
      } catch (err) {
        setState((s) => ({
          ...s,
          step: "error",
          errorKey: mapContractError(err),
        }));
      } finally {
        if (provingTimer.current) clearTimeout(provingTimer.current);
      }
    }

    runProving();

    return () => {
      if (provingTimer.current) clearTimeout(provingTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // ── Paymaster health check ─────────────────────────────────────────────────
  // Runs once when the confirm step is entered so we can warn the user if
  // gas sponsorship is unavailable before they hit Confirm.

  useEffect(() => {
    if (state.step !== "confirm") return;
    checkPaymasterHealth().then(setPaymasterHealthy);
  }, [state.step]);

  // ── Submitting ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.step !== "submitting") return;

    async function runSubmit() {
      try {
        const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
        if (!embeddedWallet || !state.proof) throw new Error("missing wallet or proof");

        const provider = (await embeddedWallet.getEthereumProvider()) as EIP1193Provider;
        await submitClaim(provider, embeddedWallet.address as `0x${string}`, {
          cacheId: BigInt(cacheId),
          proof: state.proof,
          displayName: state.displayName,
        });

        setState((s) => ({ ...s, step: "success", undoVisible: true }));
        undoTimer.current = setTimeout(
          () => setState((s) => ({ ...s, undoVisible: false })),
          60_000
        );
      } catch (err) {
        setState((s) => ({
          ...s,
          step: "error",
          errorKey: mapContractError(err),
        }));
      }
    }

    runSubmit();

    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!cache) {
    return (
      <PageShell cacheName={`Cache ${cacheId}`}>
        <p className="text-zinc-400">Cache {cacheId} not found.</p>
      </PageShell>
    );
  }

  // Auth gate — shown before any step if the user is not logged in
  if (!authenticated) {
    return (
      <PageShell cacheName={cacheName}>
        <p className="mb-6 text-sm text-zinc-400">{t("cache.scanPrompt")}</p>
        <button
          onClick={() => login()}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white"
        >
          {locale === "cs" ? "Přihlásit se pro pokračování" : "Log in to continue"}
        </button>
      </PageShell>
    );
  }

  if (state.step === "scan") {
    return (
      <PageShell cacheName={cacheName}>
        <p className="mb-4 text-sm text-zinc-400">{t("cache.scanPrompt")}</p>
        {state.scanError && (
          <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {state.scanError}
          </p>
        )}
        <QrScanner
          onResult={(v) => {
            setState((s) => ({ ...s, scanError: "" }));
            handleQrResult(v);
          }}
        />
      </PageShell>
    );
  }

  if (state.step === "quiz") {
    const q = cache.quiz[state.currentQuestion];
    return (
      <PageShell cacheName={cacheName}>
        <p className="mb-1 text-xs text-zinc-500">
          {t("cache.quizProgress", {
            current: state.currentQuestion + 1,
            total: cache.quiz.length,
          })}
        </p>
        <p className="mb-6 font-medium leading-snug">{q.question}</p>

        {state.wrongAnswer && (
          <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {t("errors.quizWrong")}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-left text-sm transition-colors hover:border-indigo-500 hover:bg-zinc-700"
            >
              {opt}
            </button>
          ))}
        </div>
      </PageShell>
    );
  }

  if (state.step === "proving") {
    return (
      <PageShell cacheName={cacheName}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Spinner />
          <p className="font-medium">{t("cache.provingTitle")}</p>
          <p className="text-sm text-zinc-400">{t("cache.provingSubtitle")}</p>
          {provingTooLong && (
            <p className="text-sm text-zinc-500">{t("cache.provingMobile")}</p>
          )}
        </div>
      </PageShell>
    );
  }

  if (state.step === "confirm") {
    const paymasterDown = paymasterHealthy === false;
    return (
      <PageShell cacheName={cacheName}>
        <div className="mb-6 rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 text-sm leading-relaxed text-zinc-300">
          {t("claim.summary", { cacheName })}
        </div>

        {paymasterDown && (
          <div className="mb-4 rounded-xl border border-amber-800 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
            {t("claim.summaryFallback")}
          </div>
        )}

        <div className="mb-4">
          <p className="mb-1 text-xs text-zinc-400">{t("cache.displayNameLabel")}</p>
          <p className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200">
            {state.displayName}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {locale === "cs"
              ? "Jméno je součástí důkazu a nelze ho teď změnit. Upravte ho v Profilu."
              : "Name is baked into the proof and cannot be changed now. Edit it in Profile."}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() =>
              setState((s) => ({ ...s, step: "scan", proof: null, currentQuestion: 0 }))
            }
            className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-300"
          >
            {t("claim.cancel")}
          </button>
          <button
            onClick={() => setState((s) => ({ ...s, step: "submitting" }))}
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-semibold text-white"
          >
            {paymasterDown ? t("claim.continueFallback") : t("claim.confirm")}
          </button>
        </div>
      </PageShell>
    );
  }

  if (state.step === "submitting") {
    return (
      <PageShell cacheName={cacheName}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Spinner />
          <p className="font-medium">{t("cache.submitting")}</p>
        </div>
      </PageShell>
    );
  }

  if (state.step === "success") {
    const institution = cache
      ? (locale === "cs" ? cache.institutionCz : cache.institutionEn)
      : null;
    const hasBeneficiary =
      cache?.beneficiary &&
      cache.beneficiary !== "0x0000000000000000000000000000000000000000";

    return (
      <PageShell cacheName={cacheName}>
        {/* Primary success — lands first, feels complete */}
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckIcon className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold">{t("cache.success")}</p>
            <p className="mt-1 text-sm text-zinc-400">{cacheName}</p>
          </div>
          <Link
            href={`/${locale}/profile`}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white"
          >
            {t("nav.profile")} →
          </Link>
        </div>

        {/* Optional donation — visually separated, purely opt-in */}
        {hasBeneficiary && !donateTxHash && (
          <div className="mt-2 border-t border-zinc-800 pt-6">
            <p className="mb-1 text-sm font-medium text-zinc-200">
              {t("cache.donatePrompt", { institution: institution ?? "" })}
            </p>
            <p className="mb-3 text-xs text-zinc-500">{t("cache.donateGasNote")}</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="0.001"
                value={donationEth}
                onChange={(e) => setDonationEth(e.target.value)}
                className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleDonate}
                disabled={donating || !donationEth}
                className="flex-1 rounded-lg bg-zinc-700 py-2 text-sm font-medium text-zinc-100 disabled:opacity-50"
              >
                {donating
                  ? t("cache.donateSending")
                  : t("cache.donateSend", { amount: donationEth || "…" })}
              </button>
            </div>
            {donateError && (
              <p className="mt-2 text-xs text-red-400">{donateError}</p>
            )}
          </div>
        )}

        {donateTxHash && (
          <div className="mt-2 border-t border-zinc-800 pt-6">
            <p className="text-sm text-emerald-400">{t("cache.donateSuccess")}</p>
            <a
              href={`https://sepolia.scrollscan.com/tx/${donateTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-zinc-500 underline underline-offset-2"
            >
              {locale === "cs" ? "Zobrazit transakci" : "View transaction"}
            </a>
          </div>
        )}

        {/* Undo toast — cosmetic only; attestations are on-chain and permanent */}
        {state.undoVisible && (
          <div className="fixed bottom-20 left-4 right-4 flex items-center justify-between rounded-xl bg-zinc-800 px-4 py-3 shadow-xl">
            <span className="text-sm text-zinc-200">{t("undo.message")}</span>
            <button
              onClick={() => setState((s) => ({ ...s, undoVisible: false }))}
              className="ml-4 rounded-lg bg-zinc-700 px-3 py-1 text-sm text-white"
            >
              {t("undo.undo")}
            </button>
          </div>
        )}
      </PageShell>
    );
  }

  // error step
  return (
    <PageShell cacheName={cacheName}>
      <div className="flex flex-col gap-4 py-4">
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-300">
            {t(state.errorKey as Parameters<typeof t>[0])}
          </p>
        </div>
        <button
          onClick={() => setState(INITIAL)}
          className="w-full rounded-xl bg-zinc-800 py-3 text-sm text-zinc-200"
        >
          {t("cache.tryAgain")}
        </button>
      </div>
    </PageShell>
  );
}

// ── Shared shell ──────────────────────────────────────────────────────────────

function PageShell({
  cacheName,
  children,
}: {
  cacheName: string;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/${locale}`} className="text-zinc-400 hover:text-white">
          ←
        </Link>
        <h1 className="text-lg font-semibold">{cacheName}</h1>
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-10 w-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
