import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { promoService } from '../services/promo.js';

const router = Router();

const validateSchema = z.object({
  code: z.string().min(1),
  totalAmount: z.number().positive(),
  email: z.string().email().optional(),
  ticketIds: z.array(z.string().uuid()).optional(),
});

// Validate promo code
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = validateSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid request', 400);
    }

    const { code, totalAmount, email, ticketIds } = validation.data;

    const result = await promoService.validatePromoCode({
      code,
      totalAmount,
      email,
      ticketIds,
    });

    if (!result.valid) {
      res.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        code: result.code,
        discountPercent: result.discountPercent,
        discountAmount: result.discountAmount,
        allowedTicketIds: result.allowedTicketIds,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
