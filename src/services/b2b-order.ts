import { customAlphabet } from 'nanoid';
import { supabase } from './supabase.js';
import { b2bDiscountService } from './b2b-discount.js';
import { ticketService } from './ticket.js';
import { createTicketPDF } from './ticket-pdfkit.js';
import { emailService } from './email.js';
import { AppError } from '../middleware/errorHandler.js';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

// Generate unique B2B order number
function generateB2BOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = nanoid(6);
  return `B2B${year}${month}-${random}`;
}

// Generate unique invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = nanoid(6);
  return `INV${year}${month}-${random}`;
}

export interface B2BOrderItem {
  ticketId: string;
  ticketOptionId?: string;
  quantity: number;
}

export interface CreateB2BOrderParams {
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
  items: B2BOrderItem[];
  paymentMethod: 'online' | 'invoice';
  notes?: string;
  language: 'ro' | 'ru';
  clientIp?: string;
}

export interface B2BOrder {
  id: string;
  order_number: string;
  company_name: string;
  company_tax_id: string | null;
  company_address: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  payment_method: 'online' | 'invoice';
  status: string;
  total_amount: number;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  invoice_url: string | null;
  invoice_number: string | null;
  notes: string | null;
  language: 'ro' | 'ru';
  created_at: string;
  updated_at: string;
}

