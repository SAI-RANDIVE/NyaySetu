import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gavel, Menu, X } from "lucide-react";

const HERO_VIDEO =
  import.meta.env.VITE_HERO_VIDEO ??
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

/* ==================================================== HeroBackdrop ======= */

/**
 * The cinematic layer: video, gradients, grid and glow, in that stacking order.
 *
 * Every piece of it is pointer-events-none and aria-hidden. It is atmosphere,
 * and a screen reader announcing "video" here would be noise, not information.
 *
 * The video is muted, looping and playsInline, which is what lets iOS autoplay
 * it at all. If it fails to load, the layers beneath are still a finished
 * composition rather than a white page, which is why the parent is solid black.
 */
export function HeroBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Some browsers reject the autoplay promise even when muted; catching it
    // keeps an unhandled rejection out of the console.
    void video.play().catch(() => undefined);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      {!failed && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
      )}

      {/* Left-to-right wash, so the headline sits on near-solid colour. */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, #070b0a 0%, rgba(7,11,10,0.72) 42%, transparent 100%)" }}
      />
      {/* Bottom-up wash, so the stats row stays readable over any frame. */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(0deg, #070b0a 0%, rgba(7,11,10,0.55) 26%, transparent 62%)" }}
      />

      {/* Three hairlines at the quarter marks. Desktop only: at phone width they
          crowd the text instead of structuring it. */}
      <div className="absolute inset-0 hidden md:block">
        {[25, 50, 75].map((percent) => (
          <span
            key={percent}
            className="absolute top-0 h-full w-px bg-white/10"
            style={{ left: `${percent}%` }}
          />
        ))}
      </div>

      {/* The glow behind the card: a wide ellipse, blurred hard, in cyan-green. */}
      <svg
        className="absolute left-1/2 top-[-6%] h-[52vh] w-[132vw] -translate-x-1/2"
        viewBox="0 0 1200 520"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="heroGlow" x="-30%" y="-60%" width="160%" height="240%">
            <feGaussianBlur stdDeviation="25" />
          </filter>
          <radialGradient id="heroGlowFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5ed29c" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#2f8f74" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#0c2b23" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="600" cy="250" rx="470" ry="126" fill="url(#heroGlowFill)" filter="url(#heroGlow)" />
      </svg>
    </div>
  );
}

/* =================================================== LandingHeader ======= */

interface NavLinkDef {
  href: string;
  label: string;
  /** A router route rather than an in-page anchor. */
  route?: boolean;
}

const LINKS: NavLinkDef[] = [
  { href: "#modules", label: "Modules" },
  { href: "#architecture", label: "Architecture" },
  { href: "#verify", label: "Verify" },
  { href: "/handbook", label: "Handbook", route: true },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 720 && setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="relative z-20 shrink-0 animate-slide-down">
      <div className="mx-auto flex max-w-[860px] items-center gap-[clamp(14px,2.6vw,26px)] px-1">
        {/* Circular white mark. A real logo, not a wordmark in a box. */}
        <Link
          to="/"
          aria-label="NyaySetu home"
          className="grid h-[clamp(40px,4.4vw,46px)] w-[clamp(40px,4.4vw,46px)] shrink-0 place-items-center rounded-full bg-white shadow-nav transition-transform duration-200 hover:scale-[1.04]"
        >
          <Gavel size={19} className="text-[#070b0a]" />
        </Link>

        {/* White nav pill, desktop only */}
        <nav className="hidden h-[clamp(44px,5.2vw,48px)] max-w-[460px] flex-1 items-center justify-around rounded-full px-2 py-1 nav-pill md:flex">
          {LINKS.map((link, index) =>
            link.route ? (
              <Link
                key={link.href}
                to={link.href}
                className="nav-link relative px-2.5 py-2 font-ui text-[clamp(12px,1.3vw,14px)] font-medium tracking-[-0.01em]"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                data-active={index === 0 ? "true" : undefined}
                className="nav-link relative px-2.5 py-2 font-ui text-[clamp(12px,1.3vw,14px)] font-medium tracking-[-0.01em]"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className="hidden h-[clamp(44px,5.2vw,48px)] items-center rounded-full px-5 font-ui text-[clamp(12px,1.3vw,14px)] font-semibold shadow-nav transition md:inline-flex"
            style={{ background: "var(--pill-dark)", color: "var(--sign-in-text)" }}
          >
            Sign in
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid h-12 w-12 place-items-center rounded-full text-white shadow-nav md:hidden"
            style={{ background: open ? "#ffffff" : "var(--pill-dark)" }}
          >
            {open ? <X size={18} className="text-[#070b0a]" /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Full-screen mobile overlay with a white sheet, per the reference design */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 animate-overlay-in backdrop-blur-[6px] md:hidden"
            style={{ background: "rgba(0,0,0,0.62)" }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-24 z-40 animate-menu-in rounded-[28px] bg-white px-4 pb-5 pt-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] md:hidden">
            <ul className="space-y-1">
              {LINKS.map((link, index) => (
                <li key={link.href} style={{ animationDelay: `${0.04 * index}s` }} className="animate-menu-in">
                  {link.route ? (
                    <Link
                      to={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-4 py-3.5 font-ui text-base font-medium text-[#2e2e2e] transition hover:bg-black/5"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-4 py-3.5 font-ui text-base font-medium text-[#2e2e2e] transition hover:bg-black/5"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-full px-5 py-3.5 text-center font-ui text-sm font-semibold"
              style={{ background: "#070b0a", color: "#ffffff" }}
            >
              Sign in
            </Link>
          </div>
        </>
      )}
    </header>
  );
}

/* =================================================== LiquidGlassCard ===== */

/**
 * The floating glass card above the headline.
 *
 * 200x200, lifted 50px so it overlaps the display type. The glass itself is a
 * single class in index.css, because the mask-composite trick that draws its
 * 1.4px frame is not expressible in Tailwind utilities.
 */
export function LiquidGlassCard() {
  return (
    <div
      className="liquid-glass mx-auto flex h-[200px] w-[200px] -translate-y-[50px] flex-col justify-between p-5 anim"
      style={{ ["--d" as any]: "0.18s" }}
    >
      <span className="font-ui text-[14px] font-medium tracking-wide text-white/70">[ 2026 ]</span>

      <p className="font-ui text-[18px] font-semibold leading-snug text-white">
        Verified by{" "}
        <span className="font-accent italic font-normal">cryptography,</span> not by assertion
      </p>

      <p className="font-ui text-[11px] leading-relaxed text-white/55">
        Final year project · VIT Pune · AI &amp; Data Science
      </p>
    </div>
  );
}

/* ======================================================== TrustRow ======= */

/**
 * The overlapping-avatar row. Each ring is a dark padded circle with a smaller
 * white disc inside, which is what stops it reading as three flat white blobs.
 */
export function TrustRow() {
  const items = [
    { initials: "SS", title: "SaakshyaSetu — Evidence" },
    { initials: "SM", title: "SammansSetu — Summons" },
    { initials: "JS", title: "JaminSetu — Bail" },
  ];

  return (
    <div
      className="anim mb-[clamp(16px,2.5vh,26px)] inline-flex items-center"
      style={{ ["--d" as any]: "0.05s", ["--trust-size" as any]: "clamp(34px,4.5vw,42px)" }}
    >
      {items.map((item, index) => (
        <span
          key={item.initials}
          title={item.title}
          className="grid shrink-0 place-items-center rounded-full transition-transform duration-[350ms]"
          style={{
            width: "var(--trust-size)",
            height: "var(--trust-size)",
            background: "var(--trust-bg)",
            border: "1px solid var(--trust-border)",
            padding: "5px",
            marginLeft: index === 0 ? 0 : "calc(var(--trust-size) * -0.42)",
            zIndex: index === 2 ? 4 : index + 1,
          }}
        >
          <span className="grid h-full w-full place-items-center rounded-full bg-white">
            <span
              className="font-ui font-bold text-[#111]"
              style={{ fontSize: "calc(var(--trust-size) * 0.3)" }}
            >
              {item.initials}
            </span>
          </span>
        </span>
      ))}

      <span
        className="flex items-center rounded-full"
        style={{
          height: "var(--trust-size)",
          background: "var(--trust-bg)",
          border: "1px solid var(--trust-border)",
          marginLeft: "calc(var(--trust-size) * -0.42)",
          paddingLeft: "calc(var(--trust-size) * 0.58)",
          paddingRight: "16px",
        }}
      >
        <span
          className="whitespace-nowrap font-ui font-medium"
          style={{ color: "var(--trust-text)", fontSize: "clamp(12px,1.4vw,13.5px)" }}
        >
          Three bridges, one chain of proof
        </span>
      </span>
    </div>
  );
}

/* ====================================================== StatsFooter ====== */

interface Metric {
  glyph: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
}

const METRICS: Metric[] = [
  { glyph: "#", target: 3, suffix: "", decimals: 0, label: "Smart contracts" },
  { glyph: "%", target: 100, suffix: "%", decimals: 0, label: "Tables under RLS" },
  { glyph: "*", target: 53, suffix: "", decimals: 0, label: "Contract tests passing" },
  { glyph: "<", target: 256, suffix: "-bit", decimals: 0, label: "SHA-256 digests" },
];

function useCountUp(target: number, decimals: number, startDelayMs: number, durationMs: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }

    // Respect a reduced-motion preference by landing on the final number at once.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done.current) return;
        done.current = true;
        observer.disconnect();

        window.setTimeout(() => {
          const started = performance.now();
          const step = (now: number) => {
            const progress = Math.min(1, (now - started) / durationMs);
            // easeOutCubic: fast at first, settling rather than stopping dead.
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(target * eased);
            if (progress < 1) requestAnimationFrame(step);
            else setValue(target);
          };
          requestAnimationFrame(step);
        }, startDelayMs);
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target, durationMs, startDelayMs]);

  return { ref, text: value.toFixed(decimals) };
}

function MetricCell({ metric, index }: { metric: Metric; index: number }) {
  const { ref, text } = useCountUp(metric.target, metric.decimals, 480 + index * 90, 1500 + index * 80);

  return (
    <div
      className="anim flex flex-col items-center text-center"
      style={{ ["--d" as any]: `${0.5 + index * 0.08}s` }}
    >
      <span
        aria-hidden="true"
        className="font-dot leading-none text-white"
        style={{ fontSize: "clamp(20px,3vw,31px)" }}
      >
        {metric.glyph}
      </span>
      <span
        ref={ref}
        className="mt-2 font-ui font-bold tabular tracking-[-0.025em] text-white"
        style={{ fontSize: "clamp(17px,2.2vw,25px)" }}
      >
        {text}
        {metric.suffix}
      </span>
      <span
        className="mt-1 font-ui"
        style={{ color: "#8e8e8e", fontSize: "clamp(11px,1.2vw,12.5px)" }}
      >
        {metric.label}
      </span>
    </div>
  );
}

export function StatsFooter() {
  return (
    <div className="relative z-10 mx-auto grid w-full max-w-[920px] shrink-0 grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
      {METRICS.map((metric, index) => (
        <MetricCell key={metric.label} metric={metric} index={index} />
      ))}
    </div>
  );
}

/* ========================================================== HeroCta ====== */

export function HeroCta() {
  return (
    <div className="anim-pulse flex flex-wrap items-center gap-3" style={{ ["--d" as any]: "0.4s" }}>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 rounded-full px-[clamp(22px,3vw,28px)] py-[clamp(11px,1.6vh,13px)]
          font-ui text-[clamp(13px,1.5vw,14.5px)] font-bold uppercase tracking-wide transition-transform duration-200
          hover:-translate-y-0.5 hover:scale-[1.02]"
        style={{
          background: "#5ed29c",
          color: "#070b0a",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.15), 0 0 22px rgba(94,210,156,0.4), 0 0 44px rgba(94,210,156,0.16)",
        }}
      >
        Enter a portal
        <ArrowRight size={15} />
      </Link>

      <Link
        to="/handbook"
        className="inline-flex items-center gap-2 rounded-full border border-white/25 px-[clamp(20px,2.6vw,24px)] py-[clamp(11px,1.6vh,13px)]
          font-ui text-[clamp(13px,1.5vw,14.5px)] font-semibold uppercase tracking-wide text-white/85
          transition hover:border-white/45 hover:text-white"
      >
        Read the handbook
      </Link>
    </div>
  );
}
