import PDFDocument from 'pdfkit';

import { cloudinary } from '../../config/cloudinary';
import { CLOUDINARY_FOLDERS } from '../../services/storage.service';
import { pool } from '../../services/database.service';
import { BillingInformation, InvoiceDetail } from './billing.types';

/**
 * Invoice PDF generation.
 *
 * Works with or without Cloudinary. Without credentials the PDF is generated
 * on each request and streamed straight back, which is enough for development
 * and for low volumes. With credentials the first render is uploaded and the
 * URL is stored on the invoice, so later downloads come from the CDN and the
 * pdf_url / pdf_public_id / pdf_metadata columns get used as the schema
 * intends.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

const COLORS = {
  text: '#111827',
  muted: '#6b7280',
  rule: '#e5e7eb',
  accent: '#6d28d9',
  danger: '#b91c1c',
  success: '#15803d',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Due',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
};

function money(amount: number, currency: string): string {
  const formatted = amount.toFixed(2);
  const symbols: Record<string, string> = { USD: '$', EUR: '\u20ac', GBP: '\u00a3' };
  const symbol = symbols[currency];
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}

function shortDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Collects the pdfkit stream into a single buffer. */
function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export async function renderInvoicePdf(
  invoice: InvoiceDetail,
  billing: BillingInformation,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  const pageRight = doc.page.width - 56;
  const contentWidth = pageRight - 56;

  // ---- Header -------------------------------------------------------------
  doc.fillColor(COLORS.accent).fontSize(20).font('Helvetica-Bold').text('Klyra', 56, 56);
  doc
    .fillColor(COLORS.muted)
    .fontSize(9)
    .font('Helvetica')
    .text('API marketplace', 56, doc.y + 2);

  doc
    .fillColor(COLORS.text)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Invoice', 56, 56, { width: contentWidth, align: 'right' });
  doc
    .fillColor(COLORS.muted)
    .fontSize(10)
    .font('Helvetica')
    .text(invoice.invoiceNumber, 56, doc.y + 2, { width: contentWidth, align: 'right' });

  const statusColor =
    invoice.status === 'PAID'
      ? COLORS.success
      : invoice.status === 'OVERDUE'
        ? COLORS.danger
        : COLORS.muted;

  doc
    .fillColor(statusColor)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(STATUS_LABELS[invoice.status] ?? invoice.status, 56, doc.y + 2, {
      width: contentWidth,
      align: 'right',
    });

  let y = 140;
  doc.moveTo(56, y).lineTo(pageRight, y).strokeColor(COLORS.rule).lineWidth(1).stroke();
  y += 22;

  // ---- Billed to / dates --------------------------------------------------
  const columnWidth = contentWidth / 2 - 12;

  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold').text('BILLED TO', 56, y);

  const billedLines = [
    billing.companyName,
    billing.billingName,
    billing.addressLine1,
    billing.addressLine2,
    [billing.city, billing.state, billing.postalCode].filter(Boolean).join(', ') || null,
    billing.country,
    billing.taxId ? `Tax ID: ${billing.taxId}` : null,
    billing.invoiceEmail,
  ].filter((line): line is string => Boolean(line));

  doc.fillColor(COLORS.text).fontSize(10).font('Helvetica');
  let billedY = y + 14;
  if (billedLines.length === 0) {
    doc.fillColor(COLORS.muted).text('No billing details on file', 56, billedY, {
      width: columnWidth,
    });
    billedY = doc.y;
  } else {
    for (const line of billedLines) {
      doc.text(line, 56, billedY, { width: columnWidth });
      billedY = doc.y + 1;
    }
  }

  const datesX = 56 + columnWidth + 24;
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('DETAILS', datesX, y, { width: columnWidth });

  const detailRows: [string, string][] = [
    ['Issued', shortDate(invoice.createdAt)],
    ['Due', shortDate(invoice.dueDate)],
    ['Paid', shortDate(invoice.paidAt)],
    ['Currency', invoice.currency],
  ];

  let detailY = y + 14;
  for (const [label, value] of detailRows) {
    doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica').text(label, datesX, detailY, {
      width: columnWidth / 2,
    });
    doc
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .text(value, datesX + columnWidth / 2, detailY, {
        width: columnWidth / 2,
        align: 'right',
      });
    detailY += 16;
  }

  y = Math.max(billedY, detailY) + 24;

  // ---- Line item ----------------------------------------------------------
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold');
  doc.text('DESCRIPTION', 56, y);
  doc.text('AMOUNT', 56, y, { width: contentWidth, align: 'right' });

  y += 14;
  doc.moveTo(56, y).lineTo(pageRight, y).strokeColor(COLORS.rule).stroke();
  y += 12;

  const description = invoice.subscription
    ? `${invoice.subscription.api.name} — ${invoice.subscription.plan.name}`
    : 'One-off charge';

  doc.fillColor(COLORS.text).fontSize(11).font('Helvetica').text(description, 56, y, {
    width: contentWidth - 100,
  });
  doc
    .font('Helvetica-Bold')
    .text(money(invoice.amount, invoice.currency), 56, y, {
      width: contentWidth,
      align: 'right',
    });

  if (invoice.subscription?.periodStart || invoice.subscription?.periodEnd) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font('Helvetica')
      .text(
        `Billing period ${shortDate(invoice.subscription.periodStart)} – ${shortDate(
          invoice.subscription.periodEnd,
        )}`,
        56,
        doc.y + 2,
        { width: contentWidth - 100 },
      );
  }

  y = doc.y + 18;
  doc.moveTo(56, y).lineTo(pageRight, y).strokeColor(COLORS.rule).stroke();
  y += 14;

  // ---- Totals -------------------------------------------------------------
  const totalRows: [string, string, boolean][] = [
    ['Total', money(invoice.amount, invoice.currency), false],
    ['Paid', money(invoice.amountPaid, invoice.currency), false],
    ['Amount due', money(invoice.amountDue, invoice.currency), true],
  ];

  for (const [label, value, emphasise] of totalRows) {
    doc
      .fillColor(emphasise ? COLORS.text : COLORS.muted)
      .fontSize(emphasise ? 12 : 10)
      .font(emphasise ? 'Helvetica-Bold' : 'Helvetica')
      .text(label, 56 + contentWidth - 220, y, { width: 120, align: 'right' });
    doc
      .fillColor(emphasise ? COLORS.text : COLORS.text)
      .font('Helvetica-Bold')
      .text(value, 56 + contentWidth - 100, y, { width: 100, align: 'right' });
    y += emphasise ? 20 : 16;
  }

  // ---- Payments -----------------------------------------------------------
  if (invoice.payments.length > 0) {
    y += 14;
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold').text('PAYMENTS', 56, y);
    y += 14;

    for (const payment of invoice.payments) {
      const method = payment.paymentMethod ?? 'card';
      doc
        .fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text(`${shortDate(payment.createdAt)} · ${method} · ${payment.status.toLowerCase()}`, 56, y, {
          width: contentWidth - 100,
        });
      doc
        .font('Helvetica-Bold')
        .text(money(payment.amount, payment.currency), 56, y, {
          width: contentWidth,
          align: 'right',
        });
      y = doc.y + 4;
    }
  }

  // ---- Footer -------------------------------------------------------------
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font('Helvetica')
    .text(
      `Generated ${shortDate(new Date().toISOString())} · Questions? Reply to your billing email.`,
      56,
      doc.page.height - 70,
      { width: contentWidth, align: 'center' },
    );

  return toBuffer(doc);
}

export interface StoredInvoicePdf {
  url: string;
  publicId: string;
  metadata: Record<string, unknown>;
}

/**
 * Uploads a generated PDF and records it on the invoice row.
 *
 * `resource_type: 'raw'` matters — Cloudinary would otherwise try to treat the
 * PDF as an image and rasterise it.
 */
export async function storeInvoicePdf(
  invoiceId: string,
  invoiceNumber: string,
  buffer: Buffer,
): Promise<StoredInvoicePdf> {
  const result = await new Promise<Record<string, any>>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDERS.INVOICES,
        public_id: `${invoiceNumber}.pdf`,
        resource_type: 'raw',
        overwrite: true,
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error('Cloudinary returned no result'));
          return;
        }
        resolve(uploadResult as unknown as Record<string, any>);
      },
    );

    stream.end(buffer);
  });

  const metadata = {
    version: result.version,
    format: result.format,
    bytes: result.bytes,
    secure_url: result.secure_url,
  };

  await pool.query(
    `UPDATE invoices
     SET pdf_url = $2,
         pdf_public_id = $3,
         pdf_metadata = $4::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [invoiceId, result.secure_url, result.public_id, JSON.stringify(metadata)],
  );

  return { url: result.secure_url, publicId: result.public_id, metadata };
}
