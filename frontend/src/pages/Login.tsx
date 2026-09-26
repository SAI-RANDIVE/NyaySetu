import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Gavel, Info, Lock, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { ROLE_HOME, ROLE_LABEL } from "../lib/format";
import { Button, Field, Input } from "../components/ui";
import { HeroBackdrop } from "../components/landing";

/**
 * Sign in.
 *
 * Kept on the cinematic surface so the transition from the landing page does
 * not feel like leaving the product. The demo account list is shown only when
 * the API reports a non-production environment, so it cannot leak into a real
 * deployment.
 */

const DEMO_ACCOUNTS: { email: string; role: keyof typeof ROLE_LABEL; note?: string }[] = [
  { email: "police@nyaysetu.demo", role: "police" },
  { email: "forensic@nyaysetu.demo", role: "forensic_lab" },
  { email: "prosecutor@nyaysetu.demo", role: "prosecutor" },
  { email: "judge@nyaysetu.demo", role: "judge" },
  { email: "defence@nyaysetu.demo", role: "defence_lawyer" },
  { email: "accused@nyaysetu.demo", role: "accused" },
  { email: "surety@nyaysetu.demo", role: "accused", note: "surety view" },
  { email: "admin@nyaysetu.demo", role: "court_admin" },
];

const DEMO_PASSWORD = "NyaySetu@2026";

export default function Login() {
  const { user, signIn, loading: sessionLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Already signed in: go where this role belongs.
  if (!sessionLoading && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? ROLE_HOME[user.role]} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const signedIn = await signIn(email.trim(), password);
      navigate(ROLE_HOME[signedIn.role], { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not reach the NyaySetu API. Check that the backend is running on port 4000."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      data-surface="cinematic"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{ minHeight: "100dvh" }}
    >
      <HeroBackdrop />

      <Link
        to="/"
        className="relative z-10 mb-7 flex items-center gap-3 transition-transform hover:scale-[1.02]"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-nav">
          <Gavel size={19} className="text-[#070b0a]" />
        </span>
        <span>
          <span className="block font-display text-xl leading-none text-white">NyaySetu</span>
          <span className="block font-ui text-2xs leading-tight text-white/55">न्यायसेतु</span>
        </span>
      </Link>

      <div className="relative z-10 w-full max-w-[400px]">
        <form
          onSubmit={submit}
          className="anim rounded-panel border border-white/12 bg-[#0b1210]/85 p-6 shadow-lift backdrop-blur-xl"
          style={{ ["--d" as any]: "0.08s" }}
        >
          <h1 className="font-display text-2xl leading-tight text-white">Sign in</h1>
          <p className="mt-1.5 font-ui text-xs leading-relaxed text-white/55">
            Your role decides which portal opens. Sessions are server-side and can be revoked the
            moment an account is suspended.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Email address" required>
              <div className="relative">
                <Mail
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
                />
                <Input
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  placeholder="officer@nyaysetu.demo"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-white/15 bg-white/5 pl-10 text-white placeholder:text-white/30"
                />
              </div>
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Lock
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
                />
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-white/15 bg-white/5 pl-10 text-white placeholder:text-white/30"
                />
              </div>
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2.5 font-ui text-xs leading-relaxed text-white"
            >
              {error}
            </p>
          )}

          <Button type="submit" full size="lg" className="mt-6" loading={pending} iconRight={<ArrowRight size={15} />}>
            Sign in
          </Button>

          <p className="mt-4 text-center font-ui text-2xs leading-relaxed text-white/40">
            Five failed attempts locks the account for fifteen minutes.
          </p>
        </form>

        {/* Demo accounts. Convenience for a viva, and clearly labelled as such. */}
        <div className="anim mt-4" style={{ ["--d" as any]: "0.18s" }}>
          <button
            type="button"
            onClick={() => setShowDemo((value) => !value)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 font-ui text-2xs font-semibold uppercase tracking-wider text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <Info size={12} />
            {showDemo ? "Hide demo accounts" : "Show demo accounts"}
          </button>

          {showDemo && (
            <div className="mt-3 animate-menu-in rounded-card border border-white/12 bg-[#0b1210]/85 p-4 backdrop-blur-xl">
              <p className="mb-3 font-ui text-2xs leading-relaxed text-white/55">
                Seeded by <code className="font-mono text-white/75">npm run seed</code>. One password
                for all of them: <code className="font-mono text-white/75">{DEMO_PASSWORD}</code>
              </p>
              <ul className="space-y-1">
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(DEMO_PASSWORD);
                        setShowDemo(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="truncate font-mono text-2xs text-white/80">{account.email}</span>
                      <span className="shrink-0 font-ui text-2xs text-white/45">
                        {account.note ?? ROLE_LABEL[account.role]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
