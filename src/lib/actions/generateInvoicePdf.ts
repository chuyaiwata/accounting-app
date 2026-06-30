"use server";

import { auth } from "@/auth";
import { ensureAppFolder, ensureSubFolder, uploadBinaryFile, readJsonl, uploadTextFile } from "@/lib/drive/client";
import { loadSettings } from "@/lib/actions/settings";
import { listCounterparties } from "@/lib/actions/clients";
import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Invoice, Counterparty, CompanyInfo, BankAccountInfo } from "@/lib/types";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";

const INVOICES_FILE = "invoices.jsonl";

async function loadFont(): Promise<Uint8Array> {
  const fontPath = path.join(process.cwd(), "public", "fonts", "MPLUS1p-Regular.ttf");
  const buffer = await fs.readFile(fontPath);
  return new Uint8Array(buffer);
}

const BLACK: RGB = rgb(0, 0, 0);
const DARK_GRAY: RGB = rgb(0.2, 0.2, 0.2);
const MID_GRAY: RGB = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY: RGB = rgb(0.8, 0.8, 0.8);

function drawText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color: RGB = BLACK) {
  page.drawText(text, { x, y, size, font, color });
}

function drawTextRight(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color: RGB = BLACK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - width, y, size, font, color });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness: number = 0.5, color: RGB = LIGHT_GRAY) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

