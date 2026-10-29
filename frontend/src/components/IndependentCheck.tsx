import { useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, Globe2, XCircle } from "lucide-react";
import type { PublicPassport } from "../lib/api";
import { DigestDrop, type Digested } from "./DigestDrop";

/**
 * Verification that does not trust NyaySetu at all.
 *
 * The browser asks a public Ethereum node — not NyaySetu's server — for the
 * registration transaction, checks it succeeded and was sent to the published
 * EvidenceChain contract, decodes the committed digest from the
 * EvidenceRegistered event, and compares it with what NyaySetu reports and,
 * when the anchored value is the file's own digest, with a file the visitor
 * drops here (hashed in the browser). If no public node answers, the result is
 * NOT VERIFIED, never a cached "yes".
 */

/** Public Sepolia endpoints that answer browsers directly (CORS). Tried in order. */
const PUBLIC_RPC: Record<number, string[]> = {
  11155111: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org", "https://rpc.sepolia.org"],
};

/** The EvidenceChain address published on the project page and verified on Etherscan. */
const PUBLISHED_CONTRACT: Record<number, string> = {
  11155111: "0x383d996de8cd2a19acc8d66cdea2f4a3b1e7f6d4",
};

/** keccak256("EvidenceRegistered(uint256,bytes32,bytes32,int256,int256,bytes32,uint256,address)"), checked against the compiled ABI. */
const EVIDENCE_REGISTERED = "0xc431abdeb298898663297126378c96835882687c5ad0ca1bdf50f800951b86a6";

type Step = { label: string; status: "ok" | "fail" | "unknown"; detail: string };

async function rpc(urls: string[], method: string, params: unknown[]): Promise<{ result: any; node: string }> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = await response.json();
      if (body.error) throw new Error(body.error.message);
      return { result: body.result, node: new URL(url).host };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No public node answered");
}

