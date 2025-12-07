import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { b2bDiscountService } from '../services/b2b-discount.js';
import { b2bOrderService } from '../services/b2b-order.js';
import { invoiceService } from '../services/b2b-invoice.js';
import { paymentService } from '../services/payment.js';

const router = Router();

// Validation schemas
const calculateDiscountSchema = z.object({
  items: z
    .array(
      z.object({
        ticketId: z.string().uuid(),
        ticketOptionId: z.string().uuid().optional(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
});

const createOrderSchema = z.object({
  company: z.object({
    name: z.string().min(1),
    taxId: z.string().optional(),
    address: z.string().optional(),
  }),
  contact: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(5),
  }),
  items: z
    .array(
      z.object({
        ticketId: z.string().uuid(),
        ticketOptionId: z.string().uuid().optional(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
  paymentMethod: z.enum(['online', 'invoice']),
  notes: z.string().optional(),
  language: z.enum(['ro', 'ru']),
});

/**
 * POST /api/b2b/calculate-discount
 * Calculate discount for given items
 */
router.post(
  '/calculate-discount',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = calculateDiscountSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(`Validation error: ${validation.error.message}`, 400);
      }

      const { items } = validation.data;

      // Calculate total quantity
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      // Get discount summary
      const summary = b2bDiscountService.getDiscountSummary(0, totalQuantity);

      res.json({
        success: true,
        data: {
          totalQuantity,
          isValid: summary.isValid,
          message: summary.message,
          discount: summary.discount,
          nextTier: summary.nextTier,
          tiers: b2bDiscountService.getDiscountTiers(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/b2b/create-order
 * Create new B2B order
 */
router.post('/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(`Validation error: ${validation.error.message}`, 400);
    }

    const { company, contact, items, paymentMethod, notes, language } = validation.data;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Create B2B order
    const order = await b2bOrderService.createOrder({
      company,
      contact,
      items,
      paymentMethod,
      notes,
      language,
      clientIp,
    });

    // If payment method is online, create MAIB transaction
    let redirectUrl = null;
    let transactionId = null;

    if (paymentMethod === 'online') {
      const transaction = await paymentService.createTransaction({
        orderId: order.id,
        amount: order.final_amount,
        description: `B2B Order #${order.order_number}`,
        clientIp,
        language,
      });

      await b2bOrderService.updateTransactionId(order.id, transaction.transactionId);

      redirectUrl = transaction.payUrl;
      transactionId = transaction.transactionId;
    }

    // If payment method is invoice, generate invoice
    if (paymentMethod === 'invoice') {
      await invoiceService.generateInvoice(order.id);
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        invoiceNumber: order.invoice_number,
        paymentMethod,
        redirectUrl,
        transactionId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/b2b/orders/:id
 * Get order details
 */
router.get('/orders/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const order = await b2bOrderService.getOrderById(id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const items = await b2bOrderService.getOrderItems(id);
    const history = await b2bOrderService.getOrderHistory(id);

    res.json({
      success: true,
      data: {
        order,
        items,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/b2b/orders
 * List B2B orders
 */
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, paymentMethod, companyName, limit, offset } = req.query;

    const filters = {
      status: status as string | undefined,
      paymentMethod: paymentMethod as string | undefined,
      companyName: companyName as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await b2bOrderService.listOrders(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/b2b/orders/:id/generate-invoice
 * Generate invoice for order
 */
router.post(
  '/orders/:id/generate-invoice',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await invoiceService.generateInvoice(id);

      // Get updated order with invoice URL
      const order = await b2bOrderService.getOrderById(id);

      res.json({
        success: true,
        message: 'Invoice generated successfully',
        data: {
          invoiceUrl: order?.invoice_url,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/b2b/orders/:id/mark-paid
 * Mark order as paid
 */
router.patch(
  '/orders/:id/mark-paid',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { changedBy } = req.body;

      await b2bOrderService.markAsPaid(id, changedBy);

      res.json({
        success: true,
        message: 'Order marked as paid',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/b2b/orders/:id/generate-tickets
 * Generate tickets for B2B order
 */
router.post(
  '/orders/:id/generate-tickets',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Generate tickets for all items in the order
      await b2bOrderService.generateTickets(id);

      res.json({
        success: true,
        message: 'Tickets generated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/b2b/orders/:id/send-tickets
 * Mark tickets as sent
 */
router.post(
  '/orders/:id/send-tickets',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { changedBy } = req.body;

      await b2bOrderService.markTicketsAsSent(id, changedBy);

      res.json({
        success: true,
        message: 'Tickets marked as sent',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/b2b/orders/:id/cancel
 * Cancel order
 */
router.patch('/orders/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason, changedBy } = req.body;

    if (!reason) {
      throw new AppError('Cancellation reason is required', 400);
    }

    await b2bOrderService.cancelOrder(id, reason, changedBy);

    res.json({
      success: true,
      message: 'Order cancelled',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/b2b/discount-tiers
 * Get all discount tiers
 */
router.get('/discount-tiers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tiers = b2bDiscountService.getDiscountTiers();

    res.json({
      success: true,
      data: {
        tiers,
        minimumQuantity: 50,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/b2b/orders/:orderNumber/download-tickets
 * Download all tickets as ZIP
 */
router.get('/orders/:orderNumber/download-tickets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;

    // Get order by order number
    const order = await b2bOrderService.getOrderByNumber(orderNumber);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Get all tickets
    const items = await b2bOrderService.getOrderItems(order.id);

    if (!items || items.length === 0) {
      throw new AppError('No tickets found for this order', 404);
    }

    // Import archiver for ZIP creation
    const archiver = require('archiver');
    const { supabase } = require('../services/supabase.js');

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 6 } }); // Lower compression for faster processing

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="tickets-${orderNumber}.zip"`);

    // Pipe archive to response
    archive.pipe(res);

    // Download and add each ticket PDF to the archive in parallel
    const downloadPromises = items.map(async (item: any, i: number) => {
      if (item.ticket_url) {
        try {
          // Extract file path from URL
          const url = new URL(item.ticket_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'tickets');
          const filePath = pathParts.slice(bucketIndex + 1).join('/');

          // Download PDF directly from Supabase Storage
          const { data, error } = await supabase.storage
            .from('tickets')
            .download(filePath);

          if (error) {
            console.error(`Failed to download ticket ${item.ticket_code}:`, error);
            return;
          }

          // Convert blob to buffer
          const arrayBuffer = await data.arrayBuffer();
          const pdfBuffer = Buffer.from(arrayBuffer);

          // Add to archive with numbered filename
          const filename = `ticket-${String(i + 1).padStart(3, '0')}-${item.ticket_code}.pdf`;
          archive.append(pdfBuffer, { name: filename });
        } catch (error) {
          console.error(`Failed to process ticket ${item.ticket_code}:`, error);
        }
      }
    });

    // Wait for all downloads to complete
    await Promise.all(downloadPromises);

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

export default router;
