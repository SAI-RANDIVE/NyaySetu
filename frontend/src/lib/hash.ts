/**
 * Client-side SHA-256, computed before a single byte leaves the device.
 *
 * This is the whole point of the evidence module. If the server hashed the
 * upload, the digest would only prove what the server received, and an officer
 * would have to take the server's word for it. Hashing here means the digest
 * describes the file as it existed on the device, and the server can only
 * agree or refuse.
 *
 * WebCrypto needs a secure context: HTTPS, or localhost. On plain HTTP over a
 * LAN address crypto.subtle is undefined, which is why explainCryptoAvailability
 * exists rather than a silent fallback to a JavaScript SHA-256. A weaker digest
 * that looked the same would be worse than an honest error.
 */

const CHUNK = 8 * 1024 * 1024; // 8 MB, to keep progress responsive on video

export function isCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle?.digest === "function";
}

export function explainCryptoAvailability(): string | null {
  if (isCryptoAvailable()) return null;
  return (
    "Your browser will not give this page a cryptographic digest function. " +
    "WebCrypto needs a secure context, so open NyaySetu over HTTPS or on localhost. " +
    "Evidence capture is disabled rather than falling back to a weaker hash."
  );
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return "0x" + out;
}

/**
 * SHA-256 of a whole file.
 *
 * WebCrypto has no streaming digest, so the file is read in chunks only to
 * report progress; the bytes are concatenated and hashed once. That caps the
 * practical file size at available memory, which is why the API limit is 50 MB.
 */
export async function sha256File(
  file: File | Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const guard = explainCryptoAvailability();
  if (guard) throw new Error(guard);

  if (file.size <= CHUNK) {
    onProgress?.(0.5);
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    onProgress?.(1);
    return toHex(digest);
  }

  const parts: Uint8Array[] = [];
  let read = 0;

  for (let offset = 0; offset < file.size; offset += CHUNK) {
    const slice = file.slice(offset, Math.min(offset + CHUNK, file.size));
    parts.push(new Uint8Array(await slice.arrayBuffer()));
    read += slice.size;
    onProgress?.(read / file.size);
    // Yield, so a 40 MB video does not freeze the tab while it is read.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const combined = new Uint8Array(file.size);
  let cursor = 0;
  for (const part of parts) {
    combined.set(part, cursor);
    cursor += part.length;
  }

  const digest = await crypto.subtle.digest("SHA-256", combined);
  onProgress?.(1);
  return toHex(digest);
}

export async function sha256Text(value: string): Promise<string> {
  const guard = explainCryptoAvailability();
  if (guard) throw new Error(guard);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}

/** Shortens a digest for display without hiding the ends that matter. */
export function shortHash(hash: string | null | undefined, lead = 10, tail = 6): string {
  if (!hash) return "—";
  if (hash.length <= lead + tail + 3) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export function isHash32(value: string): boolean {
  return /^0x[0-9a-f]{64}$/.test(value);
}
