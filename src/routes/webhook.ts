import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.js';
import { paymentService } from '../services/payment.js';

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

// MAIB callback webhook
router.post('/maib', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Find order by transaction ID
    const order = await orderService.getOrderByTransactionId(transactionId);

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
      await orderService.markAsPaid(order.id);

      // Generate tickets and send email (async)
      orderService.processSuccessfulOrder(order.id).catch(console.error);

      console.log('MAIB Callback: Order marked as paid', order.id);
    } else if (failedStatuses.includes(upperStatus)) {
      // Payment failed
      await orderService.markAsFailed(order.id, statusCode || status);
      console.log('MAIB Callback: Order marked as failed', order.id);
    } else if (cancelledStatuses.includes(upperStatus)) {
      // Payment cancelled
      await orderService.markAsFailed(order.id, 'CANCELLED');
      console.log('MAIB Callback: Order marked as cancelled', order.id);
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

// Mock payment callback (for testing)
router.post('/mock-payment', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { transactionId, status } = req.body as { transactionId: string; status: 'OK' | 'FAILED' };

    if (!transactionId || !status) {
      res.status(400).json({ error: 'Missing transactionId or status' });
      return;
    }

    // Update mock transaction
    paymentService.processMockCallback(transactionId, status);

    // Find and update order
    const order = await orderService.getOrderByTransactionId(transactionId);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (status === 'OK') {
      await orderService.markAsPaid(order.id);
      orderService.processSuccessfulOrder(order.id).catch(console.error);
    } else {
      await orderService.markAsFailed(order.id, 'MOCK_FAILED');
    }

    res.json({
      success: true,
      orderNumber: order.order_number,
      status,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
