import PDFDocument from "pdfkit";

/**
 * A plain, court-style document from an editable template: title, sections,
 * optional tables and digests, signature blocks, and a footer printed on every
 * page. Used for the Section 63 certificate (F11), the seizure memo and the
 * chain-of-custody form (F13, F15).
 *
 * Content streams are left uncompressed. These are short text documents, and an
 * uncompressed stream means the digests printed in them can be found by anyone
 * with a text tool — which is how the tests check them, and how a sceptic could.
 */

const A4 = { width: 595.28, height: 841.89 };
const M = 56;
const W = A4.width - 2 * M;

export interface TemplateDocument {
  title: string;
  reference?: string | null;
  subtitle?: string | null;
  sections: { heading: string; body: string }[];
  tables?: { heading: string; columns: string[]; widths: number[]; rows: string[][] }[];
  digestLines?: [string, string][];
  signatures?: { role: string; name: string | null; designation: string | null }[];
  footer: string;
}

export async function buildTemplatePdf(input: TemplateDocument): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    compress: false,
    bufferPages: true,
    margins: { top: M, bottom: M + 20, left: M, right: M },
    info: { Title: input.title, Author: "NyaySetu" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Times-Bold").fontSize(14).fillColor("#000").text(input.title, { align: "center" });
  if (input.subtitle) doc.moveDown(0.3).font("Times-Italic").fontSize(10).text(input.subtitle, { align: "center" });
  if (input.reference) doc.moveDown(0.3).font("Courier").fontSize(9).text(`Reference: ${input.reference}`, { align: "center" });
  doc.moveDown(1);

  for (const section of input.sections) {
    doc.font("Times-Bold").fontSize(11).text(section.heading);
    doc.moveDown(0.25);
    doc.font("Times-Roman").fontSize(10.5).text(section.body, { align: "justify", lineGap: 2 });
    doc.moveDown(0.8);
  }

  for (const table of input.tables ?? []) {
    doc.font("Times-Bold").fontSize(11).text(table.heading);
    doc.moveDown(0.3);
    const draw = (cells: string[], bold: boolean) => {
      const top = doc.y;
      let x = M;
      let height = 0;
      doc.font(bold ? "Times-Bold" : "Times-Roman").fontSize(9);
      cells.forEach((cell, i) => {
        const h = doc.heightOfString(cell, { width: table.widths[i] - 6 });
        height = Math.max(height, h);
        doc.text(cell, x + 3, top + 3, { width: table.widths[i] - 6 });
        x += table.widths[i];
      });
      doc.moveTo(M, top).lineTo(M + W, top).strokeColor("#888").lineWidth(0.5).stroke();
      doc.y = top + height + 7;
      if (doc.y > A4.height - M - 60) doc.addPage();
    };
    draw(table.columns, true);
    for (const row of table.rows) draw(row, false);
    doc.moveTo(M, doc.y).lineTo(M + W, doc.y).strokeColor("#888").stroke();
    doc.x = M;
    doc.moveDown(0.8);
  }

  if (input.digestLines?.length) {
    doc.font("Times-Bold").fontSize(11).text("Digests");
    doc.moveDown(0.25);
    for (const [label, value] of input.digestLines) {
      doc.font("Times-Roman").fontSize(9.5).text(label);
      doc.font("Courier").fontSize(8.5).text(value);
      doc.moveDown(0.3);
    }
    doc.moveDown(0.6);
  }

  if (input.signatures?.length) {
    if (doc.y > A4.height - M - 160) doc.addPage();
    doc.moveDown(1.5);
    const columnWidth = W / input.signatures.length;
    const top = doc.y;
    input.signatures.forEach((signature, index) => {
      const x = M + index * columnWidth;
      doc.moveTo(x + 4, top + 40).lineTo(x + columnWidth - 16, top + 40).strokeColor("#000").lineWidth(0.6).stroke();
      doc.font("Times-Roman").fontSize(9).text("Signature", x + 4, top + 44);
      doc.font("Times-Bold").fontSize(9.5).text(signature.role, x + 4, top + 58, { width: columnWidth - 20 });
      doc.font("Times-Roman").fontSize(9.5).text(`Name: ${signature.name ?? "____________________"}`, { width: columnWidth - 20 });
      doc.text(`Designation: ${signature.designation ?? "____________________"}`, { width: columnWidth - 20 });
      doc.text("Date: ______________   Place: ______________", { width: columnWidth - 20 });
    });
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Times-Italic")
      .fontSize(8)
      .fillColor("#444")
      .text(`${input.footer}   Page ${i + 1} of ${range.count}`, M, A4.height - M + 4, { width: W, align: "center" });
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  return done;
}
