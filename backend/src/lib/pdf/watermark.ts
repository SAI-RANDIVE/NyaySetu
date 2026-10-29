/**
 * A diagonal mark across every page of a document that is not final: an
 * unsigned certificate, a seizure memo awaiting signatures, a final report that
 * no authorised officer has approved. Drawn faintly so the text stays legible,
 * and as real text so a copy-paste of the page carries it too.
 */
export function stampWatermark(doc: PDFKit.PDFDocument, text: string, page: { width: number; height: number }): void {
  doc.save();
  doc.opacity(0.09);
  doc.rotate(-35, { origin: [page.width / 2, page.height / 2] });
  doc
    .font("Helvetica-Bold")
    .fontSize(text.length > 18 ? 46 : 64)
    .fillColor("#b91c1c")
    .text(text, 0, page.height / 2 - 30, { width: page.width, align: "center", lineBreak: false });
  doc.restore();
}