export function IndependentCheck({ passport }: { passport: PublicPassport }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [chainDigest, setChainDigest] = useState<string | null>(null);
  const [file, setFile] = useState<Digested | null>(null);
  const [busy, setBusy] = useState(false);
  const chainId = passport.network?.chainId ?? 0;
  const tx = passport.transaction.hash;
  const nodes = PUBLIC_RPC[chainId];

  if (!tx || !nodes) return null;

  const run = async () => {
    setBusy(true);
    const out: Step[] = [];
    try {
      const { result: receipt, node } = await rpc(nodes, "eth_getTransactionReceipt", [tx]);
      if (!receipt) {
        out.push({ label: "Transaction", status: "fail", detail: `Not found on ${node}.` });
        return;
      }
      const ok = receipt.status === "0x1";
      out.push({ label: "Transaction", status: ok ? "ok" : "fail", detail: `${ok ? "Succeeded" : "Reverted"} in block ${parseInt(receipt.blockNumber, 16).toLocaleString("en-IN")}, read from ${node}.` });

      const published = PUBLISHED_CONTRACT[chainId];
      const to = String(receipt.to ?? "").toLowerCase();
      out.push({ label: "Contract", status: to === published ? "ok" : "fail", detail: `Sent to ${receipt.to}${to === published ? " — the published EvidenceChain contract." : " — NOT the published EvidenceChain contract."}` });

      // EvidenceRegistered(uint256 indexed, bytes32 indexed, bytes32 fileHash, …):
      // the committed digest is the first word of the event data.
      const log = (receipt.logs as any[]).find(
        (l) => String(l.address).toLowerCase() === published && String(l.topics?.[0]).toLowerCase() === EVIDENCE_REGISTERED && String(l.data).length >= 66
      );
      const digest = log ? `0x${String(log.data).slice(2, 66)}` : null;
      setChainDigest(digest);
      out.push({ label: "Committed digest", status: digest ? "ok" : "fail", detail: digest ?? "No registration event in this transaction." });

      const { result: block } = await rpc(nodes, "eth_getBlockByNumber", [receipt.blockNumber, false]);
      if (block) out.push({ label: "Block time", status: "ok", detail: new Date(parseInt(block.timestamp, 16) * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" });

      if (digest && passport.digest) {
        const agree = digest.toLowerCase() === passport.digest.toLowerCase();
        out.push({ label: "NyaySetu's record", status: agree ? "ok" : "fail", detail: agree ? "Agrees with the ledger." : "DISAGREES with the ledger — trust the ledger." });
      }
    } catch {
      out.push({ label: "Public node", status: "unknown", detail: "No public Ethereum node answered. NOT VERIFIED — try again; nothing cached is shown as verified." });
    } finally {
      setSteps(out);
      setBusy(false);
    }
  };

  const fileVerdict: Step | null =
    file && chainDigest
      ? passport.anchorMode === "file"
        ? {
            label: "Your file",
            status: file.sha256.toLowerCase() === chainDigest.toLowerCase() ? "ok" : "fail",
            detail: file.sha256.toLowerCase() === chainDigest.toLowerCase() ? "Its SHA-256, computed in your browser, equals the digest on the ledger." : "Its SHA-256 does not equal the digest on the ledger: not the registered file, or changed since.",
          }
        : {
            label: "Your file",
            status: "unknown",
            detail:
              "This item was captured live, so the ledger holds the digest of its capture manifest (file digest + device time + position), not of the file alone. Reproducing it needs the manifest, which contains the location and is shown only to people assigned to the case. Use the check above, which NyaySetu performs against the same ledger value.",
          }
      : null;

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-ui text-xs font-bold uppercase tracking-wider text-primary">
        <Globe2 size={14} aria-hidden /> Check it without NyaySetu
      </h2>
      <p className="mt-2 font-ui text-sm leading-relaxed text-muted">
        Your browser asks a public Ethereum node directly — this server is not involved — for the registration transaction and the digest it committed.
      </p>
      <details className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-ui text-xs leading-relaxed text-muted">
        <summary className="cursor-pointer font-semibold text-text">Four values that are not interchangeable</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li><strong className="text-text">File SHA-256</strong> — the fingerprint of the exact bytes of the file.</li>
          <li><strong className="text-text">Capture manifest SHA-256</strong> — for live captures, the fingerprint of the record made at capture: file fingerprint, device time, position, device.</li>
          <li><strong className="text-text">On-chain committed digest</strong> — whichever of those two was written to the ledger ({passport.anchorMode === "manifest" ? "here, the manifest digest" : "here, the file digest"}).</li>
          <li><strong className="text-text">Transaction hash</strong> — the identifier of the ledger transaction that wrote it.</li>
        </ul>
        <p className="mt-2">A match shows the bytes are unchanged since registration. It does not show that what they depict is true, or that the evidence is admissible.</p>
      </details>
      {!steps ? (
        <button type="button" disabled={busy} onClick={() => void run()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-fill px-5 py-2.5 font-ui text-sm font-semibold text-on-primary disabled:opacity-60">
          {busy ? "Asking the public node…" : "Read the ledger directly"}
        </button>
      ) : (
        <>
          <ol className="mt-4 space-y-2">
            {[...steps, ...(fileVerdict ? [fileVerdict] : [])].map((s) => (
              <li key={s.label} className="flex items-start gap-2 font-ui text-xs leading-relaxed">
                {s.status === "ok" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" aria-hidden /> : s.status === "fail" ? <XCircle size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden /> : <CircleDashed size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
                <span>
                  <span className="font-semibold text-text">{s.label}:</span> <span className="break-all text-muted">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          {chainDigest && !file && (
            <div className="mt-4">
              <DigestDrop label="Drop the file to compare it with the ledger value" onDigest={setFile} />
            </div>
          )}
          {passport.transaction.explorer && (
            <a href={passport.transaction.explorer} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex items-center gap-1.5 font-ui text-xs font-semibold text-primary hover:underline">
              Or open it on a block explorer <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </>
      )}
    </section>
  );
}
