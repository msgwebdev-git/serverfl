import PDFDocument from 'pdfkit';
import { join } from 'path';
import { supabase } from './supabase.js';
import { b2bOrderService } from './b2b-order.js';
import { emailService } from './email.js';
import { AppError } from '../middleware/errorHandler.js';

const FONTS_DIR = join(__dirname, '../../fonts');

export interface InvoiceData {
  orderId: string;
  orderNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  company: {
    name: string;
    taxId?: string;
    address?: string;
  };
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    name: string;
    option?: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  language: 'ro' | 'ru';
}

// A4 page dimensions (in points, 72 points = 1 inch)
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;

const translations = {
  ro: {
    invoice: 'FACTURĂ PROFORMĂ',
    invoiceNumber: 'Nr. Factură',
    invoiceDate: 'Data',
    orderNumber: 'Nr. Comandă',
    billTo: 'Către',
    company: 'Companie',
    taxId: 'IDNO',
    address: 'Adresă',
    contact: 'Persoană de contact',
    email: 'Email',
    phone: 'Telefon',
    itemDescription: 'Descriere',
    quantity: 'Cantitate',
    unitPrice: 'Preț unitar',
    discount: 'Reducere',
    total: 'Total',
    subtotal: 'Subtotal',
    totalDiscount: 'Reducere totală',
    finalTotal: 'TOTAL DE PLATĂ',
    currency: 'MDL',
    paymentInstructions: 'Instrucțiuni de plată',
    bankDetails: 'Detalii bancare',
    accountNumber: 'Cont',
    bankName: 'Banca',
    beneficiary: 'Beneficiar',
    paymentNote: 'Vă rugăm să indicați numărul facturii în descrierea plății.',
    footer: 'Mulțumim pentru colaborare!',
    festivalInfo: 'Festivalul Lupilor 2026 | 7-9 August | Valea Morilor, Chișinău',
  },
  ru: {
    invoice: 'СЧЕТ НА ОПЛАТУ',
    invoiceNumber: '№ Счета',
    invoiceDate: 'Дата',
    orderNumber: '№ Заказа',
    billTo: 'Получатель',
    company: 'Компания',
    taxId: 'IDNO',
    address: 'Адрес',
    contact: 'Контактное лицо',
    email: 'Email',
    phone: 'Телефон',
    itemDescription: 'Описание',
    quantity: 'Количество',
    unitPrice: 'Цена за ед.',
    discount: 'Скидка',
    total: 'Сумма',
    subtotal: 'Промежуточный итог',
    totalDiscount: 'Общая скидка',
    finalTotal: 'ИТОГО К ОПЛАТЕ',
    currency: 'MDL',
    paymentInstructions: 'Инструкции по оплате',
    bankDetails: 'Банковские реквизиты',
    accountNumber: 'Счет',
    bankName: 'Банк',
    beneficiary: 'Получатель',
    paymentNote: 'Пожалуйста, укажите номер счета в описании платежа.',
    footer: 'Спасибо за сотрудничество!',
    festivalInfo: 'Festivalul Lupilor 2026 | 7-9 Августа | Valea Morilor, Кишинев',
  },
};

