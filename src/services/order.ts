import { customAlphabet } from 'nanoid';
import { supabase } from './supabase.js';
import { ticketService } from './ticket.js';
import { emailService } from './email.js';
import { promoService } from './promo.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateOrderRequest, CreateInvitationRequest, Order } from '../types/index.js';

// Custom alphabet without _ and - for cleaner codes
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

// Generate unique order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = nanoid(6);
  return `FL${year}${month}-${random}`;
}

// Generate unique invitation number
function generateInvitationNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = nanoid(6);
  return `INV${year}${month}-${random}`;
}

// Generate unique ticket code
function generateTicketCode(): string {
  return nanoid(12);
}

export const orderService = {
  // Create new order
  async createOrder(params: CreateOrderRequest): Promise<Order> {
    const { customer, items, promoCode, language, clientIp } = params;

    // Cancel any existing pending orders for this email
    await this.cancelPendingOrdersByEmail(customer.email);

    // Calculate total amount
    let totalAmount = 0;
    const orderItems: Array<{
      ticket_id: string;
      ticket_option_id: string | null;
      quantity: number;
      unit_price: number;
      ticket_code: string;
      qr_data: string;
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
      if (item.optionId) {
        const { data: option } = await supabase
          .from('ticket_options')
          .select('price_modifier')
          .eq('id', item.optionId)
          .single();

        if (option) {
          unitPrice += option.price_modifier;
        }
      }

      totalAmount += unitPrice * item.quantity;

      // Create order item entries (one per ticket)
      for (let i = 0; i < item.quantity; i++) {
        const ticketCode = generateTicketCode();
        orderItems.push({
          ticket_id: item.ticketId,
          ticket_option_id: item.optionId || null,
          quantity: 1,
          unit_price: unitPrice,
          ticket_code: ticketCode,
          qr_data: JSON.stringify({ code: ticketCode, ts: Date.now() }),
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promoCode) {
      // Get unique ticket IDs from items
      const ticketIds = [...new Set(items.map((item) => item.ticketId))];

      const promoResult = await promoService.validatePromoCode({
        code: promoCode,
        totalAmount,
        email: customer.email,
        ticketIds,
      });
      if (promoResult.valid && promoResult.discountAmount) {
        discountAmount = promoResult.discountAmount;
      }
    }

    // Create order
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        status: 'pending',
        customer_email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`,
        customer_phone: customer.phone,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        promo_code: promoCode || null,
        payment_status: 'pending',
        language,
        client_ip: clientIp,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Create order error:', orderError);
      throw new AppError('Failed to create order', 500);
    }

    // Create order items
    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('Create order items error:', itemsError);
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      throw new AppError('Failed to create order items', 500);
    }

    // Increment promo code usage
    if (promoCode) {
      await promoService.incrementUsage(promoCode);
    }

    return order;
  },

  // Update order with MAIB transaction ID
  async updateTransactionId(orderId: string, transactionId: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ maib_transaction_id: transactionId })
      .eq('id', orderId);

    if (error) {
      console.error('Update transaction ID error:', error);
    }
  },

  // Get order by transaction ID
  async getOrderByTransactionId(transactionId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('maib_transaction_id', transactionId)
      .single();

    if (error) {
      console.error('Get order by transaction ID error:', error);
      return null;
    }

    return data;
  },

  // Get order by order number
  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (error) {
      return null;
    }

    return data;
  },

  // Mark order as paid
  async markAsPaid(orderId: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'ok',
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Mark as paid error:', error);
    }
  },

  // Mark order as failed
  async markAsFailed(orderId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'failed',
        payment_status: 'failed',
        failure_reason: reason,
      })
      .eq('id', orderId);

    if (error) {
      console.error('Mark as failed error:', error);
    }
  },

  // Process successful order (generate PDFs, send email)
  async processSuccessfulOrder(orderId: string): Promise<void> {
    try {
      // Get order with items
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) {
        throw new Error('Order not found');
      }

      const { data: items } = await supabase
        .from('order_items')
        .select(`
          *,
          ticket:tickets(*),
          option:ticket_options(*)
        `)
        .eq('order_id', orderId);

      if (!items || items.length === 0) {
        throw new Error('Order items not found');
      }

      // Generate PDF tickets
      const pdfUrls = await ticketService.generateTickets(order, items);

      // Update order items with PDF URLs
      for (let i = 0; i < items.length; i++) {
        await supabase
          .from('order_items')
          .update({ pdf_url: pdfUrls[i] })
          .eq('id', items[i].id);
      }

      // Send confirmation email with tickets
      await emailService.sendOrderConfirmation(order, items, pdfUrls);

      console.log(`Order ${order.order_number} processed successfully`);
    } catch (error) {
      console.error('Process successful order error:', error);
      throw error;
    }
  },

  // Get pending orders for 1st reminder (after 1 hour, reminder_count = 0)
  async getPendingOrdersForFirstReminder(hoursOld: number): Promise<Order[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .eq('reminder_count', 0)
      .lt('created_at', cutoffTime.toISOString());

    if (error) {
      console.error('Get pending orders for 1st reminder error:', error);
      return [];
    }

    return data || [];
  },

  // Get pending orders for 2nd reminder (after 24 hours, reminder_count = 1)
  async getPendingOrdersForSecondReminder(hoursOld: number): Promise<Order[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .eq('reminder_count', 1)
      .lt('created_at', cutoffTime.toISOString());

    if (error) {
      console.error('Get pending orders for 2nd reminder error:', error);
      return [];
    }

    return data || [];
  },

  // Increment reminder count after sending
  async incrementReminderCount(orderId: string): Promise<void> {
    const { data: order } = await supabase
      .from('orders')
      .select('reminder_count')
      .eq('id', orderId)
      .single();

    const currentCount = order?.reminder_count || 0;

    await supabase
      .from('orders')
      .update({
        reminder_count: currentCount + 1,
        reminder_sent_at: new Date().toISOString()
      })
      .eq('id', orderId);
  },

  // Cancel all pending orders for a specific email (when user starts new checkout)
  async cancelPendingOrdersByEmail(email: string): Promise<number> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('customer_email', email)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      console.error('Cancel pending orders error:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`Cancelled ${count} pending orders for ${email}`);
    }
    return count;
  },

  // Expire old pending orders (called by cron)
  async expireOldPendingOrders(hoursOld: number): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', cutoffTime.toISOString())
      .select('id, order_number');

    if (error) {
      console.error('Expire old pending orders error:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`Expired ${count} old pending orders:`, data?.map(o => o.order_number));
    }
    return count;
  },

  // Get order tickets with PDF URLs
  async getOrderTickets(orderNumber: string): Promise<{
    orderNumber: string;
    status: string;
    tickets: Array<{
      ticketCode: string;
      ticketName: string;
      optionName: string | null;
      pdfUrl: string | null;
    }>;
  } | null> {
    // Get order
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .eq('order_number', orderNumber)
      .single();

    if (!order) {
      return null;
    }

    // Get order items with ticket info
    const { data: items } = await supabase
      .from('order_items')
      .select(`
        ticket_code,
        pdf_url,
        ticket:tickets(name_ro, name_ru),
        option:ticket_options(name_ro, name_ru)
      `)
      .eq('order_id', order.id);

    if (!items) {
      return {
        orderNumber: order.order_number,
        status: order.status,
        tickets: [],
      };
    }

    return {
      orderNumber: order.order_number,
      status: order.status,
      tickets: items.map((item) => ({
        ticketCode: item.ticket_code,
        // @ts-ignore - joined data
        ticketName: item.ticket?.name_ro || 'Ticket',
        // @ts-ignore
        optionName: item.option?.name_ro || null,
        pdfUrl: item.pdf_url,
      })),
    };
  },

  // Create invitation (free ticket, not counted as sale)
  async createInvitation(params: CreateInvitationRequest): Promise<Order> {
    const { customer, items, language, note } = params;

    // Build order items with zero price
    const orderItems: Array<{
      ticket_id: string;
      ticket_option_id: string | null;
      quantity: number;
      unit_price: number;
      ticket_code: string;
      qr_data: string;
      is_invitation: boolean;
    }> = [];

    for (const item of items) {
      // Validate ticket exists
      const { data: ticket } = await supabase
        .from('tickets')
        .select('id, name_ro')
        .eq('id', item.ticketId)
        .single();

      if (!ticket) {
        throw new AppError(`Ticket not found: ${item.ticketId}`, 400);
      }

      // Validate option if provided
      if (item.optionId) {
        const { data: option } = await supabase
          .from('ticket_options')
          .select('id')
          .eq('id', item.optionId)
          .single();

        if (!option) {
          throw new AppError(`Ticket option not found: ${item.optionId}`, 400);
        }
      }

      // Create order item entries (one per ticket, zero price)
      for (let i = 0; i < item.quantity; i++) {
        const ticketCode = generateTicketCode();
        orderItems.push({
          ticket_id: item.ticketId,
          ticket_option_id: item.optionId || null,
          quantity: 1,
          unit_price: 0, // Invitations are free
          ticket_code: ticketCode,
          qr_data: JSON.stringify({ code: ticketCode, ts: Date.now(), inv: true }),
          is_invitation: true, // Mark as invitation for quick scanning
        });
      }
    }

    // Create invitation order
    const orderNumber = generateInvitationNumber();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        status: 'paid', // Invitations are immediately "paid" (no payment needed)
        customer_email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`,
        customer_phone: customer.phone || '',
        total_amount: 0, // Free
        discount_amount: 0,
        promo_code: note || null, // Use promo_code field for invitation note
        payment_status: 'ok', // Considered paid
        language,
        is_invitation: true,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Create invitation error:', orderError);
      throw new AppError('Failed to create invitation', 500);
    }

    // Create order items
    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('Create invitation items error:', itemsError);
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      throw new AppError('Failed to create invitation items', 500);
    }

    return order;
  },
};
