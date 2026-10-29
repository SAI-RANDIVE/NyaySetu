import { inflateSync } from "zlib";

/**
 * Extracts the text of a pdfkit document. pdfkit writes each run of text as
 * hex strings inside TJ arrays; decoding them gives the text in order. Content
 * streams may be Flate-compressed (the court documents are), so each stream is
 * inflated first when it can be. Enough to assert what a document says, not a
 * general PDF parser.
 */
export function pdfText(pdf: Buffer | ArrayBuffer): string {
  const bytes = Buffer.from(pdf as ArrayBuffer);
  const raw = bytes.toString("latin1");
  const sources: string[] = [raw];

  const marker = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    try {
      sources.push(inflateSync(bytes.subarray(start, end)).toString("latin1"));
    } catch {
      // Not compressed, or not a content stream: already covered by the raw pass.
    }
    marker.lastIndex = end + "endstream".length;
  }

  const out: string[] = [];
  for (const source of sources) {
    for (const block of source.match(/BT[\s\S]*?ET/g) ?? []) {
      const runs = [...block.matchAll(/<([0-9a-fA-F]+)>/g)].map((r) => Buffer.from(r[1], "hex").toString("latin1"));
      out.push(runs.join(""));
    }
  }
  return out.join("\n");
}
