function escapePdf(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

/**
 * Builds a minimal but valid single-page PDF from a title and lines of text.
 * No external dependency — emits raw PDF structures (objects, xref, trailer).
 */
function buildPdf(title: string, lines: string[]): Blob {
  const W = 595.28; // A4 width in pt
  const H = 841.89; // A4 height in pt
  const marginX = 56;
  let y = H - 70;

  const content: string[] = [];
  content.push(`BT /F2 18 Tf 0.055 0.106 0.165 rg ${marginX} ${y} Td (${escapePdf(title)}) Tj ET`);
  y -= 26;
  content.push(`BT /F1 9 Tf 0.357 0.404 0.451 rg ${marginX} ${y} Td (APJ Abdul Kalam Technological University - Student Document \\(mock\\)) Tj ET`);
  y -= 18;
  // hairline
  content.push(`${marginX} ${y} ${W - marginX} ${y} re 0.82 0.847 0.871 RG 0.75 w S`);
  y -= 30;

  for (const raw of lines) {
    const text = String(raw);
    if (text === "---") {
      content.push(`${marginX} ${y} ${W - marginX} ${y} re 0.92 0.933 0.949 RG 0.5 w S`);
      y -= 22;
      continue;
    }
    content.push(`BT /F1 11 Tf 0.055 0.106 0.165 rg ${marginX} ${y} Td (${escapePdf(text)}) Tj ET`);
    const wrapped = Math.ceil(text.length / 95);
    y -= 20 * Math.max(1, wrapped);
  }

  y -= 24;
  content.push(`BT /F1 8 Tf 0.541 0.573 0.627 rg ${marginX} ${y} Td (Generated ${new Date().toLocaleString("en-IN")} \\u2014 demonstration document, not an official university record.) Tj ET`);

  const stream = content.join("\n");
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>");
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((off) => {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadMockPdf(filename: string, title: string, lines: string[]) {
  const blob = buildPdf(title, lines);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
