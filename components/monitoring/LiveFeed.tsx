"use client";
/* eslint-disable @next/next/no-img-element -- MJPEG & blob URL tidak didukung next/image */
import { useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/** false saat tab tidak aktif, supaya stream ditutup dan tidak memakan bandwidth/GPU encode. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
}

const RETRIES = 3;

/** Video beranotasi real-time (MJPEG) dari sesi yang sedang berjalan; coba sambung ulang beberapa kali. */
export function LiveFeed({ sessionId, className, fallback, overlay, size = "full" }: {
  sessionId: string; className: string; fallback: ReactNode; overlay?: ReactNode; size?: "full" | "thumb";
}) {
  const visible = usePageVisible();
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting || attempt >= RETRIES) return;
    const timer = setTimeout(() => { setWaiting(false); setAttempt((value) => value + 1); }, 2000 * (attempt + 1));
    return () => clearTimeout(timer);
  }, [waiting, attempt]);

  if (!visible || waiting) return <>{fallback}</>;
  return <><img key={attempt} src={`/api/monitoring/live/${sessionId}?size=${size}&attempt=${attempt}`} alt="Tayangan langsung beranotasi hasil deteksi APD"
    onError={() => setWaiting(true)} className={className} />{overlay}</>;
}

/** Frame beranotasi terbaru diambil berulang (~fps kali per detik) lewat request pendek, bukan MJPEG.
 *  Untuk kartu dashboard: banyak kartu tidak menghabiskan batas 6 koneksi HTTP/1.1 per host di browser,
 *  sehingga navigasi dan request lain tidak ikut tertahan. */
export function LiveFrames({ sessionId, className, fallback, fps = 15 }: { sessionId: string; className: string; fallback: ReactNode; fps?: number }) {
  const visible = usePageVisible();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || failed) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: string | null = null;
    let failures = 0;
    async function load() {
      const started = performance.now();
      try {
        const response = await fetch(`/api/monitoring/live/${sessionId}/frame?size=thumb`, { cache: "no-store", signal: controller.signal });
        if (!response.ok || response.headers.get("content-type") !== "image/jpeg") throw new Error("frame");
        const next = URL.createObjectURL(await response.blob());
        if (current) URL.revokeObjectURL(current);
        current = next; failures = 0;
        setSrc(next);
      } catch {
        if (controller.signal.aborted) return;
        failures += 1;
        if (failures >= 5) { setFailed(true); return; }
      }
      timer = setTimeout(load, failures ? 1000 * failures : Math.max(0, 1000 / fps - (performance.now() - started)));
    }
    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      if (current) URL.revokeObjectURL(current);
      setSrc(null);
    };
  }, [sessionId, visible, failed, fps]);

  if (!src) return <>{fallback}</>;
  return <img src={src} alt="Tayangan langsung beranotasi" className={className} />;
}

/** true selama elemen terlihat (atau hampir terlihat) di layar. */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}