export const invoiceService = {
  /**
   * Generate invoice PDF for B2B order
   */
  async generateInvoice(orderId: string): Promise<Buffer> {
    // Get order data
    const order = await b2bOrderService.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Get order items with ticket details
    const items = await b2bOrderService.getOrderItems(orderId);

    // Prepare invoice data
    const invoiceData: InvoiceData = {
      orderId: order.id,
      orderNumber: order.order_number,
      invoiceNumber: order.invoice_number || 'N/A',
      invoiceDate: new Date(order.created_at).toLocaleDateString('ro-RO'),
      company: {
        name: order.company_name,
        taxId: order.company_tax_id || undefined,
        address: order.company_address || undefined,
      },
      contact: {
        name: order.contact_name,
        email: order.contact_email,
        phone: order.contact_phone,
      },
      items: items.map((item: any) => ({
        name: order.language === 'ro' ? item.ticket.name_ro : item.ticket.name_ru,
        option:
          item.ticket_option && order.language === 'ro'
            ? item.ticket_option.name_ro
            : item.ticket_option?.name_ru,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        discountPercent: item.discount_percent,
        totalPrice: item.total_price,
      })),
      totalAmount: order.total_amount,
      discountAmount: order.discount_amount,
      finalAmount: order.final_amount,
      language: order.language,
    };

    // Generate PDF
    const pdfBuffer = await this.createInvoicePDF(invoiceData);

    // Upload to Supabase Storage
    const fileName = `invoices/${invoiceData.invoiceNumber}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('tickets')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new AppError(`Failed to upload invoice: ${uploadError.message}`, 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('tickets').getPublicUrl(fileName);

    // Update order with invoice URL
    await b2bOrderService.updateInvoiceUrl(orderId, urlData.publicUrl);

    // Send invoice by email
    await emailService.sendB2BInvoice(
      order.order_number,
      order.company_name,
      order.contact_name,
      order.contact_email,
      invoiceData.invoiceNumber,
      urlData.publicUrl,
      order.final_amount,
      order.language
    );

    return pdfBuffer;
  },

  /**
   * Create invoice PDF document
   */
  async createInvoicePDF(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const t = translations[data.language];
        const chunks: Buffer[] = [];

        const doc = new PDFDocument({
          size: 'A4',
          margin: MARGIN,
        });

        // Register custom fonts with Cyrillic support
        doc.registerFont('Roboto', join(FONTS_DIR, 'Roboto-Regular.ttf'));
        doc.registerFont('Roboto-Bold', join(FONTS_DIR, 'Roboto-Bold.ttf'));

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        let yPos = MARGIN;

        // Header - Invoice Title
        doc.font('Roboto-Bold').fontSize(24).fillColor('#1a1a2e').text(t.invoice, MARGIN, yPos, {
          align: 'center',
        });

        yPos += 40;

        // Festival Info
        doc
          .font('Roboto')
          .fontSize(10)
          .fillColor('#666666')
          .text(t.festivalInfo, MARGIN, yPos, {
            align: 'center',
          });

        yPos += 40;

        // Invoice Details (2 columns)
        const col1X = MARGIN;
        const col2X = PAGE_WIDTH - MARGIN - 200;

        doc.font('Roboto-Bold').fontSize(11).fillColor('#1a1a2e');
        doc.text(`${t.invoiceNumber}:`, col1X, yPos);
        doc.font('Roboto').text(data.invoiceNumber, col1X + 80, yPos);

        doc.font('Roboto-Bold').text(`${t.invoiceDate}:`, col2X, yPos);
        doc.font('Roboto').text(data.invoiceDate, col2X + 80, yPos);

        yPos += 20;

        doc.font('Roboto-Bold').text(`${t.orderNumber}:`, col1X, yPos);
        doc.font('Roboto').text(data.orderNumber, col1X + 80, yPos);

        yPos += 40;

        // Bill To Section
        doc.font('Roboto-Bold').fontSize(14).fillColor('#1a1a2e').text(t.billTo, col1X, yPos);

        yPos += 25;

        doc.font('Roboto-Bold').fontSize(10).text(`${t.company}:`, col1X, yPos);
        doc
          .font('Roboto')
          .fontSize(10)
          .text(data.company.name, col1X + 80, yPos, { width: 300 });

        yPos += 18;

        if (data.company.taxId) {
          doc.font('Roboto-Bold').text(`${t.taxId}:`, col1X, yPos);
          doc.font('Roboto').text(data.company.taxId, col1X + 80, yPos);
          yPos += 18;
        }

        if (data.company.address) {
          doc.font('Roboto-Bold').text(`${t.address}:`, col1X, yPos);
          doc.font('Roboto').text(data.company.address, col1X + 80, yPos, { width: 300 });
          yPos += 18;
        }

        doc.font('Roboto-Bold').text(`${t.contact}:`, col1X, yPos);
        doc.font('Roboto').text(data.contact.name, col1X + 80, yPos);
        yPos += 18;

        doc.font('Roboto-Bold').text(`${t.email}:`, col1X, yPos);
        doc.font('Roboto').text(data.contact.email, col1X + 80, yPos);
        yPos += 18;

        doc.font('Roboto-Bold').text(`${t.phone}:`, col1X, yPos);
        doc.font('Roboto').text(data.contact.phone, col1X + 80, yPos);

        yPos += 40;

        // Table Header
        const tableTop = yPos;
        const descCol = MARGIN;
        const qtyCol = MARGIN + 220;
        const priceCol = MARGIN + 300;
        const discCol = MARGIN + 380;
        const totalCol = MARGIN + 450;

        doc
          .font('Roboto-Bold')
          .fontSize(9)
          .fillColor('#ffffff')
          .rect(MARGIN, tableTop, PAGE_WIDTH - 2 * MARGIN, 25)
          .fill('#1a1a2e');

        doc.text(t.itemDescription, descCol + 5, tableTop + 8, { width: 200 });
        doc.text(t.quantity, qtyCol + 5, tableTop + 8, { width: 60 });
        doc.text(t.unitPrice, priceCol + 5, tableTop + 8, { width: 70 });
        doc.text(t.discount, discCol + 5, tableTop + 8, { width: 60 });
        doc.text(t.total, totalCol + 5, tableTop + 8, { width: 80 });

        yPos = tableTop + 30;

        // Table Rows
        doc.font('Roboto').fontSize(9).fillColor('#333333');

        data.items.forEach((item, index) => {
          const itemName = item.option ? `${item.name} - ${item.option}` : item.name;
          const rowBg = index % 2 === 0 ? '#f9f9f9' : '#ffffff';

          doc.rect(MARGIN, yPos, PAGE_WIDTH - 2 * MARGIN, 20).fill(rowBg);

          doc.fillColor('#333333').text(itemName, descCol + 5, yPos + 5, { width: 200 });
          doc.text(item.quantity.toString(), qtyCol + 5, yPos + 5, { width: 60 });
          doc.text(`${item.unitPrice.toFixed(2)} ${t.currency}`, priceCol + 5, yPos + 5, {
            width: 70,
          });
          doc.text(`${item.discountPercent}%`, discCol + 5, yPos + 5, { width: 60 });
          doc.text(`${item.totalPrice.toFixed(2)} ${t.currency}`, totalCol + 5, yPos + 5, {
            width: 80,
          });

          yPos += 20;
        });

        yPos += 10;

        // Totals
        const totalsX = totalCol - 120;

        doc
          .font('Roboto')
          .fontSize(10)
          .fillColor('#666666')
          .text(`${t.subtotal}:`, totalsX, yPos);
        doc.text(`${data.totalAmount.toFixed(2)} ${t.currency}`, totalsX + 120, yPos, {
          align: 'right',
        });

        yPos += 20;

        doc.text(`${t.totalDiscount} (${data.items[0]?.discountPercent || 0}%):`, totalsX, yPos);
        doc
          .fillColor('#dc2626')
          .text(`-${data.discountAmount.toFixed(2)} ${t.currency}`, totalsX + 120, yPos, {
            align: 'right',
          });

        yPos += 30;

        doc
          .font('Roboto-Bold')
          .fontSize(14)
          .fillColor('#1a1a2e')
          .text(`${t.finalTotal}:`, totalsX, yPos);
        doc
          .fontSize(16)
          .fillColor('#16a34a')
          .text(`${data.finalAmount.toFixed(2)} ${t.currency}`, totalsX + 120, yPos, {
            align: 'right',
          });

        yPos += 50;

        // Payment Instructions
        if (yPos > PAGE_HEIGHT - 200) {
          doc.addPage();
          yPos = MARGIN;
        }

        doc
          .font('Roboto-Bold')
          .fontSize(12)
          .fillColor('#1a1a2e')
          .text(t.paymentInstructions, MARGIN, yPos);

        yPos += 25;

        doc
          .font('Roboto')
          .fontSize(9)
          .fillColor('#666666')
          .text(t.paymentNote, MARGIN, yPos, { width: PAGE_WIDTH - 2 * MARGIN });

        yPos += 30;

        // Bank Details Section
        doc
          .font('Roboto-Bold')
          .fontSize(11)
          .fillColor('#1a1a2e')
          .text(t.bankDetails, MARGIN, yPos);

        yPos += 20;

        doc.font('Roboto').fontSize(9).fillColor('#333333');

        // Bank account info
        const bankInfo = [
          { label: t.beneficiary, value: 'Festivalul Lupilor SRL' },
          { label: t.accountNumber, value: 'MD00XX0000000000000000' },
          { label: t.bankName, value: 'BC "Moldova-Agroindbank" SA' },
          { label: 'IBAN', value: 'MD00AGIB0000000000000000' },
          { label: 'BIC/SWIFT', value: 'AGIBMD2X' },
        ];

        bankInfo.forEach((info) => {
          doc.font('Roboto-Bold').text(`${info.label}:`, MARGIN, yPos, { continued: true });
          doc.font('Roboto').text(` ${info.value}`, { width: PAGE_WIDTH - 2 * MARGIN });
          yPos += 18;
        });

        // Footer
        doc
          .font('Roboto')
          .fontSize(10)
          .fillColor('#999999')
          .text(t.footer, MARGIN, PAGE_HEIGHT - MARGIN - 40, {
            align: 'center',
            width: PAGE_WIDTH - 2 * MARGIN,
          });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },
};
