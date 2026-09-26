import { chain, contractFor, ContractName } from "../lib/chain";
import { db } from "../lib/supabase";
import { logger } from "../lib/logger";
import { env } from "../config/env";

/**
 * Materialises contract events into public.chain_events.
 *
 * Polling rather than a websocket subscription, deliberately: a dropped socket
 * silently stops delivering events, whereas a poll that fails simply retries
 * from the last block it recorded. The cursor lives in the database, so a
 * restart does not lose or duplicate history.
 *
 * The chain stays authoritative. This table is a read cache so a dashboard can
 * sort and filter without paying for an RPC round trip per row.
 */

const CONTRACTS: ContractName[] = ["EvidenceChain", "SummonsChain", "BailChain"];

// Sepolia RPC providers cap eth_getLogs ranges; 2000 blocks is comfortably safe.
const MAX_RANGE = 2000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function cursorFor(contract: ContractName, latest: number): Promise<number> {
  const { data } = await db
    .from("indexer_state")
    .select("last_block")
    .eq("contract", contract)
    .maybeSingle();

  if (data?.last_block) return Number(data.last_block);

  // First run: start from the deployment block rather than genesis, so a fresh
  // index of a Sepolia deployment does not walk millions of empty blocks.
  const start = Math.max(0, latest - MAX_RANGE);
  await db.from("indexer_state").upsert({ contract, last_block: start }, { onConflict: "contract" });
  return start;
}

function serialiseArgs(parsed: { fragment: { inputs: { name: string }[] }; args: readonly unknown[] }) {
  const out: Record<string, unknown> = {};
  parsed.fragment.inputs.forEach((input, index) => {
    const value = parsed.args[index];
    // bigint is not JSON-serialisable, and a block timestamp must not lose
    // precision, so every integer is stored as a decimal string.
    out[input.name] = typeof value === "bigint" ? value.toString() : value;
  });
  return out;
}

async function indexContract(name: ContractName, latest: number): Promise<number> {
  const contract = contractFor(name);
  const from = (await cursorFor(name, latest)) + 1;
  if (from > latest) return 0;

  const to = Math.min(latest, from + MAX_RANGE - 1);
  const logs = await contract.queryFilter("*", from, to);

  let inserted = 0;
  const rows: any[] = [];

  for (const log of logs) {
    const parsed = (log as any).fragment
      ? (log as any)
      : contract.interface.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed) continue;

    const eventName: string | undefined = (log as any).eventName ?? parsed.name;
    if (!eventName) continue;

    rows.push({
      contract: name,
      event_name: eventName,
      block_number: log.blockNumber,
      tx_hash: log.transactionHash,
      log_index: (log as any).index ?? (log as any).logIndex ?? 0,
      args: serialiseArgs(parsed),
    });
  }

  if (rows.length > 0) {
    // onConflict on (tx_hash, log_index) makes a replayed range idempotent.
    const { error, count } = await db
      .from("chain_events")
      .upsert(rows, { onConflict: "tx_hash,log_index", ignoreDuplicates: true, count: "exact" });
    if (error) {
      logger.warn("Could not store chain events", { contract: name, error: error.message });
      return 0;
    }
    inserted = count ?? rows.length;
  }

  await db.from("indexer_state").upsert({ contract: name, last_block: to, updated_at: new Date().toISOString() }, { onConflict: "contract" });

  return inserted;
}

export async function runOnce(): Promise<{ indexed: number; upTo: number | null }> {
  if (!chain.isReady) return { indexed: 0, upTo: null };

  const latest = await chain.blockNumber();
  if (latest === null) return { indexed: 0, upTo: null };

  let total = 0;
  for (const name of CONTRACTS) {
    try {
      total += await indexContract(name, latest);
    } catch (error) {
      logger.warn("Indexer pass failed for a contract", {
        contract: name,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  if (total > 0) logger.info("Indexed contract events", { count: total, upTo: latest });
  return { indexed: total, upTo: latest };
}

export function startIndexer(): void {
  if (!env.INDEXER_ENABLED) {
    logger.info("Event indexer disabled by INDEXER_ENABLED=false");
    return;
  }
  if (!chain.isReady) {
    logger.warn("Event indexer not started: the chain bridge is not ready", { reason: chain.reason });
    return;
  }
  if (timer) return;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } finally {
      running = false;
    }
  };

  void tick();
  timer = setInterval(tick, Math.max(5000, env.SWEEP_INTERVAL_MS / 4));
  timer.unref();
  logger.info("Event indexer started");
}

export function stopIndexer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
