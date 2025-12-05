import QRCode from 'qrcode';
import { supabase } from './supabase.js';
import { createTicketPDF, createInvitationPDF } from './ticket-pdfkit.js';
import type { Order, OrderItem } from '../types/index.js';

export const ticketService = {
  // Generate QR code as data URL
  async generateQRCode(data: string): Promise<string> {
    return QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'L',
    });
  },

  // Generate tickets and upload to Supabase Storage (parallel processing)
  async generateTickets(order: Order, items: OrderItem[]): Promise<string[]> {
    // Process all tickets in parallel for speed
    const results = await Promise.all(
      items.map(async (item) => {
        try {
          // Generate QR code
          const qrDataUrl = await this.generateQRCode(item.qr_data);

          // Generate PDF with PDFKit (much faster than @react-pdf)
          const pdfBuffer = await createTicketPDF({
            orderNumber: order.order_number,
            ticketCode: item.ticket_code,
            customerName: order.customer_name,
            // @ts-ignore - joined data
            ticketName: item.ticket?.name_ro || 'Festival Ticket',
            // @ts-ignore
            optionName: item.option?.name_ro,
            qrDataUrl,
          });

          // Upload to Supabase Storage
          const fileName = `tickets/${order.order_number}/${item.ticket_code}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from('tickets')
            .upload(fileName, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            return '';
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('tickets')
            .getPublicUrl(fileName);

          return urlData.publicUrl;
        } catch (error) {
          console.error('Generate ticket error:', error);
          return '';
        }
      })
    );

    return results;
  },

  // Generate invitation tickets (with INVITATION label)
  async generateInvitationTickets(order: Order, items: OrderItem[]): Promise<string[]> {
    // Process all tickets in parallel for speed
    const results = await Promise.all(
      items.map(async (item) => {
        try {
          // Generate QR code
          const qrDataUrl = await this.generateQRCode(item.qr_data);

          // Generate PDF with INVITATION label
          const pdfBuffer = await createInvitationPDF({
            orderNumber: order.order_number,
            ticketCode: item.ticket_code,
            customerName: order.customer_name,
            // @ts-ignore - joined data
            ticketName: item.ticket?.name_ro || 'Festival Ticket',
            // @ts-ignore
            optionName: item.option?.name_ro,
            qrDataUrl,
          });

          // Upload to Supabase Storage
          const fileName = `tickets/${order.order_number}/${item.ticket_code}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from('tickets')
            .upload(fileName, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            return '';
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('tickets')
            .getPublicUrl(fileName);

          return urlData.publicUrl;
        } catch (error) {
          console.error('Generate invitation ticket error:', error);
          return '';
        }
      })
    );

    return results;
  },
};
