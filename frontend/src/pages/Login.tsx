import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Info,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError, type User } from "../lib/api";
import { ROLE_HOME, ROLE_LABEL } from "../lib/format";
import { useQuery } from "../lib/useApi";
import { Button, Field, Input } from "../components/ui";
import { HeroBackdrop } from "../components/landing";
import { LogoMark } from "../components/Logo";

/**
 * Sign in, in one or two steps depending on how the deployment is configured.
 *
 * Step 1 is always email and password. If the API reports that email codes are
 * active, it answers `mfaRequired` and no session is created yet; step 2 collects
 * the code that was emailed. The decision is entirely the server's, and this
 * screen reads it from the response rather than guessing from configuration it
 * cannot see.
 */

interface AuthConfig {
  emailOtpEnabled: boolean;
  smtpConfigured: boolean;
  aadhaarProvider: string;
  aadhaarSimulated: boolean;
  environment: string;
  showDemoAccounts: boolean;
}

interface Step1Response {
  mfaRequired: boolean;
  user?: User;
  csrfToken?: string;
  challengeId?: string;
  maskedDestination?: string;
  expiresAt?: string;
  deliveryFailed?: boolean;
  deliveryError?: string;
  /** Present only outside production, and only when delivery failed. */
  otp?: string;
}

const DEMO_ACCOUNTS: { slug: string; role: keyof typeof ROLE_LABEL; note?: string }[] = [
  { slug: "police", role: "police" },
  { slug: "forensic", role: "forensic_lab" },
  { slug: "prosecutor", role: "prosecutor" },
  { slug: "judge", role: "judge" },
  { slug: "defence", role: "defence_lawyer" },
  { slug: "accused", role: "accused" },
  { slug: "surety", role: "accused", note: "surety view" },
  { slug: "admin", role: "court_admin" },
];

const DEMO_PASSWORD = "NyaySetu@2026";

