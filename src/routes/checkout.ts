import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import archiver from 'archiver';
import { AppError } from '../middleware/errorHandler.js';
import { orderService } from '../services/order.js';
import { paymentService } from '../services/payment.js';
import { config } from '../config/index.js';


const router = Router();

// Validation schema
const createOrderSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(5),
  }),
  items: z.array(z.object({
    ticketId: z.string().uuid(),
    optionId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(10),
  })).min(1),
  promoCode: z.string().optional(),
  language: z.enum(['ro', 'ru']),
});

// Create order and initiate payment
router.post('/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(`Validation error: ${validation.error.message}`, 400);
    }

    const { customer, items, promoCode, language } = validation.data;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Create order in database
    const order = await orderService.createOrder({
      customer,
      items,
      promoCode,
      language,
      clientIp,
    });

    // Create MAIB transaction
    const transaction = await paymentService.createTransaction({
      orderId: order.id,
      amount: order.total_amount - order.discount_amount,
      description: `Order #${order.order_number}`,
      clientIp,
      language,
    });

    // Update order with transaction ID
    await orderService.updateTransactionId(order.id, transaction.transactionId);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        redirectUrl: transaction.payUrl,
        transactionId: transaction.transactionId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Payment callback from MAIB
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactionId = req.query.trans_id as string;

    if (!transactionId) {
      throw new AppError('Missing transaction ID', 400);
    }

    // Verify transaction status with MAIB
    const status = await paymentService.checkTransactionStatus(transactionId);

    // Find order by transaction ID
    const order = await orderService.getOrderByTransactionId(transactionId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (status.success) {
      // Payment successful
      await orderService.markAsPaid(order.id);

      // Generate tickets and send email (async, don't wait)
      orderService.processSuccessfulOrder(order.id).catch(console.error);

      // Redirect to success page
      res.redirect(`${config.frontendUrl}/checkout/success?order=${order.order_number}`);
    } else {
      // Payment failed
      const reason = status.resultCode || status.status || 'UNKNOWN';
      await orderService.markAsFailed(order.id, reason);

      // Redirect to failure page
      res.redirect(`${config.frontendUrl}/checkout/failed?order=${order.order_number}&reason=${reason}`);
    }
  } catch (error) {
    next(error);
  }
});

// Process mock payment (only in mock mode)
router.post('/mock-process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.maib.mockMode) {
      throw new AppError('Mock mode is disabled', 400);
    }

    const { transactionId, status } = req.body;

    if (!transactionId) {
      throw new AppError('Missing transaction ID', 400);
    }

    if (!['OK', 'FAILED', 'PENDING'].includes(status)) {
      throw new AppError('Invalid status. Must be OK, FAILED, or PENDING', 400);
    }

    // Update mock transaction status
    paymentService.processMockCallback(transactionId, status);

    // Find order by transaction ID
    const order = await orderService.getOrderByTransactionId(transactionId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (status === 'OK') {
      // Payment successful
      await orderService.markAsPaid(order.id);
      orderService.processSuccessfulOrder(order.id).catch(console.error);
      res.json({
        success: true,
        redirectUrl: `${config.frontendUrl}/checkout/success?order=${order.order_number}`,
      });
    } else if (status === 'FAILED') {
      // Payment failed
      await orderService.markAsFailed(order.id, 'MOCK_FAILED');
      res.json({
        success: true,
        redirectUrl: `${config.frontendUrl}/checkout/failed?order=${order.order_number}&reason=MOCK_FAILED`,
      });
    } else {
      // Pending - just return current state
      res.json({
        success: true,
        message: 'Payment left as pending',
        orderNumber: order.order_number,
      });
    }
  } catch (error) {
    next(error);
  }
});

// Check order status
router.get('/status/:orderNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;

    const order = await orderService.getOrderByNumber(orderNumber);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        totalAmount: order.total_amount,
        discountAmount: order.discount_amount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get tickets for order
router.get('/tickets/:orderNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;

    const tickets = await orderService.getOrderTickets(orderNumber);

    if (!tickets) {
      throw new AppError('Order not found', 404);
    }

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
});

// Download all tickets (single PDF or ZIP for multiple)
router.get('/tickets/:orderNumber/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;

    const ticketsData = await orderService.getOrderTickets(orderNumber);

    if (!ticketsData) {
      throw new AppError('Order not found', 404);
    }

    const ticketsWithPdf = ticketsData.tickets.filter(t => t.pdfUrl);

    if (ticketsWithPdf.length === 0) {
      throw new AppError('Tickets are not ready yet', 400);
    }

    // Single ticket - proxy PDF directly
    if (ticketsWithPdf.length === 1 && ticketsWithPdf[0].pdfUrl) {
      const ticket = ticketsWithPdf[0];
      const pdfResponse = await fetch(ticket.pdfUrl as string);

      if (!pdfResponse.ok) {
        throw new AppError('Failed to fetch ticket PDF', 500);
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="ticket-${ticket.ticketCode}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    // Multiple tickets - create ZIP
    // First, fetch all PDFs in parallel
    const pdfBuffers = await Promise.all(
      ticketsWithPdf.map(async (ticket) => {
        if (!ticket.pdfUrl) return null;
        try {
          const pdfResponse = await fetch(ticket.pdfUrl);
          if (pdfResponse.ok) {
            return {
              code: ticket.ticketCode,
              buffer: Buffer.from(await pdfResponse.arrayBuffer()),
            };
          }
        } catch (err) {
          console.error(`Failed to fetch PDF for ${ticket.ticketCode}:`, err);
        }
        return null;
      })
    );

    const validPdfs = pdfBuffers.filter((p) => p !== null) as { code: string; buffer: Buffer }[];

    if (validPdfs.length === 0) {
      throw new AppError('Failed to fetch ticket PDFs', 500);
    }

    // Create ZIP archive with lower compression for speed
    const archive = archiver('zip', { zlib: { level: 1 } });

    // Collect ZIP data to buffer first to set Content-Length
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    archive.on('error', (err) => {
      throw new AppError(`Archive error: ${err.message}`, 500);
    });

    // Add all PDFs to archive
    for (const pdf of validPdfs) {
      archive.append(pdf.buffer, { name: `ticket-${pdf.code}.pdf` });
    }

    await archive.finalize();

    const zipBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="tickets-${orderNumber}.zip"`);
    res.send(zipBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
