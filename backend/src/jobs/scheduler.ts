import { env } from "../config/env";
import { logger } from "../lib/logger";
import { chain } from "../lib/chain";
import { sweepNonDelivery } from "../services/summons.service";
import { sweepMissedCheckIns } from "../services/bail.service";

/**
 * The two jobs that make non-events visible.
 *
 * A chain reacts to transactions. It cannot react to a summons nobody opened or
 * a check-in nobody filed, because nothing happened. Both contracts therefore
 * compute those conditions lazily in views, so dashboards are correct at all
 * times, and these jobs write the conclusions down so the alert exists as a
 * transaction the court can point at.
 *
 * setInterval rather than cron: one process, one schedule, no extra dependency.
 * For a multi-instance deployment set SCHEDULER_ENABLED=false on all but one,
 * or move these to a Railway cron service calling the /sweep endpoints.
 */

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runSweeps(): Promise<{
  summons: { marked: number; ids: string[] };
  bail: { flagged: number; cases: string[] };
}> {
  const summons = await sweepNonDelivery();
  const bail = await sweepMissedCheckIns();

  if (summons.marked > 0 || bail.flagged > 0) {
    logger.info("Sweep completed", {
      summonsMarkedFailed: summons.marked,
      bailMissedCheckIns: bail.flagged,
      cases: bail.cases,
    });
  }
  return { summons, bail };
}

export function startScheduler(): void {
  if (!env.SCHEDULER_ENABLED) {
    logger.info("Scheduler disabled by SCHEDULER_ENABLED=false");
    return;
  }
  if (timer) return;

  const tick = async () => {
    if (running) return;
    if (!chain.isReady) return;
    running = true;
    try {
      await runSweeps();
    } catch (error) {
      logger.error("Sweep failed", { error: error instanceof Error ? error.message : error });
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, env.SWEEP_INTERVAL_MS);
  timer.unref();
  logger.info("Scheduler started", { intervalMs: env.SWEEP_INTERVAL_MS });
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
