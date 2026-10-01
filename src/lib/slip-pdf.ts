import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Employee, Payslip } from "@/lib/types";
import { buildSlipModel, type SlipRow } from "@/lib/slip";

// Colours taken from the company salary-slip template.
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const DARK = hex("#0A3D26");
const LABEL_BG = hex("#E9F4EB");
const BORDER = hex("#E3EDE7");
const EARN = hex("#2D7C4F");
const DED = hex("#B33A3A");
const PINK = hex("#FDEDED");
const GOLD = hex("#F0CE72");
const GREY = hex("#5F6B64");
const INK = hex("#111111");
const WHITE = rgb(1, 1, 1);
type Color = ReturnType<typeof rgb>;

const PAGE_H = 842;
const LEFT = 50;
const WIDTH = 495;

/** A font plus the companion that holds the rupee sign, which the Latin subset lacks. */
type Family = { font: PDFFont; ext: PDFFont };

const fontFile = (file: string) => readFile(path.join(process.cwd(), "assets", "fonts", file));

/** Renders a salary slip to PDF bytes; shared by the download route and the email action. */
export async function buildSlipPdf(slip: Payslip, employee: Employee | null | undefined) {
  const model = buildSlipModel(slip, employee?.join_date ?? null);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Salary Slip - ${slip.emp_name} - ${model.title.replace("PAYSLIP FOR THE MONTH OF ", "")}`);
  pdf.setAuthor(model.company.name);
  pdf.setCreator(model.company.name);

  const files = await Promise.all([
    fontFile("noto-sans-latin-400-normal.woff"), fontFile("noto-sans-latin-700-normal.woff"),
    fontFile("noto-sans-latin-400-italic.woff"), fontFile("noto-sans-latin-ext-400-normal.woff"),
    fontFile("noto-sans-latin-ext-700-normal.woff"),
  ]);
  const [reg, bold, italic, extReg, extBold] = await Promise.all(files.map((f) => pdf.embedFont(f, { subset: true })));
  const fam = { REG: { font: reg, ext: extReg }, BOLD: { font: bold, ext: extBold }, ITALIC: { font: italic, ext: extReg } };
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo.png")));

  const page = pdf.addPage([595, PAGE_H]);
  const d = new Draw(page, fam);

  // --- Header: logo, company name, rule, title ---
  const logoH = 46;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: LEFT, y: PAGE_H - 40 - logoH, width: logoW, height: logoH });
  d.text(model.company.name, LEFT + logoW + 12, 62, { family: fam.BOLD, size: 14, color: DARK });
  d.text("SALARY SLIP", LEFT + logoW + 12, 80, { family: fam.BOLD, size: 8, color: GREY });
  d.line(LEFT, LEFT + WIDTH, 100, DARK, 1.6);
  d.text(model.title, LEFT + WIDTH / 2, 123, { family: fam.BOLD, size: 10, color: DARK, align: "center" });

  // --- Employee information / Attendance & leave (label, value, label, value) ---
  let top = d.pairTable("Employee Information", model.info, 142, 250);
  top = d.pairTable("Attendance & Leave Details", model.attendance, top + 22, 220);

  // --- Earnings | Deductions ---
  top += 22;
  const colW = 240;
  const rightX = LEFT + WIDTH - colW;
  const rows = Math.max(model.earnings.length, model.deductions.length);
  d.tableHeader("Earnings", EARN, LEFT, top, colW);
  d.tableHeader("Deductions", DED, rightX, top, colW);
  for (let i = 0; i < rows; i++) {
    d.amountRow(model.earnings[i], LEFT, top + 22 + i * 22, colW);
    d.amountRow(model.deductions[i], rightX, top + 22 + i * 22, colW);
  }
  const totalTop = top + 22 + rows * 22;
  d.amountRow({ label: "Gross Earnings", value: model.totalEarnings }, LEFT, totalTop, colW, true);
  d.amountRow({ label: "Total Deductions", value: model.totalDeductions }, rightX, totalTop, colW, true);

  // --- Net pay bar ---
  top = totalTop + 22 + 28;
  d.rect(LEFT, top, WIDTH, 54, DARK);
  d.text("NET PAY FOR THE MONTH:", LEFT + 14, top + 24, { family: fam.BOLD, size: 11, color: GOLD });
  const labelW = d.width("NET PAY FOR THE MONTH:", fam.BOLD, 11);
  d.text(model.net, LEFT + 14 + labelW + 8, top + 25, { family: fam.BOLD, size: 15, color: WHITE });
  d.text(model.words, LEFT + 14, top + 42, { family: fam.ITALIC, size: 8.5, color: WHITE });

  // --- Signature block ---
  top += 54 + 58;
  d.text(`For ${model.company.signatory}`, LEFT + WIDTH, top, { family: fam.REG, size: 8.5, color: INK, align: "right" });
  d.text("Authorised Signatory", LEFT + WIDTH, top + 52, { family: fam.REG, size: 8, color: GREY, align: "right" });

  return { bytes: await pdf.save(), fileName: model.fileName };
}

/** Small drawing toolkit that works in "distance from the top of the page" coordinates. */
class Draw {
  constructor(
    private page: PDFPage,
    private fam: { REG: Family; BOLD: Family; ITALIC: Family },
  ) {}

  rect(x: number, top: number, w: number, h: number, color: Color) {
    this.page.drawRectangle({ x, y: PAGE_H - top - h, width: w, height: h, color });
  }

  line(x1: number, x2: number, top: number, color: Color, thickness = 0.7) {
    this.page.drawLine({ start: { x: x1, y: PAGE_H - top }, end: { x: x2, y: PAGE_H - top }, thickness, color });
  }

  private segments(text: string) {
    return text.split(/(₹)/).filter(Boolean).map((t) => ({ t, rupee: t === "₹" }));
  }

  width(text: string, family: Family, size: number) {
    return this.segments(text).reduce((sum, s) => sum + (s.rupee ? family.ext : family.font).widthOfTextAtSize(s.t, size), 0);
  }

  /** Draws text with its baseline `top` points from the top of the page; shrinks to fit `maxWidth`. */
  text(
    text: string, x: number, top: number,
    o: { family: Family; size: number; color: Color; align?: "left" | "center" | "right"; maxWidth?: number },
  ) {
    let size = o.size;
    while (o.maxWidth && size > 6.5 && this.width(text, o.family, size) > o.maxWidth) size -= 0.25;
    const w = this.width(text, o.family, size);
    let cursor = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    for (const s of this.segments(text)) {
      const font = s.rupee ? o.family.ext : o.family.font;
      this.page.drawText(s.t, { x: cursor, y: PAGE_H - top, size, font, color: o.color });
      cursor += font.widthOfTextAtSize(s.t, size);
    }
  }

  /** Section header + label/value/label/value table. Returns the top position just below the table. */
  pairTable(title: string, cells: SlipRow[], top: number, headerW: number) {
    const { BOLD } = this.fam;
    this.rect(LEFT, top, headerW, 22, DARK);
    this.text(title, LEFT + 9, top + 15, { family: BOLD, size: 9.5, color: WHITE });
    const cols = [130, 120, 112, 133]; // label, value, label, value
    const rowH = 25;
    let y = top + 22;
    for (let i = 0; i < cells.length; i += 2) {
      let x = LEFT;
      [cells[i], cells[i + 1]].forEach((cell, k) => {
        const labelW = cols[k * 2];
        const valueW = cols[k * 2 + 1];
        const danger = cell?.tone === "danger";
        this.rect(x, y, labelW, rowH, LABEL_BG);
        if (danger) this.rect(x + labelW, y, valueW, rowH, PINK);
        if (cell) {
          this.text(cell.label, x + 9, y + 16, { family: BOLD, size: 8.5, color: GREY, maxWidth: labelW - 14 });
          this.text(cell.value, x + labelW + 8, y + 16, { family: BOLD, size: 9, color: danger ? DED : INK, maxWidth: valueW - 12 });
        }
        x += labelW + valueW;
      });
      this.line(LEFT, LEFT + WIDTH, y + rowH, BORDER);
      y += rowH;
    }
    const mid = LEFT + cols[0] + cols[1];
    this.page.drawLine({ start: { x: mid, y: PAGE_H - top - 22 }, end: { x: mid, y: PAGE_H - y }, thickness: 0.7, color: BORDER });
    return y;
  }

  tableHeader(title: string, color: Color, x: number, top: number, w: number) {
    this.rect(x, top, w, 22, color);
    this.text(title, x + 9, top + 15, { family: this.fam.BOLD, size: 9, color: WHITE });
    this.text("Amount (₹)", x + w - 9, top + 15, { family: this.fam.BOLD, size: 9, color: WHITE, align: "right" });
  }

  amountRow(row: SlipRow | undefined, x: number, top: number, w: number, total = false) {
    if (!row) return;
    const family = total ? this.fam.BOLD : this.fam.REG;
    this.text(row.label, x + 9, top + 15, { family, size: 9, color: INK });
    this.text(row.value, x + w - 9, top + 15, { family, size: 9, color: row.tone === "danger" ? DED : INK, align: "right" });
    this.line(x, x + w, top + 22, BORDER);
  }
}
