import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface TicketPDFProps {
  orderNumber: string;
  ticketCode: string;
  customerName: string;
  ticketName: string;
  optionName?: string;
  qrDataUrl: string;
  eventDate?: string;
}

// Page dimensions (in points, 72 points = 1 inch)
const PAGE_WIDTH = 320;
const PAGE_HEIGHT = 560;

// Content section dimensions
const CONTENT_HEIGHT = 320;
const CONTENT_Y = PAGE_HEIGHT - CONTENT_HEIGHT;

export function createTicketPDF(data: TicketPDFProps): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const {
        orderNumber,
        ticketCode,
        customerName,
        ticketName,
        optionName,
        qrDataUrl,
        eventDate = '7-9 August 2026',
      } = data;

      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: 0,
        autoFirstPage: true,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Background image
      const bgPath = path.resolve(process.cwd(), 'src/assets/ticket-bg.jpg');
      if (fs.existsSync(bgPath)) {
        doc.image(bgPath, 0, 0, { width: PAGE_WIDTH, height: PAGE_HEIGHT });
      } else {
        // Fallback gradient background
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#1a1a2e');
      }

      // White content section at bottom with rounded top corners
      // Draw white rectangle
      doc.save();
      doc.rect(0, CONTENT_Y + 20, PAGE_WIDTH, CONTENT_HEIGHT - 20).fill('#ffffff');
      // Draw rounded top part
      doc.roundedRect(0, CONTENT_Y, PAGE_WIDTH, 40, 20).fill('#ffffff');
      doc.restore();

      // Festival name - explicitly position without line height issues
      doc.fill('#1a1a1a');
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      const festivalText = 'FESTIVALUL LUPILOR';
      const festivalWidth = doc.widthOfString(festivalText);
      doc.text(festivalText, (PAGE_WIDTH - festivalWidth) / 2, CONTENT_Y + 24, {
        lineBreak: false,
      });

      // Event date
      doc.fill('#666666');
      doc.font('Helvetica');
      doc.fontSize(10);
      const dateWidth = doc.widthOfString(eventDate);
      doc.text(eventDate, (PAGE_WIDTH - dateWidth) / 2, CONTENT_Y + 44, {
        lineBreak: false,
      });

      // QR Code
      const qrSize = 120;
      const qrX = (PAGE_WIDTH - qrSize) / 2;
      const qrY = CONTENT_Y + 64;

      // QR Code from data URL
      if (qrDataUrl && qrDataUrl.startsWith('data:image')) {
        doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // Ticket code
      doc.fill('#888888');
      doc.font('Courier');
      doc.fontSize(10);
      const codeWidth = doc.widthOfString(ticketCode);
      doc.text(ticketCode, (PAGE_WIDTH - codeWidth) / 2, qrY + qrSize + 12, {
        lineBreak: false,
      });

      // Divider
      const dividerY = qrY + qrSize + 32;
      doc.moveTo(PAGE_WIDTH * 0.1, dividerY)
         .lineTo(PAGE_WIDTH * 0.9, dividerY)
         .strokeColor('#e5e5e5')
         .lineWidth(1)
         .stroke();

      // Ticket name
      doc.fill('#1a1a1a');
      doc.font('Helvetica-Bold');
      doc.fontSize(16);
      const ticketNameWidth = doc.widthOfString(ticketName);
      doc.text(ticketName, (PAGE_WIDTH - ticketNameWidth) / 2, dividerY + 12, {
        lineBreak: false,
      });

      let nextY = dividerY + 32;

      // Option name (if exists)
      if (optionName) {
        doc.fill('#666666');
        doc.font('Helvetica');
        doc.fontSize(11);
        const optionWidth = doc.widthOfString(optionName);
        doc.text(optionName, (PAGE_WIDTH - optionWidth) / 2, nextY, {
          lineBreak: false,
        });
        nextY += 16;
      }

      // Customer name
      doc.fill('#888888');
      doc.font('Helvetica');
      doc.fontSize(10);
      const customerWidth = doc.widthOfString(customerName);
      doc.text(customerName, (PAGE_WIDTH - customerWidth) / 2, nextY, {
        lineBreak: false,
      });

      // Order info
      const orderY = nextY + 20;
      doc.fill('#999999');
      doc.font('Helvetica');
      doc.fontSize(8);
      const labelText = 'COMANDA';
      const labelWidth = doc.widthOfString(labelText);
      doc.text(labelText, (PAGE_WIDTH - labelWidth) / 2, orderY, {
        lineBreak: false,
      });

      doc.fill('#333333');
      doc.font('Helvetica-Bold');
      doc.fontSize(10);
      const orderText = `#${orderNumber}`;
      const orderWidth = doc.widthOfString(orderText);
      doc.text(orderText, (PAGE_WIDTH - orderWidth) / 2, orderY + 10, {
        lineBreak: false,
      });

      // Finalize - only keep first page
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Create invitation ticket PDF with INVITATION label
export function createInvitationPDF(data: TicketPDFProps): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const {
        orderNumber,
        ticketCode,
        customerName,
        ticketName,
        optionName,
        qrDataUrl,
        eventDate = '7-9 August 2026',
      } = data;

      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: 0,
        autoFirstPage: true,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Background image
      const bgPath = path.resolve(process.cwd(), 'src/assets/ticket-bg.jpg');
      if (fs.existsSync(bgPath)) {
        doc.image(bgPath, 0, 0, { width: PAGE_WIDTH, height: PAGE_HEIGHT });
      } else {
        // Fallback gradient background
        doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#1a1a2e');
      }

      // White content section at bottom with rounded top corners
      doc.save();
      doc.rect(0, CONTENT_Y + 20, PAGE_WIDTH, CONTENT_HEIGHT - 20).fill('#ffffff');
      doc.roundedRect(0, CONTENT_Y, PAGE_WIDTH, 40, 20).fill('#ffffff');
      doc.restore();

      // INVITATION badge at the top of white section
      const badgeWidth = 100;
      const badgeHeight = 20;
      const badgeX = (PAGE_WIDTH - badgeWidth) / 2;
      const badgeY = CONTENT_Y + 8;

      // Gold/yellow badge background
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 10).fill('#D4AF37');

      // INVITATION text
      doc.fill('#ffffff');
      doc.font('Helvetica-Bold');
      doc.fontSize(10);
      const invText = 'INVITATION';
      const invWidth = doc.widthOfString(invText);
      doc.text(invText, (PAGE_WIDTH - invWidth) / 2, badgeY + 5, {
        lineBreak: false,
      });

      // Festival name - positioned below badge
      doc.fill('#1a1a1a');
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      const festivalText = 'FESTIVALUL LUPILOR';
      const festivalWidth = doc.widthOfString(festivalText);
      doc.text(festivalText, (PAGE_WIDTH - festivalWidth) / 2, CONTENT_Y + 36, {
        lineBreak: false,
      });

      // Event date
      doc.fill('#666666');
      doc.font('Helvetica');
      doc.fontSize(10);
      const dateWidth = doc.widthOfString(eventDate);
      doc.text(eventDate, (PAGE_WIDTH - dateWidth) / 2, CONTENT_Y + 54, {
        lineBreak: false,
      });

      // QR Code
      const qrSize = 110;
      const qrX = (PAGE_WIDTH - qrSize) / 2;
      const qrY = CONTENT_Y + 72;

      // QR Code from data URL
      if (qrDataUrl && qrDataUrl.startsWith('data:image')) {
        doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // Ticket code
      doc.fill('#888888');
      doc.font('Courier');
      doc.fontSize(10);
      const codeWidth = doc.widthOfString(ticketCode);
      doc.text(ticketCode, (PAGE_WIDTH - codeWidth) / 2, qrY + qrSize + 8, {
        lineBreak: false,
      });

      // Divider
      const dividerY = qrY + qrSize + 26;
      doc.moveTo(PAGE_WIDTH * 0.1, dividerY)
         .lineTo(PAGE_WIDTH * 0.9, dividerY)
         .strokeColor('#e5e5e5')
         .lineWidth(1)
         .stroke();

      // Ticket name
      doc.fill('#1a1a1a');
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      const ticketNameWidth = doc.widthOfString(ticketName);
      doc.text(ticketName, (PAGE_WIDTH - ticketNameWidth) / 2, dividerY + 10, {
        lineBreak: false,
      });

      let nextY = dividerY + 28;

      // Option name (if exists)
      if (optionName) {
        doc.fill('#666666');
        doc.font('Helvetica');
        doc.fontSize(10);
        const optionWidth = doc.widthOfString(optionName);
        doc.text(optionName, (PAGE_WIDTH - optionWidth) / 2, nextY, {
          lineBreak: false,
        });
        nextY += 14;
      }

      // Customer name
      doc.fill('#888888');
      doc.font('Helvetica');
      doc.fontSize(10);
      const customerWidth = doc.widthOfString(customerName);
      doc.text(customerName, (PAGE_WIDTH - customerWidth) / 2, nextY, {
        lineBreak: false,
      });

      // Order info
      const orderY = nextY + 16;
      doc.fill('#999999');
      doc.font('Helvetica');
      doc.fontSize(8);
      const labelText = 'INVITATION';
      const labelWidth = doc.widthOfString(labelText);
      doc.text(labelText, (PAGE_WIDTH - labelWidth) / 2, orderY, {
        lineBreak: false,
      });

      doc.fill('#333333');
      doc.font('Helvetica-Bold');
      doc.fontSize(10);
      const orderText = `#${orderNumber}`;
      const orderWidth = doc.widthOfString(orderText);
      doc.text(orderText, (PAGE_WIDTH - orderWidth) / 2, orderY + 10, {
        lineBreak: false,
      });

      // Finalize
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