export async function generateInvoicePdf(invoiceId: string): Promise<{ ok: boolean; error?: string; fileId?: string }> {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return { ok: false, error: "認証が必要です" };
    }
    const accessToken = session.accessToken;

    const folderId = await ensureAppFolder(accessToken);
    const invoices = await readJsonl<Invoice>(accessToken, folderId, INVOICES_FILE);
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      return { ok: false, error: "請求書が見つかりません" };
    }

    const [settings, counterparties] = await Promise.all([
      loadSettings(),
      listCounterparties(),
    ]);

    const cp = counterparties.find((c) => c.id === invoice.counterpartyId);
    const company = settings.companyInfo;
    const bank = settings.bankAccount;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = await loadFont();
    const font = await pdfDoc.embedFont(fontBytes);

    drawInvoicePage1(pdfDoc, font, invoice, cp, company, bank);
    if (invoice.includeDetailSheet) {
      drawDetailSheet(pdfDoc, font, invoice, cp);
    }

    const pdfBytes = await pdfDoc.save();

    const invoicesFolderId = await ensureSubFolder(accessToken, folderId, "invoices");
    const cpName = cp?.name || "untitled";
    const fileName = invoice.invoiceNo + "_" + cpName.replace(/[\/:*?"<>|]/g, "") + ".pdf";
    const fileId = await uploadBinaryFile(
      accessToken,
      invoicesFolderId,
      fileName,
      pdfBytes,
      "application/pdf"
    );

    const updatedInvoices = invoices.map((inv) =>
      inv.id === invoiceId
        ? { ...inv, pdfDriveFileId: fileId, status: inv.status === "draft" ? ("sent" as const) : inv.status, updatedAt: new Date().toISOString() }
        : inv
    );
    const content = updatedInvoices.map((inv) => JSON.stringify(inv)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, INVOICES_FILE, content);

    revalidatePath("/invoices");
    return { ok: true, fileId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF生成失敗";
    console.error("generateInvoicePdf error:", e);
    return { ok: false, error: msg };
  }
}

// ============== 1ページ目 ==============
function drawInvoicePage1(
  pdfDoc: PDFDocument,
  font: PDFFont,
  invoice: Invoice,
  cp: Counterparty | undefined,
  company: CompanyInfo | undefined,
  bank: BankAccountInfo | undefined
) {
  const page = pdfDoc.addPage([595, 842]);
  const { width } = page.getSize();
  const margin = 50;

  let y = 770;

  const title = "請 求 書";
  const titleSize = 26;
  const titleWidth = font.widthOfTextAtSize(title, titleSize);
  drawText(page, title, (width - titleWidth) / 2, y, titleSize, font, BLACK);
  drawLine(page, (width - titleWidth) / 2 - 10, y - 6, (width - titleWidth) / 2 + titleWidth + 10, y - 6, 1.5, BLACK);

  y -= 50;

  const leftX = margin;
  const rightX = width - margin - 180;

  if (cp?.postalCode) {
    drawText(page, "\u3012" + cp.postalCode, leftX, y, 9, font, MID_GRAY);
    y -= 12;
  }
  if (cp?.address) {
    drawText(page, cp.address, leftX, y, 9, font, DARK_GRAY);
    y -= 12;
  }
  const cpName = (cp?.name || "(取引先不明)") + " 御中";
  drawText(page, cpName, leftX, y - 5, 14, font, BLACK);

  let rightY = 720;
  drawText(page, "請求書番号", rightX, rightY, 8, font, MID_GRAY);
  drawText(page, invoice.invoiceNo, rightX + 60, rightY, 9, font, BLACK);
  rightY -= 14;
  drawText(page, "発行日", rightX, rightY, 8, font, MID_GRAY);
  drawText(page, invoice.issueDate, rightX + 60, rightY, 9, font, BLACK);
  rightY -= 14;
  drawText(page, "支払期限", rightX, rightY, 8, font, MID_GRAY);
  drawText(page, invoice.dueDate, rightX + 60, rightY, 9, font, BLACK);

  y -= 50;
  drawText(page, "ご請求金額", margin, y, 9, font, MID_GRAY);
  y -= 28;
  drawText(page, "\u00A5" + invoice.transferAmount.toLocaleString(), margin, y, 28, font, BLACK);
  y -= 8;
  drawLine(page, margin, y, width - margin, y, 1, BLACK);

  y -= 35;

  const tableX = margin;
  const tableWidth = width - margin * 2;
  const colDesc = tableX + 8;
  const colQty = tableX + tableWidth - 250;
  const colPrice = tableX + tableWidth - 180;
  const colTax = tableX + tableWidth - 100;
  const colAmount = tableX + tableWidth - 8;

  drawLine(page, tableX, y + 4, tableX + tableWidth, y + 4, 1, DARK_GRAY);
  drawText(page, "摘要", colDesc, y - 10, 9, font, DARK_GRAY);
  drawText(page, "数量", colQty, y - 10, 9, font, DARK_GRAY);
  drawText(page, "単価", colPrice, y - 10, 9, font, DARK_GRAY);
  drawText(page, "税率", colTax, y - 10, 9, font, DARK_GRAY);
  drawTextRight(page, "金額", colAmount, y - 10, 9, font, DARK_GRAY);
  drawLine(page, tableX, y - 16, tableX + tableWidth, y - 16, 0.5, LIGHT_GRAY);

  y -= 16;

  for (const item of invoice.items) {
    y -= 22;
    // 明細書がある場合は details の合計を使用
    const useDetails = invoice.includeDetailSheet && item.details && item.details.length > 0;
    let itemAmount: number;
    let displayQty: number;
    let displayPrice: number;
    if (useDetails) {
      itemAmount = item.details!.reduce((sum, d) => sum + (d.quantity ?? 0) * (d.unitPrice ?? 0), 0);
      displayQty = item.details!.reduce((sum, d) => sum + (d.quantity ?? 0), 0);
      // 単価は details の平均(もしくは最初の単価)
      const firstUnit = item.details![0]?.unitPrice ?? 0;
      const allSame = item.details!.every((d) => (d.unitPrice ?? 0) === firstUnit);
      displayPrice = allSame ? firstUnit : 0; // 統一されてない場合は0(表示しない)
    } else {
      itemAmount = item.quantity * item.unitPrice;
      displayQty = item.quantity;
      displayPrice = item.unitPrice;
    }
    const unitLabel = item.unit === "piece" ? "個" : "時間";
    drawText(page, item.description.slice(0, 30), colDesc, y, 10, font, BLACK);
    drawText(page, displayQty + unitLabel, colQty, y, 10, font, BLACK);
    if (displayPrice > 0) {
      drawText(page, "\u00A5" + displayPrice.toLocaleString(), colPrice, y, 10, font, BLACK);
    } else {
      drawText(page, "-", colPrice, y, 10, font, MID_GRAY);
    }
    drawText(page, item.taxRate + "%", colTax, y, 10, font, BLACK);
    drawTextRight(page, "\u00A5" + itemAmount.toLocaleString(), colAmount, y, 10, font, BLACK);
    drawLine(page, tableX, y - 6, tableX + tableWidth, y - 6, 0.3, LIGHT_GRAY);
  }

  y -= 30;

  const sumLabelX = width - margin - 200;
  const sumValueX = width - margin;

  drawText(page, "小計", sumLabelX, y, 9, font, MID_GRAY);
  drawTextRight(page, "\u00A5" + invoice.subtotal.toLocaleString(), sumValueX, y, 10, font, BLACK);
  y -= 16;
  drawText(page, "消費税", sumLabelX, y, 9, font, MID_GRAY);
  drawTextRight(page, "\u00A5" + invoice.taxAmount.toLocaleString(), sumValueX, y, 10, font, BLACK);
  y -= 8;
  drawLine(page, sumLabelX, y, sumValueX, y, 0.5, LIGHT_GRAY);
  y -= 12;
  drawText(page, "税込合計", sumLabelX, y, 10, font, DARK_GRAY);
  drawTextRight(page, "\u00A5" + invoice.total.toLocaleString(), sumValueX, y, 11, font, BLACK);
  y -= 16;

  if (invoice.withholdingAmount > 0) {
    drawText(page, "源泉徴収", sumLabelX, y, 9, font, MID_GRAY);
    drawTextRight(page, "-\u00A5" + invoice.withholdingAmount.toLocaleString(), sumValueX, y, 10, font, BLACK);
    y -= 12;
  }
  drawLine(page, sumLabelX, y, sumValueX, y, 1, BLACK);
  y -= 16;
  drawText(page, "振込金額", sumLabelX, y, 11, font, BLACK);
  drawTextRight(page, "\u00A5" + invoice.transferAmount.toLocaleString(), sumValueX, y, 14, font, BLACK);
  y -= 30;

  if (invoice.note) {
    drawText(page, "備考", margin, y, 9, font, MID_GRAY);
    y -= 12;
    drawText(page, invoice.note.slice(0, 80), margin, y, 9, font, DARK_GRAY);
    y -= 30;
  }

  if (bank) {
    drawText(page, "お振込先", margin, y, 9, font, MID_GRAY);
    y -= 14;
    drawLine(page, margin, y + 4, width - margin, y + 4, 0.5, LIGHT_GRAY);
    const accType = bank.accountType === "ordinary" ? "普通" : "当座";
    const bankLine = bank.bankName + "  " + bank.branchName + "  " + accType + "  " + bank.accountNumber + "  " + bank.accountHolder;
    drawText(page, bankLine, margin, y - 10, 10, font, BLACK);
    y -= 30;
  }

  if (company) {
    const footerY = 80;
    drawLine(page, margin, footerY + 50, width - margin, footerY + 50, 0.5, LIGHT_GRAY);
    drawText(page, company.businessName || company.name, margin, footerY + 35, 11, font, BLACK);
    if (company.businessName && company.name) {
      drawText(page, company.name, margin, footerY + 22, 9, font, DARK_GRAY);
    }
    if (company.postalCode) {
      drawText(page, "\u3012" + company.postalCode, margin, footerY + 10, 8, font, MID_GRAY);
    }
    if (company.address) {
      drawText(page, company.address, margin + 60, footerY + 10, 8, font, DARK_GRAY);
    }
    if (company.phone) {
      drawText(page, "TEL: " + company.phone, margin, footerY - 2, 8, font, MID_GRAY);
    }
    if (company.email) {
      drawText(page, company.email, margin + 100, footerY - 2, 8, font, MID_GRAY);
    }
  }
}

// ============== 2ページ目: 明細書 ==============
function drawDetailSheet(
  pdfDoc: PDFDocument,
  font: PDFFont,
  invoice: Invoice,
  cp: Counterparty | undefined
) {
  const page = pdfDoc.addPage([595, 842]);
  const { width } = page.getSize();
  const margin = 50;
  let y = 770;

  const title = "明 細 書";
  const titleSize = 18;
  const titleWidth = font.widthOfTextAtSize(title, titleSize);
  drawText(page, title, (width - titleWidth) / 2, y, titleSize, font, BLACK);
  y -= 28;

  drawText(page, "請求書番号: " + invoice.invoiceNo, margin, y, 9, font, MID_GRAY);
  drawText(page, "発行日: " + invoice.issueDate, margin + 200, y, 9, font, MID_GRAY);
  if (cp?.name) {
    drawTextRight(page, cp.name + " 御中", width - margin, y, 9, font, DARK_GRAY);
  }
  y -= 30;

  const tableX = margin;
  const tableWidth = width - margin * 2;
  const colDate = tableX + 8;
  const colStart = tableX + 65;
  const colEnd = tableX + 105;
  const colLocation = tableX + 145;
  const colDesc = tableX + 240;
  const colPrice = tableX + tableWidth - 170;
  const colQty = tableX + tableWidth - 110;
  const colAmount = tableX + tableWidth - 8;

  drawLine(page, tableX, y + 4, tableX + tableWidth, y + 4, 1, DARK_GRAY);
  drawText(page, "日付", colDate, y - 10, 8, font, DARK_GRAY);
  drawText(page, "開始", colStart, y - 10, 8, font, DARK_GRAY);
  drawText(page, "終了", colEnd, y - 10, 8, font, DARK_GRAY);
  drawText(page, "場所", colLocation, y - 10, 8, font, DARK_GRAY);
  drawText(page, "摘要", colDesc, y - 10, 8, font, DARK_GRAY);
  drawText(page, "単価", colPrice, y - 10, 8, font, DARK_GRAY);
  drawText(page, "数量", colQty, y - 10, 8, font, DARK_GRAY);
  drawTextRight(page, "金額", colAmount, y - 10, 8, font, DARK_GRAY);
  drawLine(page, tableX, y - 16, tableX + tableWidth, y - 16, 0.5, LIGHT_GRAY);

  y -= 16;

  for (const item of invoice.items) {
    const unitLabel = item.unit === "piece" ? "個" : "時間";
    const details = item.details || [];

    if (details.length === 0) {
      // 明細書ONなのに details が空のケース: itemの値を使う
      y -= 20;
      const itemAmount = item.quantity * item.unitPrice;
      drawText(page, invoice.issueDate.slice(5), colDate, y, 9, font, BLACK);
      drawText(page, item.description.slice(0, 14), colDesc, y, 9, font, BLACK);
      drawText(page, "\u00A5" + item.unitPrice.toLocaleString(), colPrice, y, 9, font, BLACK);
      drawText(page, item.quantity + unitLabel, colQty, y, 9, font, BLACK);
      drawTextRight(page, "\u00A5" + itemAmount.toLocaleString(), colAmount, y, 9, font, BLACK);
      drawLine(page, tableX, y - 6, tableX + tableWidth, y - 6, 0.3, LIGHT_GRAY);
    } else {
      // 各 detail を独立した行として描画
      for (let dIdx = 0; dIdx < details.length; dIdx++) {
        const d = details[dIdx];
        const dUnitPrice = d.unitPrice ?? 0;
        const dQuantity = d.quantity ?? 0;
        const rowAmount = dUnitPrice * dQuantity;
        y -= 20;
        if (d.date) drawText(page, d.date, colDate, y, 9, font, BLACK);
        if (d.startTime) drawText(page, d.startTime, colStart, y, 9, font, BLACK);
        if (d.endTime) drawText(page, d.endTime, colEnd, y, 9, font, BLACK);
        if (d.location) drawText(page, d.location.slice(0, 12), colLocation, y, 9, font, BLACK);
        // 摘要は全行表示
        drawText(page, item.description.slice(0, 14), colDesc, y, 9, font, BLACK);
        // 各行に単価・数量・金額
        drawText(page, "\u00A5" + dUnitPrice.toLocaleString(), colPrice, y, 9, font, BLACK);
        drawText(page, dQuantity + unitLabel, colQty, y, 9, font, BLACK);
        drawTextRight(page, "\u00A5" + rowAmount.toLocaleString(), colAmount, y, 9, font, BLACK);
        if (d.note) {
          y -= 11;
          drawText(page, "  " + d.note, colDate, y, 8, font, MID_GRAY);
        }
        drawLine(page, tableX, y - 6, tableX + tableWidth, y - 6, 0.3, LIGHT_GRAY);
      }
    }
  }

  y -= 30;
  const totalLabelX = width - margin - 180;
  drawLine(page, totalLabelX, y + 12, width - margin, y + 12, 1, BLACK);
  drawText(page, "合計", totalLabelX, y, 11, font, BLACK);
  drawTextRight(page, "\u00A5" + invoice.subtotal.toLocaleString(), width - margin, y, 12, font, BLACK);
}

export async function getInvoicePdf(fileId: string): Promise<{ ok: boolean; error?: string; dataUrl?: string }> {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return { ok: false, error: "認証が必要です" };
    }
    const accessToken = session.accessToken;

    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media",
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    if (!res.ok) {
      return { ok: false, error: "PDF取得失敗" };
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { ok: true, dataUrl: "data:application/pdf;base64," + base64 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF取得失敗";
    return { ok: false, error: msg };
  }
}
