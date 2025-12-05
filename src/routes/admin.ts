import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { supabase } from '../services/supabase.js';
import { emailService } from '../services/email.js';
import { orderService } from '../services/order.js';
import { ticketService } from '../services/ticket.js';
import type { CreateInvitationRequest } from '../types/index.js';

const router = Router();

// Resend tickets email for a paid order
router.post('/orders/:orderId/resend-tickets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new AppError('Order not found', 404);
    }

    // Only allow resending for paid orders
    if (order.status !== 'paid') {
      throw new AppError('Can only resend tickets for paid orders', 400);
    }

    // Get order items with PDF URLs
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        ticket:tickets(*),
        option:ticket_options(*)
      `)
      .eq('order_id', orderId);

    if (itemsError || !items || items.length === 0) {
      throw new AppError('Order items not found', 404);
    }

    // Get PDF URLs from items
    const pdfUrls = items.map(item => item.pdf_url || '');

    // Check if all PDFs are ready
    const missingPdfs = pdfUrls.filter(url => !url).length;
    if (missingPdfs > 0) {
      throw new AppError(`${missingPdfs} ticket PDFs are not ready yet`, 400);
    }

    // Send email
    const success = await emailService.sendOrderConfirmation(order, items, pdfUrls);

    if (!success) {
      throw new AppError('Failed to send email', 500);
    }

    // Update order to track resend
    await supabase
      .from('orders')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    res.json({
      success: true,
      message: 'Tickets email sent successfully',
      email: order.customer_email,
    });
  } catch (error) {
    next(error);
  }
});

// Process refund for a paid order
router.post('/orders/:orderId/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { reason, adminEmail } = req.body;

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Refund reason is required', 400);
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new AppError('Order not found', 404);
    }

    // Only allow refund for paid orders
    if (order.status !== 'paid') {
      throw new AppError('Can only refund paid orders', 400);
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'refunded',
        payment_status: 'reversed',
        refund_reason: reason.trim(),
        refunded_at: new Date().toISOString(),
        refunded_by: adminEmail || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw new AppError('Failed to update order status', 500);
    }

    // Mark all order items as refunded
    const { error: itemsError } = await supabase
      .from('order_items')
      .update({ status: 'refunded' })
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error updating order items:', itemsError);
      // Don't fail - order is already refunded
    }

    console.log(`Order ${order.order_number} refunded by ${adminEmail || 'admin'}`);

    res.json({
      success: true,
      message: `Order ${order.order_number} refunded successfully`,
      orderNumber: order.order_number,
    });
  } catch (error) {
    next(error);
  }
});

// Create invitation (free ticket)
router.post('/invitations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customer, items, language, note } = req.body as CreateInvitationRequest;

    // Validate required fields
    if (!customer?.firstName || !customer?.lastName || !customer?.email) {
      throw new AppError('Customer name and email are required', 400);
    }

    if (!items || items.length === 0) {
      throw new AppError('At least one ticket is required', 400);
    }

    // Create invitation
    const order = await orderService.createInvitation({
      customer,
      items,
      language: language || 'ro',
      note,
    });

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        *,
        ticket:tickets(*),
        option:ticket_options(*)
      `)
      .eq('order_id', order.id);

    if (orderItems && orderItems.length > 0) {
      // Generate PDF tickets (marked as invitation)
      const pdfUrls = await ticketService.generateInvitationTickets(order, orderItems);

      // Update order items with PDF URLs
      for (let i = 0; i < orderItems.length; i++) {
        await supabase
          .from('order_items')
          .update({ pdf_url: pdfUrls[i] })
          .eq('id', orderItems[i].id);
      }

      // Send confirmation email with invitation tickets
      await emailService.sendInvitationEmail(order, orderItems, pdfUrls);
    }

    console.log(`Invitation ${order.order_number} created for ${customer.email}`);

    res.json({
      success: true,
      message: `Invitation created successfully`,
      orderNumber: order.order_number,
      orderId: order.id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