export default function Login() {
  const { user, loading: sessionLoading, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const config = useQuery<AuthConfig>("/api/auth/config");

  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Step1Response | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Countdown on the code step, so nobody sits waiting on an expired code.
  useEffect(() => {
    if (step !== "code" || !challenge?.expiresAt) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((new Date(challenge.expiresAt!).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [step, challenge?.expiresAt]);

  // Demo addresses follow whatever the seed used, so derive them from the
  // address that was just typed rather than hardcoding a domain that may be wrong.
  const demoDomain = useMemo(() => {
    const at = email.indexOf("@");
    return at > 0 ? email.slice(at + 1) : "nyaysetu.demo";
  }, [email]);

  if (!sessionLoading && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? ROLE_HOME[user.role]} replace />;
  }

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api.post<Step1Response>("/api/auth/login", {
        email: email.trim(),
        password,
      });

      if (result.mfaRequired) {
        setChallenge(result);
        setStep("code");
        setOtp(result.otp ?? "");
        return;
      }

      // Password-only deployment: the session already exists.
      await refresh();
      navigate(result.user ? ROLE_HOME[result.user.role] : "/", { replace: true });
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

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ user: User }>("/api/auth/login/verify", { otp });
      await refresh();
      navigate(ROLE_HOME[result.user.role], { replace: true });
    } catch (caught) {
      const details = caught instanceof ApiError ? (caught.details as any) : null;
      setError(caught instanceof ApiError ? caught.message : "That code could not be verified.");

      // Exhausted or expired means the pending sign-in is gone; send them back
      // rather than leaving a dead code box on screen.
      if (details?.restart) {
        setStep("password");
        setChallenge(null);
        setOtp("");
      }
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await api.post<Step1Response>("/api/auth/login/resend");
      setChallenge({ ...result, mfaRequired: true });
      setOtp(result.otp ?? "");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not send another code.");
    } finally {
      setPending(false);
    }
  };

  const startOver = async () => {
    await api.post("/api/auth/login/cancel").catch(() => undefined);
    setStep("password");
    setChallenge(null);
    setOtp("");
    setError(null);
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
        className="relative z-10 mb-7 flex items-center gap-3 transition-transform duration-300 ease-smooth hover:scale-[1.03]"
      >
        <LogoMark size={46} shape="circle" glow />
        <span>
          <span className="block font-display text-xl leading-none text-white">NyaySetu</span>
          <span className="block font-ui text-2xs leading-tight text-white/55">न्यायसेतु</span>
        </span>
      </Link>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* ------------------------------------------------ step indicator */}
        {config.data?.emailOtpEnabled && (
          <div className="anim mb-3 flex items-center gap-2" style={{ ["--d" as any]: "0.04s" }}>
            <StepPip active={step === "password"} done={step === "code"} label="Password" />
            <span className="h-px flex-1 bg-white/15" />
            <StepPip active={step === "code"} done={false} label="Email code" />
          </div>
        )}

        {step === "password" ? (
          <form
            onSubmit={submitPassword}
            className="anim rounded-panel border border-white/12 bg-[#071a10]/88 p-6 shadow-lift backdrop-blur-xl"
            style={{ ["--d" as any]: "0.08s" }}
          >
            <h1 className="font-display text-2xl leading-tight text-white">Sign in</h1>
            <p className="mt-1.5 font-ui text-xs leading-relaxed text-white/55">
              Your role decides which portal opens. Sessions are held server-side, so an account can
              be cut off the moment it is suspended.
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

            {error && <ErrorNote message={error} />}

            <Button
              type="submit"
              full
              size="lg"
              className="mt-6"
              loading={pending}
              iconRight={<ArrowRight size={15} />}
            >
              {config.data?.emailOtpEnabled ? "Continue" : "Sign in"}
            </Button>

            <div className="mt-4 space-y-1.5">
              <p className="text-center font-ui text-2xs leading-relaxed text-white/40">
                Five failed attempts locks the account for fifteen minutes.
              </p>
              {config.data?.emailOtpEnabled && (
                <p className="flex items-center justify-center gap-1.5 text-center font-ui text-2xs text-white/40">
                  <ShieldCheck size={11} />
                  A one-time code will be emailed to your registered address.
                </p>
              )}
            </div>
          </form>
        ) : (
          /* ------------------------------------------------------ step 2 */
          <form
            onSubmit={submitCode}
            className="animate-menu-in rounded-panel border border-white/12 bg-[#071a10]/88 p-6 shadow-lift backdrop-blur-xl"
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <MailCheck size={18} />
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-xl leading-tight text-white">Check your email</h1>
                <p className="mt-1 font-ui text-xs leading-relaxed text-white/55">
                  A six digit code went to{" "}
                  <strong className="text-white">{challenge?.maskedDestination}</strong>.
                </p>
              </div>
            </div>

            {/* Delivery failed: say so instead of leaving them waiting. */}
            {challenge?.deliveryFailed && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-warning-soft bg-warning-soft px-3 py-2.5"
              >
                <p className="flex items-center gap-1.5 font-ui text-xs font-semibold text-white">
                  <AlertTriangle size={12} /> The mail server refused the message
                </p>
                <p className="mt-1 font-ui text-2xs leading-relaxed text-white/70">
                  {challenge.deliveryError ??
                    "Check SMTP_USER and SMTP_PASSWORD in backend/.env. For Gmail it must be a 16-character App Password."}
                </p>
                {challenge.otp && (
                  <p className="mt-2 font-ui text-2xs leading-relaxed text-white/70">
                    Development fallback: the code is{" "}
                    <code className="font-mono text-sm font-bold text-warning">{challenge.otp}</code>
                    , shown here only because delivery failed and this is not production.
                  </p>
                )}
              </div>
            )}

            <Field
              label="Six digit code"
              hint={
                secondsLeft > 0
                  ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                  : "This code has expired. Send another."
              }
            >
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/[^0-9]/g, ""))}
                className="border-white/15 bg-white/5 text-center font-mono text-xl tracking-[0.5em] text-white placeholder:text-white/25"
              />
            </Field>

            {error && <ErrorNote message={error} />}

            <Button
              type="submit"
              full
              size="lg"
              className="mt-5"
              loading={pending}
              disabled={otp.length !== 6}
              iconRight={<ArrowRight size={15} />}
            >
              Verify and sign in
            </Button>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void startOver()}
                className="inline-flex items-center gap-1.5 font-ui text-2xs font-semibold text-white/50 transition hover:text-white"
              >
                <ArrowLeft size={11} /> Use a different account
              </button>
              <button
                type="button"
                onClick={() => void resend()}
                disabled={pending}
                className="font-ui text-2xs font-semibold text-primary transition hover:underline disabled:opacity-40"
              >
                Send another code
              </button>
            </div>

            <p className="mt-4 font-ui text-2xs leading-relaxed text-white/40">
              The code is tied to this browser as well as to your account, so it cannot be redeemed
              anywhere else even if somebody else reads your inbox.
            </p>
          </form>
        )}

        {/* ------------------------------------------------ demo accounts */}
        {step === "password" && config.data?.showDemoAccounts && (
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
              <div className="mt-3 animate-menu-in rounded-card border border-white/12 bg-[#071a10]/88 p-4 backdrop-blur-xl">
                <p className="mb-3 font-ui text-2xs leading-relaxed text-white/55">
                  Seeded by <code className="font-mono text-white/75">npm run seed</code>. One
                  password for all of them:{" "}
                  <code className="font-mono text-white/75">{DEMO_PASSWORD}</code>
                </p>
                <ul className="space-y-1">
                  {DEMO_ACCOUNTS.map((account) => {
                    const address = `${account.slug}@${demoDomain}`;
                    return (
                      <li key={account.slug}>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(address);
                            setPassword(DEMO_PASSWORD);
                            setShowDemo(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5"
                        >
                          <span className="truncate font-mono text-2xs text-white/80">{address}</span>
                          <span className="shrink-0 font-ui text-2xs text-white/45">
                            {account.note ?? ROLE_LABEL[account.role]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 font-ui text-2xs leading-relaxed text-white/40">
                  Type your own address above first and these switch to match its domain, which is
                  what you want if you seeded with <code className="font-mono">SEED_EMAIL_BASE</code>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------ handbook link */}
        <Link
          to="/handbook"
          className="anim mt-4 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-ui text-2xs font-semibold text-white/45 transition hover:text-white"
          style={{ ["--d" as any]: "0.24s" }}
        >
          <BookOpen size={12} />
          New here? Read the handbook first
        </Link>
      </div>
    </div>
  );
}

function StepPip({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui text-2xs font-semibold uppercase tracking-wider transition ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : done
            ? "border-white/20 text-white/60"
            : "border-white/10 text-white/35"
      }`}
    >
      {done ? <ShieldCheck size={10} /> : null}
      {label}
    </span>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2.5 font-ui text-xs leading-relaxed text-white"
    >
      {message}
    </p>
  );
}
