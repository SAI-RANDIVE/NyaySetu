import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Gavel } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { ROLE_HOME } from "./lib/format";
import type { Role } from "./lib/api";
import { PortalShell } from "./components/PortalShell";
import { LinkButton, Spinner } from "./components/ui";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Handbook from "./pages/Handbook";
import { CaseDossierPage, CasesPage, EvidenceDetailPage } from "./pages/shared";
import { CapturePage, PoliceDashboard } from "./pages/police";
import { ForensicInbox } from "./pages/forensic";
import { ProsecutorDashboard } from "./pages/prosecutor";
import { BailBoard, JudgeDashboard, SummonsPage } from "./pages/judge";
import { DefenceVerify } from "./pages/defence";
import { AccusedCheckIn, AccusedHome, AccusedSummons } from "./pages/accused";
import { AdminAudit, AdminChain, AdminOverview, AdminUsers } from "./pages/admin";

/**
 * Routing.
 *
 * Each portal is gated twice: the route only renders for the right role, and
 * the API refuses anything the role is not entitled to. Neither gate is the
 * security boundary on its own, and the client one is purely so a user never
 * sees a screen that would only produce 403s.
 */

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grad-primary text-on-primary">
          <Gavel size={22} />
        </span>
        <Spinner />
        <p className="font-ui text-xs text-muted">Restoring your session…</p>
      </div>
    </div>
  );
}

/** Requires a session, and optionally a specific set of roles. */
function Guard({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!user) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    // Not an error: send them to their own portal rather than a dead end.
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <PortalShell>{children}</PortalShell>;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5">
      <div className="max-w-md text-center">
        <p className="font-jakarta text-2xs font-bold uppercase tracking-[0.16em] text-primary">404</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-text">
          There is nothing at this address
        </h1>
        <p className="mt-3 font-ui text-sm leading-relaxed text-muted">
          The link may be stale, or the page may belong to a role other than yours.
        </p>
        <LinkButton to={user ? ROLE_HOME[user.role] : "/"} className="mt-6">
          {user ? "Back to your portal" : "Back to the start"}
        </LinkButton>
      </div>
    </div>
  );
}

/**
 * The case and evidence screens are identical for every role; what differs is
 * what the API returns. So one generator builds the three routes each portal
 * needs, rather than six copies drifting apart.
 */
function caseRoutes(basePath: string, roles: Role[]) {
  return [
    <Route
      key={`${basePath}-cases`}
      path={`${basePath}/cases`}
      element={
        <Guard roles={roles}>
          <CasesPage basePath={`${basePath}/cases`} />
        </Guard>
      }
    />,
    <Route
      key={`${basePath}-evidence`}
      path={`${basePath}/cases/evidence/:evidenceId`}
      element={
        <Guard roles={roles}>
          <EvidenceDetailPage />
        </Guard>
      }
    />,
    <Route
      key={`${basePath}-case`}
      path={`${basePath}/cases/:caseId`}
      element={
        <Guard roles={roles}>
          <CaseDossierPage basePath={`${basePath}/cases`} />
        </Guard>
      }
    />,
  ];
}

export default function App() {
  return (
    <Routes>
      {/* ------------------------------------------------------- public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      {/* Public on purpose: a defence lawyer or an accused person needs to
          understand what the system claims about them before they have an
          account, and putting this behind a sign-in would defeat that. */}
      <Route path="/handbook" element={<Handbook />} />

      {/* -------------------------------------------------------- police */}
      <Route
        path="/police"
        element={
          <Guard roles={["police"]}>
            <PoliceDashboard />
          </Guard>
        }
      />
      <Route
        path="/police/capture"
        element={
          <Guard roles={["police"]}>
            <CapturePage />
          </Guard>
        }
      />
      {caseRoutes("/police", ["police"])}

      {/* ------------------------------------------------------ forensic */}
      <Route
        path="/forensic"
        element={
          <Guard roles={["forensic_lab"]}>
            <ForensicInbox />
          </Guard>
        }
      />
      {caseRoutes("/forensic", ["forensic_lab"])}

      {/* ---------------------------------------------------- prosecutor */}
      <Route
        path="/prosecutor"
        element={
          <Guard roles={["prosecutor"]}>
            <ProsecutorDashboard />
          </Guard>
        }
      />
      {caseRoutes("/prosecutor", ["prosecutor"])}

      {/* --------------------------------------------------------- judge */}
      <Route
        path="/judge"
        element={
          <Guard roles={["judge"]}>
            <JudgeDashboard />
          </Guard>
        }
      />
      <Route
        path="/judge/summons"
        element={
          <Guard roles={["judge"]}>
            <SummonsPage />
          </Guard>
        }
      />
      <Route
        path="/judge/bail"
        element={
          <Guard roles={["judge"]}>
            <BailBoard />
          </Guard>
        }
      />
      {caseRoutes("/judge", ["judge"])}

      {/* ------------------------------------------------------- defence */}
      <Route
        path="/defence"
        element={
          <Guard roles={["defence_lawyer"]}>
            <DefenceVerify />
          </Guard>
        }
      />
      {caseRoutes("/defence", ["defence_lawyer"])}

      {/* ------------------------------------------------------- accused */}
      <Route
        path="/accused"
        element={
          <Guard roles={["accused"]}>
            <AccusedHome />
          </Guard>
        }
      />
      <Route
        path="/accused/summons"
        element={
          <Guard roles={["accused"]}>
            <AccusedSummons />
          </Guard>
        }
      />
      <Route
        path="/accused/checkin"
        element={
          <Guard roles={["accused"]}>
            <AccusedCheckIn />
          </Guard>
        }
      />

      {/* --------------------------------------------------- court admin */}
      <Route
        path="/admin"
        element={
          <Guard roles={["court_admin"]}>
            <AdminOverview />
          </Guard>
        }
      />
      <Route
        path="/admin/users"
        element={
          <Guard roles={["court_admin"]}>
            <AdminUsers />
          </Guard>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <Guard roles={["court_admin"]}>
            <AdminAudit />
          </Guard>
        }
      />
      <Route
        path="/admin/chain"
        element={
          <Guard roles={["court_admin"]}>
            <AdminChain />
          </Guard>
        }
      />
      {caseRoutes("/admin", ["court_admin"])}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
