import { useEffect, useRef, useState } from "react";
import { sha256Text } from "../lib/hash";

/**
 * The dark, cinematic surface used at the top of the public pages. Everything
 * here is atmosphere and is hidden from assistive technology; the content on
 * top of it carries the meaning.
 */

/**
 * Columns of hexadecimal characters drifting down, the way fingerprints scroll
 * past in a ledger. Canvas, not DOM, so it costs nothing at any width; a single
 * still frame for people who prefer reduced motion.
 */
export function HashRain({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const glyphs = "0123456789abcdef";
    const size = 15;
    let columns: { y: number; speed: number; tint: number }[] = [];
    let frame = 0;
    let raf = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.ceil(width / (size * 1.6));
      columns = Array.from({ length: count }, () => ({
        y: Math.random() * height,
        speed: 0.25 + Math.random() * 0.7,
        tint: Math.random(),
      }));
    };

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.font = `500 ${size}px "JetBrains Mono", Consolas, monospace`;
      columns.forEach((col, i) => {
        const x = i * size * 1.6;
        for (let k = 0; k < 14; k++) {
          const y = col.y - k * size * 1.25;
          if (y < -size || y > height + size) continue;
          const fade = 1 - k / 14;
          const warm = col.tint > 0.82;
          ctx.fillStyle = warm ? `rgba(249,148,64,${0.16 * fade})` : `rgba(140,230,180,${(k === 0 ? 0.32 : 0.13) * fade})`;
          const g = glyphs[(i * 7 + k * 3 + Math.floor((col.y + frame) / 40)) % 16];
          ctx.fillText(g, x, y);
        }
        col.y += col.speed;
        if (col.y - 14 * size * 1.25 > height) col.y = -Math.random() * 200;
      });
      frame++;
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) {
      draw();
    } else {
      const loop = () => {
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}

/** Layered washes over the rain: a green glow on the left, a warm dusk on the right. */
export function CinematicBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#070b0a]">
      <HashRain className="opacity-80 [mask-image:linear-gradient(90deg,transparent_0%,black_45%,black_100%)]" />
      <div className="absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full bg-[#16a34a] opacity-25 blur-[120px]" />
      <div className="absolute -right-32 top-40 h-[30rem] w-[40rem] rounded-full bg-[#c2410c] opacity-20 blur-[140px]" />
      <div className="absolute bottom-0 left-1/3 h-72 w-[46rem] rounded-full bg-[#7c3aed] opacity-[0.12] blur-[140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(7,11,10,0.55)_70%,#070b0a_100%)]" />
      <div className="absolute inset-0 hidden md:block">
        {[25, 50, 75].map((p) => (
          <span key={p} className="absolute top-0 h-full w-px bg-white/[0.06]" style={{ left: `${p}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * A fingerprint computed live, every second, from the current time: the whole
 * idea of the product in one line. Change one character of the input, and the
 * output is unrecognisable.
 */
export function LiveFingerprint() {
  const [state, setState] = useState<{ input: string; hash: string } | null>(null);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const input = `NyaySetu · ${new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })} IST`;
      const hash = await sha256Text(input);
      if (live) setState({ input, hash });
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  if (!state) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1 font-mono text-[11px] leading-relaxed sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-white/50">sha256("{state.input}")</span>
      <span className="hidden text-white/30 sm:inline">→</span>
      <span className="min-w-0 truncate text-[#8ce6b4]" aria-live="off">
        {state.hash}
      </span>
    </div>
  );
}

/** Counts up once, when first scrolled into view. */
export function CountUp({ to, suffix = "", prefix = "", decimals = 0 }: { to: number; suffix?: string; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(to);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / 1400);
          setValue(to * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [to]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
