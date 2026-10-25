import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ExternalLink, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { LogoMark } from "./Logo";
import { DisplayControls } from "./PortalShell";
import { InstallAppButton, PoliceSeal } from "./brand";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { ROLE_HOME } from "../lib/format";

/**
 * One header and one footer for every page that needs no sign-in, so the
 * public side reads as one system: the same navigation, the same language,
 * text-size and theme controls, and the same live status line everywhere.
 */

const LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/verify", label: "Verify evidence" },
  { to: "/transparency", label: "Transparency" },
  { to: "/handbook", label: "Handbook" },
  { to: "/about", label: "About" },
];

type Status = { state: "checking" | "ok" | "degraded" | "offline"; network?: string };

let statusCache: Promise<Status> | null = null;

function loadStatus(): Promise<Status> {
  statusCache ??= fetch("/api/health", { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((h: any): Status => {
      const s = h?.subsystems ?? {};
      const healthy = s.database?.reachable === true && s.blockchain?.ready === true;
      return { state: healthy ? "ok" : "degraded", network: s.blockchain?.network?.name };
    })
    .catch((): Status => ({ state: "offline" }));
  return statusCache;
}

/** Live system status, read once per page load from the public health check. */
export function useSystemStatus(): Status {
  const [status, setStatus] = useState<Status>({ state: "checking" });
  useEffect(() => {
    let live = true;
    void loadStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  return status;
}

const STATUS_TEXT: Record<Status["state"], string> = {
  checking: "Checking services…",
  ok: "All services operational",
  degraded: "Some services degraded",
  offline: "Service unreachable",
};
const STATUS_DOT: Record<Status["state"], string> = {
  checking: "bg-faint",
  ok: "bg-success",
  degraded: "bg-warning",
  offline: "bg-danger",
};

export function StatusIndicator({ className = "" }: { className?: string }) {
  const status = useSystemStatus();
  return (
    <span className={`inline-flex items-center gap-1.5 font-ui text-2xs text-muted ${className}`} role="status">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status.state]} ${status.state === "ok" ? "animate-pulse" : ""}`} aria-hidden />
      {STATUS_TEXT[status.state]}
      {status.state === "ok" && status.network && <span className="text-faint">· Ethereum {status.network}</span>}
    </span>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-full px-3 py-2 font-ui text-sm font-medium transition ${isActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text"}`;
}

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const portal = user ? (
    <Link to={ROLE_HOME[user.role]} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-fill px-4 font-ui text-sm font-semibold text-on-primary transition hover:opacity-90">
      <LayoutDashboard size={14} aria-hidden /> <span className="hidden sm:inline">{t("nav.dashboard")}</span>
    </Link>
  ) : (
    <Link to="/login" className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-fill px-4 font-ui text-sm font-semibold text-on-primary transition hover:opacity-90">
      <LogIn size={14} aria-hidden /> {t("shell.signIn")}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-elevated/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary-fill focus:px-4 focus:py-2 focus:font-ui focus:text-sm focus:font-semibold focus:text-on-primary"
      >
        {t("shell.skip")}
      </a>
      {/* System strip: status on the left, display controls on the right. */}
      <div className="hidden border-b border-border bg-surface-2 md:block">
        <div className="mx-auto flex h-10 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <StatusIndicator />
          <div className="ml-auto">
            <DisplayControls compact />
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="NyaySetu home">
          <LogoMark size={36} />
          <span>
            <span className="block font-display text-lg leading-none text-text">NyaySetu</span>
            <span className="block font-ui text-2xs leading-tight text-muted">न्यायसेतु<span className="hidden sm:inline"> · Evidence integrity system</span></span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <span className="hidden sm:inline-flex">
            <InstallAppButton compact />
          </span>
          {portal}
          <PoliceSeal size={38} className="hidden sm:inline-flex" />
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-text lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-bg-elevated px-4 pb-4 pt-2 lg:hidden">
          <nav aria-label="Main">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => `block rounded-xl px-3 py-3 font-ui text-base ${isActive ? "bg-primary-soft font-semibold text-primary" : "text-text hover:bg-surface-2"}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <DisplayControls compact />
            <InstallAppButton compact />
          </div>
          <StatusIndicator className="mt-3" />
        </div>
      )}
      {children}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="font-display text-lg text-text">NyaySetu</span>
          </Link>
          <p className="mt-3 font-ui text-xs leading-relaxed text-muted">
            Evidence, summons and bail records whose integrity anyone can check. Fingerprints on a public ledger; personal data never.
          </p>
          <StatusIndicator className="mt-4" />
        </div>
        <FooterColumn
          title="Public services"
          links={[
            { to: "/verify", label: "Verify a piece of evidence" },
            { to: "/transparency", label: "Transparency and live figures" },
            { to: "/handbook", label: t("shell.handbook") },
          ]}
        />
        <FooterColumn
          title="For officials"
          links={[
            { to: "/login", label: t("shell.signIn") },
            { to: "/handbook#roles", label: "Guides for each role" },
            { href: "/api/health", label: "System health (JSON)" },
          ]}
        />
        <FooterColumn
          title="The project"
          links={[
            { to: "/about", label: "About NyaySetu" },
            { href: "https://github.com/SAI-RANDIVE/NyaySetu", label: "Source code" },
            { href: "https://sepolia.etherscan.io/address/0x383d996De8cd2a19aCC8d66CdEa2F4A3b1E7F6D4", label: "Contracts on Etherscan" },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-ui text-2xs text-faint sm:px-6">
          <span>NyaySetu · न्यायसेतु · Developed by Sai Randive</span>
          <span>Decision support for the justice system. A matching fingerprint proves a file is unchanged, not that it is true.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: ({ to: string; label: string } | { href: string; label: string })[] }) {
  return (
    <div>
      <p className="font-ui text-2xs font-bold uppercase tracking-[0.16em] text-faint">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {"to" in l ? (
              <Link to={l.to} className="font-ui text-sm text-muted transition hover:text-primary">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-ui text-sm text-muted transition hover:text-primary">
                {l.label} <ExternalLink size={11} aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A public page: shared header, a main landmark, shared footer. */
export function SitePage({ children, subnav, bare = false }: { children: React.ReactNode; subnav?: React.ReactNode; bare?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <SiteHeader>{subnav}</SiteHeader>
      <main id="main" tabIndex={-1} className={`flex-1 outline-none ${bare ? "" : "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12"}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
