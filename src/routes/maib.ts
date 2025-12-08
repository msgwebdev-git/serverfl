import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.js';
import { b2bOrderService } from '../services/b2b-order.js';
import { paymentService } from '../services/payment.js';
import { supabase } from '../services/supabase.js';
import { config } from '../config/index.js';

const router = Router();

interface MaibCallbackResult {
  payId: string;
  status: string;
  amount?: number;
  currency?: string;
  orderId?: string;
  statusCode?: string;
  statusMessage?: string;
  rrn?: string;
  approval?: string;
  cardNumber?: string;
  threeDs?: string;
}

/**
 * MAIB Callback URL - webhook для уведомлений о статусе платежа
 * POST /api/maib/callback
 */
router.post('/callback', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;

    console.log('MAIB Callback received:', {
      body,
      headers: {
        'content-type': req.headers['content-type'],
        'x-maib-signature': req.headers['x-maib-signature'],
      },
      timestamp: new Date().toISOString(),
    });

    // Get signature from body or header
    const signature = (body.signature as string) || (req.headers['x-maib-signature'] as string) || '';

    if (!signature) {
      console.error('MAIB Callback: No signature provided');
      res.status(400).json({ error: 'No signature provided' });
      return;
    }

    // Verify callback signature
    if (!paymentService.verifyCallback(body, signature)) {
      console.error('MAIB Callback: Invalid signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Extract result data (MAIB sends data in 'result' object)
    const resultData = (body.result || body) as MaibCallbackResult;
    const {
      payId: transactionId,
      status,
      orderId,
      statusCode,
      statusMessage,
    } = resultData;

    if (!transactionId) {
      console.error('MAIB Callback: Missing transaction ID');
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    console.log('MAIB Callback data:', {
      transactionId,
      status,
      orderId,
      statusCode,
      statusMessage,
    });

    // Find order by transaction ID (check both regular and B2B orders)
    let order = await orderService.getOrderByTransactionId(transactionId);
    let isB2BOrder = false;

    // If not found in regular orders, check B2B orders
    if (!order) {
      const { data: b2bOrder } = await supabase
        .from('b2b_orders')
        .select('*')
        .eq('maib_transaction_id', transactionId)
        .single();

      if (b2bOrder) {
        order = b2bOrder;
        isB2BOrder = true;
      }
    }

    if (!order) {
      console.error('MAIB Callback: Order not found for transaction', transactionId);
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Map MAIB status to our status
    const successStatuses = ['OK', 'COMPLETED', 'SUCCESS', 'APPROVED'];
    const failedStatuses = ['FAILED', 'DECLINED', 'ERROR'];
    const cancelledStatuses = ['CANCELLED', 'CANCELED'];

    const upperStatus = status?.toUpperCase() || '';

    if (successStatuses.includes(upperStatus)) {
      // Payment successful
      if (isB2BOrder) {
        await b2bOrderService.markAsPaid(order.id);
        try {
          await b2bOrderService.generateTickets(order.id);
          console.log('MAIB Callback: B2B Order marked as paid and tickets generated', order.id);
        } catch (ticketError) {
          console.error('MAIB Callback: Failed to generate B2B tickets:', ticketError);
        }
      } else {
        await orderService.markAsPaid(order.id);
        orderService.processSuccessfulOrder(order.id).catch(console.error);
        console.log('MAIB Callback: Order marked as paid', order.id);
      }
    } else if (failedStatuses.includes(upperStatus)) {
      // Payment failed
      if (isB2BOrder) {
        await b2bOrderService.updateStatus(order.id, 'payment_failed', undefined, `Payment failed: ${statusCode || status}`);
        console.log('MAIB Callback: B2B Order marked as failed', order.id);
      } else {
        await orderService.markAsFailed(order.id, statusCode || status);
        console.log('MAIB Callback: Order marked as failed', order.id);
      }
    } else if (cancelledStatuses.includes(upperStatus)) {
      // Payment cancelled
      if (isB2BOrder) {
        await b2bOrderService.updateStatus(order.id, 'cancelled', undefined, 'Payment cancelled by user');
        console.log('MAIB Callback: B2B Order marked as cancelled', order.id);
      } else {
        await orderService.markAsFailed(order.id, 'CANCELLED');
        console.log('MAIB Callback: Order marked as cancelled', order.id);
      }
    } else {
      // Unknown status - log but don't fail
      console.warn('MAIB Callback: Unknown status', status);
    }

    // Always respond with success to MAIB
    res.json({
      success: true,
      message: 'Callback processed successfully',
    });
  } catch (error) {
    console.error('MAIB Callback error:', error);
    next(error);
  }
});

/**
 * MAIB Ok URL - перенаправление после успешной оплаты
 * GET /api/maib/return/ok
 */
router.get('/return/ok', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactionId = req.query.payId as string;
    const orderId = req.query.orderId as string;

    console.log('MAIB OK return:', {
      transactionId,
      orderId,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    // Find order
    let order;

    // First try to find by transaction ID
    if (transactionId) {
      order = await orderService.getOrderByTransactionId(transactionId);

      if (!order) {
        const { data: b2bOrder } = await supabase
          .from('b2b_orders')
          .select('*')
          .eq('maib_transaction_id', transactionId)
          .single();

        if (b2bOrder) {
          order = b2bOrder;
        }
      }
    }

    // If not found by transaction ID, try by order ID
    if (!order && orderId) {
      const { data: regularOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (regularOrder) {
        order = regularOrder;
      } else {
        const { data: b2bOrder } = await supabase
          .from('b2b_orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (b2bOrder) {
          order = b2bOrder;
        }
      }
    }

    if (!order) {
      console.error('MAIB OK return: Order not found');
      res.redirect(`${config.frontendUrl}/checkout/failed?reason=ORDER_NOT_FOUND`);
      return;
    }

    // Redirect to success page
    const orderNumber = order.order_number;
    res.redirect(`${config.frontendUrl}/checkout/success?order=${orderNumber}`);
  } catch (error) {
    console.error('MAIB OK return error:', error);
    next(error);
  }
});

/**
 * MAIB Fail URL - перенаправление после неудачной оплаты
 * GET /api/maib/return/fail
 */
router.get('/return/fail', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactionId = req.query.payId as string;
    const orderId = req.query.orderId as string;
    const statusCode = req.query.statusCode as string;

    console.log('MAIB FAIL return:', {
      transactionId,
      orderId,
      statusCode,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    // Find order
    let order;

    // First try to find by transaction ID
    if (transactionId) {
      order = await orderService.getOrderByTransactionId(transactionId);

      if (!order) {
        const { data: b2bOrder } = await supabase
          .from('b2b_orders')
          .select('*')
          .eq('maib_transaction_id', transactionId)
          .single();

        if (b2bOrder) {
          order = b2bOrder;
        }
      }
    }

    // If not found by transaction ID, try by order ID
    if (!order && orderId) {
      const { data: regularOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (regularOrder) {
        order = regularOrder;
      } else {
        const { data: b2bOrder } = await supabase
          .from('b2b_orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (b2bOrder) {
          order = b2bOrder;
        }
      }
    }

    if (!order) {
      console.error('MAIB FAIL return: Order not found');
      res.redirect(`${config.frontendUrl}/checkout/failed?reason=ORDER_NOT_FOUND`);
      return;
    }

    // Update order status to failed if needed
    if (order.payment_status !== 'failed') {
      // Try to update regular order first
      try {
        await orderService.markAsFailed(order.id, statusCode || 'USER_CANCELLED');
      } catch (regularOrderError) {
        // If regular order update fails, try B2B order
        try {
          await b2bOrderService.updateStatus(order.id, 'payment_failed', undefined, `Payment failed: ${statusCode || 'USER_CANCELLED'}`);
        } catch (b2bOrderError) {
          console.error('Failed to update order status:', { regularOrderError, b2bOrderError });
        }
      }
    }

    // Redirect to failure page
    const orderNumber = order.order_number;
    const reason = statusCode || 'PAYMENT_FAILED';
    res.redirect(`${config.frontendUrl}/checkout/failed?order=${orderNumber}&reason=${reason}`);
  } catch (error) {
    console.error('MAIB FAIL return error:', error);
    next(error);
  }
});

export default router;
