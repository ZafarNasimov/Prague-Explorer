"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

// Camera scanner is loaded dynamically — it references navigator.mediaDevices
// which doesn't exist in SSR or Node environments.
const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((m) => m.Scanner),
  { ssr: false, loading: () => <div className="flex h-48 items-center justify-center text-zinc-400 text-sm">Načítám skener…</div> }
);

interface QrScannerProps {
  /** Called with the raw QR value when a code is successfully scanned or submitted manually. */
  onResult: (value: string) => void;
  /** Called when the scanner encounters a camera error. */
  onError?: (err: unknown) => void;
}

/**
 * QR scanner with camera + manual text fallback.
 *
 * Camera path: uses the device's back camera via @yudiel/react-qr-scanner.
 * Manual path: shown immediately if camera permission is denied, or via
 * "Can't scan?" toggle. Critical for laptop judges and http-only environments.
 */
export function QrScanner({ onResult, onError }: QrScannerProps) {
  const t = useTranslations("cache");
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState(false);

  function handleCameraError(err: unknown) {
    setCameraError(true);
    setShowManual(true);
    onError?.(err);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manualValue.trim();
    if (v) onResult(v);
  }

  return (
    <div className="flex flex-col gap-4">
      {!showManual && !cameraError && (
        <div className="overflow-hidden rounded-xl border border-zinc-700">
          <Scanner
            onScan={(results) => {
              if (results.length > 0) onResult(results[0].rawValue);
            }}
            onError={handleCameraError}
            constraints={{ facingMode: "environment" }}
            styles={{ container: { width: "100%", aspectRatio: "1/1" } }}
          />
        </div>
      )}

      {!showManual && !cameraError && (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-center text-sm text-zinc-400 underline underline-offset-2"
        >
          {t("manualEntry")}
        </button>
      )}

      {(showManual || cameraError) && (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
          {!cameraError && (
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="self-start text-sm text-zinc-400 underline underline-offset-2"
            >
              ← {t("scanTitle")}
            </button>
          )}
          <input
            type="text"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder={t("manualPlaceholder")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!manualValue.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {t("manualSubmit")}
          </button>
        </form>
      )}
    </div>
  );
}
