import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Camera,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  Scale,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ROLE_LABEL } from "../lib/format";
import { LogoMark } from "./Logo";
import type { Role } from "../lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

/** One nav definition per portal. Kept here so routes and links cannot drift. */
const NAV: Record<Role, NavItem[]> = {
  police: [
    { to: "/police", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/police/capture", label: "Capture evidence", icon: Camera },
    { to: "/police/cases", label: "Cases", icon: ClipboardList },
  ],
  forensic_lab: [
    { to: "/forensic", label: "Intake queue", icon: LayoutDashboard, end: true },
    { to: "/forensic/cases", label: "Cases", icon: ClipboardList },
  ],
  prosecutor: [
    { to: "/prosecutor", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/prosecutor/cases", label: "Cases", icon: ClipboardList },
  ],
  judge: [
    { to: "/judge", label: "Court dashboard", icon: LayoutDashboard, end: true },
    { to: "/judge/summons", label: "Summons", icon: ScrollText },
    { to: "/judge/bail", label: "Bail compliance", icon: Scale },
    { to: "/judge/cases", label: "Cases", icon: ClipboardList },
  ],
  defence_lawyer: [
    { to: "/defence", label: "Verification", icon: ShieldCheck, end: true },
    { to: "/defence/cases", label: "Cases", icon: ClipboardList },
  ],
  accused: [
    { to: "/accused", label: "My obligations", icon: LayoutDashboard, end: true },
    { to: "/accused/summons", label: "Summons", icon: ScrollText },
    { to: "/accused/checkin", label: "Bail check-in", icon: Scale },
  ],
  court_admin: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/users", label: "Participants", icon: Users },
    { to: "/admin/access", label: "Case access", icon: ShieldCheck },
    { to: "/admin/audit", label: "Audit trail", icon: FileSearch },
    { to: "/admin/chain", label: "Chain status", icon: Activity },
    { to: "/admin/cases", label: "Cases", icon: ClipboardList },
  ],
};

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // A route change must close the mobile sheet, or it stays over the new page.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;
  const items = NAV[user.role];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* --------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg-elevated/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to={items[0].to} className="flex shrink-0 items-center gap-2.5 group">
            <LogoMark
              size={38}
              className="transition-transform duration-300 ease-smooth group-hover:scale-105 group-hover:rotate-[-4deg]"
            />
            <span className="hidden sm:block">
              <span className="block font-display text-base leading-none text-text">NyaySetu</span>
              <span className="block font-ui text-2xs leading-tight text-faint">
                {ROLE_LABEL[user.role]}
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-ui text-xs font-semibold transition ${
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:-translate-y-0.5 hover:bg-surface-2 hover:text-text"
                  }`
                }
              >
                <item.icon size={14} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/handbook"
              aria-label="Handbook"
              title="Handbook: how this platform works"
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition hover:border-primary hover:text-primary"
            >
              <BookOpen size={15} />
            </Link>

            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition hover:border-border-strong hover:text-text"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="text-right">
                <p className="font-ui text-xs font-semibold leading-tight text-text">{user.fullName}</p>
                <p className="font-ui text-2xs leading-tight text-faint">
                  {user.designation ?? ROLE_LABEL[user.role]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                aria-label="Sign out"
                title="Sign out"
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition hover:border-danger-soft hover:text-danger"
              >
                <LogOut size={15} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-text transition hover:border-border-strong lg:hidden"
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 top-16 z-30 bg-black/50 backdrop-blur-sm animate-overlay-in lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <nav className="relative z-40 animate-menu-in border-t border-border bg-bg-elevated px-4 py-4 shadow-lift lg:hidden">
              <div className="mb-3 sm:hidden">
                <p className="font-ui text-sm font-semibold text-text">{user.fullName}</p>
                <p className="font-ui text-2xs text-faint">
                  {user.designation ?? ROLE_LABEL[user.role]}
                </p>
              </div>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl px-3.5 py-3 font-ui text-sm font-semibold transition ${
                          isActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2"
                        }`
                      }
                    >
                      <item.icon size={16} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <Link
                    to="/handbook"
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 font-ui text-sm font-semibold text-muted transition hover:bg-surface-2"
                  >
                    <BookOpen size={16} />
                    Handbook
                  </Link>
                </li>
                <li className="pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 font-ui text-sm font-semibold text-danger transition hover:bg-danger-soft"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </li>
              </ul>
            </nav>
          </>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-9">{children}</main>

      <footer className="border-t border-border px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="font-ui text-2xs text-faint">
            NyaySetu · न्यायसेतु · evidence, summons and bail anchored to Ethereum Sepolia
          </p>
          <div className="flex items-center gap-4">
            <Link to="/handbook" className="font-ui text-2xs text-faint transition hover:text-primary">
              Handbook
            </Link>
            <Link to="/" className="font-ui text-2xs text-faint transition hover:text-primary">
              About the project
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
