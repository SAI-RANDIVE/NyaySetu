import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env, capabilities } from "./config/env";
import { reportPosture } from "./config/posture";
import { logger } from "./lib/logger";
import { initChain, chain } from "./lib/chain";
import { pingDatabase } from "./lib/supabase";
import { otpProvider } from "./otp";
import { loadSession, requirePasswordSettled } from "./middleware/auth";
import { csrfProtection } from "./middleware/csrf";
import { generalLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { startIndexer, stopIndexer } from "./indexer/eventIndexer";
import { startScheduler, stopScheduler } from "./jobs/scheduler";

import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import caseRoutes from "./routes/cases";
import evidenceRoutes from "./routes/evidence";
import summonsRoutes from "./routes/summons";
import bailRoutes from "./routes/bail";
import aiRoutes from "./routes/ai";
import adminRoutes from "./routes/admin";

const app = express();

// Railway and Vercel sit behind a proxy, so req.ip and Secure cookies need this.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    // The API serves JSON, not HTML, so a restrictive CSP costs nothing.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  })
);

app.use(
  cors({
    // Credentials are cookies, so the origin list is explicit. A wildcard here
    // would be rejected by the browser anyway, and would be wrong if it were not.
    origin(origin, callback) {
      if (!origin) return callback(null, true); // curl, mobile app, server-to-server
      if (env.isOriginAllowed(origin)) return callback(null, true);

      // Error, not warn. A browser shows this as "No Access-Control-Allow-Origin"
      // with no hint that a list exists anywhere, so the log has to name both
      // sides of the comparison or the operator has nothing to go on. This is the
      // single most common reason a working API looks like a dead one.
      logger.error(
        "Refused a cross-origin request: this origin is not in CORS_ORIGINS. " +
          "Add it on the API host, exactly, and redeploy.",
        { refused: origin, configured: env.corsOrigins }
      );
      return callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "x-csrf-token"],
    exposedHeaders: ["x-nyaysetu-sha256", "x-nyaysetu-integrity"],
    maxAge: 600,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());

// Order matters: the session must be loaded before CSRF can compare against it,
// and before the rate limiter can key on a session id.
app.use(loadSession);
app.use(generalLimiter);
app.use(csrfProtection);

app.use("/api/health", healthRoutes);
// Not behind requirePasswordSettled: this router is how the password is changed.
app.use("/api/auth", authRoutes);

// Everything that does real work waits until an invited account has replaced the
// temporary password it was emailed.
app.use("/api/cases", requirePasswordSettled, caseRoutes);
app.use("/api/evidence", requirePasswordSettled, evidenceRoutes);
app.use("/api/summons", requirePasswordSettled, summonsRoutes);
app.use("/api/bail", requirePasswordSettled, bailRoutes);
app.use("/api/ai", requirePasswordSettled, aiRoutes);
app.use("/api/admin", requirePasswordSettled, adminRoutes);

app.get("/", (_req, res) => {
  res.json({
    name: "NyaySetu API",
    version: "1.0.0",
    modules: {
      SaakshyaSetu: "/api/evidence",
      SammansSetu: "/api/summons",
      JaminSetu: "/api/bail",
    },
    health: "/api/health",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  initChain();

  const databaseReachable = await pingDatabase();
  if (!databaseReachable) {
    logger.error(
      "Supabase is not reachable. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, " +
        "and that the migrations in database/migrations have been run."
    );
  }

  const server = app.listen(env.PORT, () => {
    logger.info("NyaySetu API listening", {
      port: env.PORT,
      environment: env.NODE_ENV,
      database: databaseReachable ? "reachable" : "UNREACHABLE",
      chain: chain.isReady ? chain.network : `not ready (${chain.reason})`,
      storage: capabilities.ipfs ? "pinata" : "local-fallback",
      ai: capabilities.ai ? "configured" : "not configured",
      otpProvider: `${otpProvider.name}${otpProvider.isAuthorisedForProduction ? "" : " (simulated)"}`,
      corsOrigins: env.corsOrigins,
    });

    // Said separately, and loudly, because getting this wrong is invisible from
    // the API side: every route works, every health check passes, and the only
    // symptom is a browser on another origin being refused before it arrives.
    if (env.isProduction && env.corsOrigins.every((o) => o.startsWith("http://localhost"))) {
      logger.error(
        "CORS_ORIGINS still lists only localhost while NODE_ENV=production. " +
          "No deployed site will be able to reach this API.",
        { configured: env.corsOrigins }
      );
    }
    if (env.corsOrigins.some((o) => o.includes("*"))) {
      logger.warn(
        "CORS_ORIGINS contains a wildcard. Every site matching it may send " +
          "credentialed requests to this API.",
        { configured: env.corsOrigins.filter((o) => o.includes("*")) }
      );
    }
  });

  startIndexer();
  startScheduler();

  // Last, so it is the final thing in the log rather than the first: whoever is
  // reading a boot log is looking at the end of it.
  reportPosture();

  const shutdown = (signal: string) => {
    logger.info("Shutting down", { signal });
    stopIndexer();
    stopScheduler();
    server.close(() => process.exit(0));
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { reason });
  });
}

void start();

export default app;
