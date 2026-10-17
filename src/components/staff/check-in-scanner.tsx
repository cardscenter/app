"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, Keyboard } from "lucide-react";
import { checkInTicket } from "@/actions/staff/check-in";
import type { CheckInResult } from "@/lib/shop-events/registrations";
import { Callout } from "@/components/dashboard/ui/callout";
import { INPUT, PILL_BTN, PILL_INK, PILL_RED } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

/**
 * QR-scanner voor de deur. Gebruikt de BarcodeDetector-API (Chrome/Edge/
 * Android, Safari 17+) met de achtercamera; zonder ondersteuning blijft het
 * typveld over (code "CC-XXXXXX"). Geen externe scanner-library nodig.
 */
export function CheckInScanner({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const pendingRef = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  function submit(raw: string, force = false) {
    const value = raw.trim();
    if (!value || pendingRef.current) return;
    pendingRef.current = true;
    startTransition(async () => {
      const r = await checkInTicket(value, { eventId, force });
      setResult(r);
      pendingRef.current = false;
      if ("ok" in r) {
        setManual("");
        router.refresh();
        try {
          navigator.vibrate?.(r.already ? [80, 60, 80] : 120);
        } catch {
          // niet ondersteund
        }
      }
    });
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Camera niet beschikbaar");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    if (!scanning) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    let raf = 0;
    let active = true;
    const loop = async () => {
      if (!active) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes: Array<{ rawValue: string }> = await detector.detect(video);
          const hit = codes.find((c) => c.rawValue);
          if (hit) {
            const now = Date.now();
            // Dezelfde QR niet elke frame opnieuw insturen.
            if (hit.rawValue !== lastRef.current.value || now - lastRef.current.at > 4000) {
              lastRef.current = { value: hit.rawValue, at: now };
              submit(hit.rawValue);
            }
          }
        } catch {
          // frame overslaan
        }
      }
      raf = window.setTimeout(() => requestAnimationFrame(loop), 150) as unknown as number;
    };
    void loop();
    return () => {
      active = false;
      window.clearTimeout(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Event: {eventTitle}</p>

      {supported ? (
        <div className="space-y-2">
          <div className="relative aspect-square overflow-hidden rounded-[12px] bg-[var(--cc-dark)]">
            <video ref={videoRef} className={`h-full w-full object-cover ${scanning ? "" : "hidden"}`} muted playsInline />
            {!scanning && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/70">
                <Camera className="size-8" />
                <span className="text-sm">Camera staat uit</span>
              </div>
            )}
            {scanning && <div className="pointer-events-none absolute inset-8 rounded-[12px] border-2 border-white/70" />}
          </div>
          <button
            type="button"
            onClick={scanning ? stopCamera : startCamera}
            className={cn(PILL_BTN, "w-full justify-center py-2.5")}
          >
            {scanning ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
            {scanning ? "Camera stoppen" : "Camera starten"}
          </button>
          {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
        </div>
      ) : supported === false ? (
        <Callout tone="blue">
          Deze browser kan geen QR-codes scannen (BarcodeDetector ontbreekt). Gebruik Chrome of Edge op een telefoon, of typ de code hieronder.
        </Callout>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(manual);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="CC-XXXXXX"
            autoComplete="off"
            className={cn(INPUT, "py-2.5 pl-9 font-mono uppercase tracking-wider")}
          />
        </div>
        <button type="submit" disabled={pending || !manual.trim()} className={cn(PILL_RED, "disabled:opacity-60")}>
          Check in
        </button>
      </form>

      {result &&
        ("ok" in result ? (
          <Callout
            tone={result.already ? "yellow" : "green"}
            icon={result.already ? AlertTriangle : CheckCircle2}
            title={result.already ? "Al ingecheckt" : "Ingecheckt"}
          >
            {result.registration.displayName}
            {result.registration.divisionKey && <> · {result.registration.divisionKey}</>}
            <span className="ml-2 font-mono text-xs opacity-70">{result.registration.ticketCode}</span>
          </Callout>
        ) : (
          <Callout
            tone={result.code === "window" ? "yellow" : "pink"}
            icon={XCircle}
            title={result.error}
            action={
              result.code === "window" ? (
                <button type="button" onClick={() => submit(lastRef.current.value || manual, true)} className={PILL_INK}>
                  Toch inchecken
                </button>
              ) : undefined
            }
          />
        ))}
    </div>
  );
}