export const b2bOrderService = {
  /**
   * Create new B2B order
   */
  async createOrder(params: CreateB2BOrderParams): Promise<B2BOrder> {
    const { company, contact, items, paymentMethod, notes, language, clientIp } = params;

    // Calculate total amount and quantity
    let totalAmount = 0;
    let totalQuantity = 0;
    const orderItems: Array<{
      ticket_id: string;
      ticket_option_id: string | null;
      quantity: number;
      unit_price: number;
      discount_percent: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      // Get ticket price
      const { data: ticket } = await supabase
        .from('tickets')
        .select('price')
        .eq('id', item.ticketId)
        .single();

      if (!ticket) {
        throw new AppError(`Ticket not found: ${item.ticketId}`, 400);
      }

      let unitPrice = ticket.price;

      // Add option price modifier if applicable
      if (item.ticketOptionId) {
        const { data: option } = await supabase
          .from('ticket_options')
          .select('price_modifier')
          .eq('id', item.ticketOptionId)
          .single();

        if (option && option.price_modifier) {
          unitPrice += option.price_modifier;
        }
      }

      const itemTotal = unitPrice * item.quantity;
      totalAmount += itemTotal;
      totalQuantity += item.quantity;

      orderItems.push({
        ticket_id: item.ticketId,
        ticket_option_id: item.ticketOptionId || null,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_percent: 0, // Will be calculated later
        total_price: itemTotal,
      });
    }

    // Validate minimum quantity
    if (!b2bDiscountService.validateMinimumQuantity(totalQuantity)) {
      throw new AppError(
        `Minimum quantity for B2B order is ${b2bDiscountService.getDiscountTiers()[0].minQuantity} tickets`,
        400
      );
    }

    // Calculate discount
    const discount = b2bDiscountService.calculateDiscount(totalAmount, totalQuantity);

    // Apply discount to order items proportionally
    for (const item of orderItems) {
      item.discount_percent = discount.discountPercent;
      item.total_price = Math.round(
        item.total_price * (1 - discount.discountPercent / 100) * 100
      ) / 100;
    }

    // Generate order number
    const orderNumber = generateB2BOrderNumber();
    const invoiceNumber = paymentMethod === 'invoice' ? generateInvoiceNumber() : null;

    // Create B2B order
    const { data: order, error: orderError } = await supabase
      .from('b2b_orders')
      .insert({
        order_number: orderNumber,
        company_name: company.name,
        company_tax_id: company.taxId || null,
        company_address: company.address || null,
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone,
        payment_method: paymentMethod,
        status: paymentMethod === 'online' ? 'pending' : 'invoice_sent',
        total_amount: totalAmount,
        discount_percent: discount.discountPercent,
        discount_amount: discount.discountAmount,
        final_amount: discount.finalAmount,
        invoice_number: invoiceNumber,
        notes: notes || null,
        language,
        client_ip: clientIp || null,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new AppError(`Failed to create B2B order: ${orderError?.message}`, 500);
    }

    // Create order items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      b2b_order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('b2b_order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      // Rollback: delete order
      await supabase.from('b2b_orders').delete().eq('id', order.id);
      throw new AppError(`Failed to create order items: ${itemsError.message}`, 500);
    }

    // Add initial history entry
    await this.addHistoryEntry(order.id, order.status, null, 'Order created');

    return order as B2BOrder;
  },

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<B2BOrder | null> {
    const { data, error } = await supabase
      .from('b2b_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      throw new AppError(`Failed to get order: ${error.message}`, 500);
    }

    return data as B2BOrder | null;
  },

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<B2BOrder | null> {
    const { data, error } = await supabase
      .from('b2b_orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(`Failed to get order: ${error.message}`, 500);
    }

    return data as B2BOrder | null;
  },

  /**
   * Get order items
   */
  async getOrderItems(orderId: string) {
    const { data, error } = await supabase
      .from('b2b_order_items')
      .select(`
        *,
        ticket:tickets(name, name_ro, name_ru),
        ticket_option:ticket_options(name, name_ro, name_ru)
      `)
      .eq('b2b_order_id', orderId);

    if (error) {
      throw new AppError(`Failed to get order items: ${error.message}`, 500);
    }

    return data;
  },

  /**
   * Update order status
   */
  async updateStatus(
    orderId: string,
    newStatus: string,
    changedBy?: string,
    note?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('b2b_orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      throw new AppError(`Failed to update order status: ${error.message}`, 500);
    }

    // Add history entry
    await this.addHistoryEntry(orderId, newStatus, changedBy, note);
  },

  /**
   * Mark order as paid
   */
  async markAsPaid(orderId: string, changedBy?: string): Promise<void> {
    const { error } = await supabase
      .from('b2b_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_status: 'ok',
      })
      .eq('id', orderId);

    if (error) {
      throw new AppError(`Failed to mark order as paid: ${error.message}`, 500);
    }

    await this.addHistoryEntry(orderId, 'paid', changedBy, 'Payment confirmed');
  },

  /**
   * Update MAIB transaction ID
   */
  async updateTransactionId(orderId: string, transactionId: string): Promise<void> {
    const { error } = await supabase
      .from('b2b_orders')
      .update({ maib_transaction_id: transactionId })
      .eq('id', orderId);

    if (error) {
      throw new AppError(`Failed to update transaction ID: ${error.message}`, 500);
    }
  },

  /**
   * Update invoice URL
   */
  async updateInvoiceUrl(orderId: string, invoiceUrl: string): Promise<void> {
    const { error } = await supabase
      .from('b2b_orders')
      .update({
        invoice_url: invoiceUrl,
        invoice_sent_at: new Date().toISOString(),
        status: 'invoice_sent',
      })
      .eq('id', orderId);

    if (error) {
      throw new AppError(`Failed to update invoice URL: ${error.message}`, 500);
    }

    await this.addHistoryEntry(orderId, 'invoice_sent', null, 'Invoice generated and sent');
  },

  /**
   * Mark tickets as sent
   */
  async markTicketsAsSent(orderId: string, changedBy?: string): Promise<void> {
    // Get order details
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Get ticket count
    const items = await this.getOrderItems(orderId);
    const ticketCount = items.length;

    // Update status
    const { error } = await supabase
      .from('b2b_orders')
      .update({
        status: 'tickets_sent',
        tickets_sent_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      throw new AppError(`Failed to mark tickets as sent: ${error.message}`, 500);
    }

    await this.addHistoryEntry(orderId, 'tickets_sent', changedBy, 'Tickets sent to customer');

    // Send tickets by email
    await emailService.sendB2BTickets(
      order.order_number,
      order.company_name,
      order.contact_name,
      order.contact_email,
      ticketCount,
      order.language
    );
  },

  /**
   * Complete order
   */
  async completeOrder(orderId: string, changedBy?: string): Promise<void> {
    await this.updateStatus(orderId, 'completed', changedBy, 'Order completed');
  },

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason: string, changedBy?: string): Promise<void> {
    const { error } = await supabase
      .from('b2b_orders')
      .update({ status: 'cancelled', notes: reason })
      .eq('id', orderId);

    if (error) {
      throw new AppError(`Failed to cancel order: ${error.message}`, 500);
    }

    await this.addHistoryEntry(orderId, 'cancelled', changedBy, `Order cancelled: ${reason}`);
  },

  /**
   * Add history entry
   */
  async addHistoryEntry(
    orderId: string,
    status: string,
    changedBy?: string | null,
    note?: string | null
  ): Promise<void> {
    const { error } = await supabase.from('b2b_order_history').insert({
      b2b_order_id: orderId,
      status,
      changed_by: changedBy || null,
      note: note || null,
    });

    if (error) {
      console.error('Failed to add history entry:', error);
    }
  },

  /**
   * Get order history
   */
  async getOrderHistory(orderId: string) {
    const { data, error } = await supabase
      .from('b2b_order_history')
      .select('*')
      .eq('b2b_order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(`Failed to get order history: ${error.message}`, 500);
    }

    return data;
  },

  /**
   * List all B2B orders with filters
   */
  async listOrders(filters?: {
    status?: string;
    paymentMethod?: string;
    companyName?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('b2b_orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }

    if (filters?.companyName) {
      query = query.ilike('company_name', `%${filters.companyName}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new AppError(`Failed to list orders: ${error.message}`, 500);
    }

    return { orders: data, total: count || 0 };
  },

  /**
   * Generate tickets for B2B order
   */
  async generateTickets(orderId: string) {
    // Get order details
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.status !== 'paid') {
      throw new AppError('Order must be paid before generating tickets', 400);
    }

    // Get aggregated B2B order items
    const aggregatedItems = await this.getOrderItems(orderId);

    // Get IDs of aggregated items to delete them later
    const aggregatedItemIds = aggregatedItems.map((item: any) => item.id);

    // Create individual ticket records
    const individualTickets = [];

    for (const aggregatedItem of aggregatedItems) {
      for (let i = 0; i < aggregatedItem.quantity; i++) {
        // Generate unique ticket code
        const ticketCode = `B2B-${order.order_number}-${nanoid(6)}`;
        const qrData = JSON.stringify({
          orderId,
          ticketCode,
          ticketId: aggregatedItem.ticket_id,
          optionId: aggregatedItem.ticket_option_id,
          companyName: order.company_name,
        });

        // Get ticket name based on language
        const ticketName = order.language === 'ro'
          ? aggregatedItem.ticket.name_ro
          : aggregatedItem.ticket.name_ru;

        const optionName = aggregatedItem.ticket_option
          ? (order.language === 'ro'
              ? aggregatedItem.ticket_option.name_ro
              : aggregatedItem.ticket_option.name_ru)
          : undefined;

        individualTickets.push({
          b2b_order_id: orderId,
          ticket_id: aggregatedItem.ticket_id,
          ticket_option_id: aggregatedItem.ticket_option_id,
          quantity: 1,
          unit_price: aggregatedItem.unit_price,
          discount_percent: aggregatedItem.discount_percent,
          total_price: aggregatedItem.unit_price * (1 - aggregatedItem.discount_percent / 100),
          ticket_code: ticketCode,
          qr_data: qrData,
          status: 'confirmed',
          ticketName,
          optionName,
        });
      }
    }

    // Delete aggregated items
    await supabase.from('b2b_order_items').delete().in('id', aggregatedItemIds);

    // Insert individual ticket records
    const { error: insertError } = await supabase
      .from('b2b_order_items')
      .insert(
        individualTickets.map((t) => ({
          b2b_order_id: t.b2b_order_id,
          ticket_id: t.ticket_id,
          ticket_option_id: t.ticket_option_id,
          quantity: t.quantity,
          unit_price: t.unit_price,
          discount_percent: t.discount_percent,
          total_price: t.total_price,
          ticket_code: t.ticket_code,
          qr_data: t.qr_data,
          status: t.status,
        }))
      );

    if (insertError) {
      throw new AppError(`Failed to create individual tickets: ${insertError.message}`, 500);
    }

    // Generate PDFs for all tickets in parallel
    const pdfPromises = individualTickets.map(async (ticket) => {
      try {
        // Generate QR code
        const qrDataUrl = await ticketService.generateQRCode(ticket.qr_data);

        // Generate PDF
        const pdfBuffer = await createTicketPDF({
          orderNumber: order.order_number,
          ticketCode: ticket.ticket_code,
          customerName: order.company_name,
          ticketName: ticket.ticketName,
          optionName: ticket.optionName,
          qrDataUrl,
        });

        // Upload to Supabase Storage
        const fileName = `tickets/${order.order_number}/${ticket.ticket_code}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('tickets')
          .upload(fileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          throw new AppError(`Failed to upload ticket: ${uploadError.message}`, 500);
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from('tickets').getPublicUrl(fileName);

        // Update ticket record with URL
        await supabase
          .from('b2b_order_items')
          .update({ ticket_url: urlData.publicUrl })
          .eq('ticket_code', ticket.ticket_code);

        return urlData.publicUrl;
      } catch (error) {
        console.error('Generate B2B ticket error:', error);
        throw error;
      }
    });

    // Wait for all PDFs to be generated
    await Promise.all(pdfPromises);

    // Update order status and timestamp
    const { error: updateError } = await supabase
      .from('b2b_orders')
      .update({
        status: 'tickets_generated',
        tickets_generated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new AppError(`Failed to update order status: ${updateError.message}`, 500);
    }

    await this.addHistoryEntry(orderId, 'tickets_generated', undefined, 'Tickets generated');

    return true;
  },
};
