/**
 * Renders the documents in docs/submission/ to print-ready A4 PDFs in
 * docs/submission/pdf/, using the same headless Chrome as the UI smoke test.
 *
 *   npm --prefix frontend run docs:pdf
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const { marked } = require("marked");

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const source = join(root, "docs", "submission");
const out = join(source, "pdf");
mkdirSync(out, { recursive: true });

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error("No Chrome or Edge found. Set CHROME_PATH.");
  process.exit(1);
}

const logo = pathToFileURL(join(root, "frontend", "public", "maharashtra-police.png")).href;

const css = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  html, body { background: #ffffff; }
  body { font: 10.5pt/1.55 "Segoe UI", "Noto Sans", "Noto Sans Devanagari", Arial, sans-serif; color: #17221c; }
  h1, h2, h3 { font-family: Georgia, "Noto Serif Devanagari", serif; color: #0b3d2a; line-height: 1.25; }
  h1 { font-size: 22pt; margin: 0 0 6pt; }
  h2 { font-size: 14.5pt; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5px solid #cfe3d8; break-after: avoid; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: #0a6b45; text-decoration: none; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 9.2pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #d5ddd8; padding: 4.5pt 6pt; text-align: left; vertical-align: top; }
  th { background: #eef5f1; font-weight: 600; }
  code { font: 8.6pt Consolas, "Courier New", monospace; background: #f1f4f2; padding: 0 2pt; border-radius: 2pt; overflow-wrap: anywhere; }
  pre { background: #f6f8f7; border: 1px solid #dfe6e2; padding: 8pt; font-size: 7.6pt; line-height: 1.3; overflow: hidden; white-space: pre; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: inherit; }
  blockquote { margin: 6pt 0; padding: 4pt 10pt; border-left: 3px solid #9cc9b2; color: #44544b; background: #f6faf8; }
  hr { border: 0; border-top: 1px solid #dfe6e2; margin: 14pt 0; }
  .masthead { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0a6b45; padding-bottom: 6pt; margin-bottom: 14pt; }
  .masthead span { font: 600 9pt "Segoe UI", Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #0a6b45; }
  .masthead img { height: 40pt; }
`;

const files = readdirSync(source).filter((f) => /^\d\d_.*\.md$/.test(f)).sort();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--allow-file-access-from-files"] });
try {
  for (const file of files) {
    const markdown = readFileSync(join(source, file), "utf8");
    const title = (markdown.match(/^#\s+(.+)$/m)?.[1] ?? file).replace(/[*_`]/g, "");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
      <body><div class="masthead"><span>NyaySetu · न्यायसेतु</span><img src="${logo}" alt=""></div>${marked.parse(markdown)}</body></html>`;
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const target = join(out, file.replace(/\.md$/, ".pdf"));
    await page.pdf({
      path: target,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font:8px Arial,sans-serif;color:#7a867f;padding:0 16mm;display:flex;justify-content:space-between"><span>${title}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    await page.close();
    console.log(`  ${file} → pdf/${file.replace(/\.md$/, ".pdf")}`);
  }
} finally {
  await browser.close();
}
