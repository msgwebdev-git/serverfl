import { nanoid } from 'nanoid';
import { config } from '../config/index.js';
import { maibClient, PaymentResponse } from './maib-client.js';
import { AppError } from '../middleware/errorHandler.js';

interface CreateTransactionParams {
  orderId: string;
  amount: number;
  description: string;
  clientIp: string;
  language: 'ro' | 'ru';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
  }>;
}

interface TransactionResult {
  transactionId: string;
  payUrl: string;
}

interface TransactionStatus {
  success: boolean;
  status: string;
  resultCode?: string;
  cardNumber?: string;
}

// Mock storage for testing
const mockTransactions = new Map<string, { status: 'pending' | 'OK' | 'FAILED'; amount: number }>();

export const paymentService = {
  // Create payment transaction
  async createTransaction(params: CreateTransactionParams): Promise<TransactionResult> {
    // Mock mode for testing
    if (config.maib.mockMode) {
      const mockTransactionId = `MOCK_${nanoid(20)}`;
      mockTransactions.set(mockTransactionId, { status: 'pending', amount: params.amount });
      console.log(`[MOCK] Created transaction: ${mockTransactionId} for ${params.amount} MDL`);
      return {
        transactionId: mockTransactionId,
        payUrl: `${config.frontendUrl}/checkout/mock-payment?trans_id=${mockTransactionId}`,
      };
    }

    try {
      const apiUrl = config.apiUrl;
      const callbackUrl = `${apiUrl}/api/maib/callback`;
      const okUrl = `${apiUrl}/api/maib/return/ok`;
      const failUrl = `${apiUrl}/api/maib/return/fail`;

      const payment: PaymentResponse = await maibClient.createPayment({
        amount: params.amount,
        currency: config.maib.currency,
        clientIp: params.clientIp,
        orderId: params.orderId,
        description: params.description,
        clientName: params.customerName,
        email: params.customerEmail,
        phone: params.customerPhone,
        items: params.items,
        okUrl,
        failUrl,
        callbackUrl,
        language: params.language,
      });

      return {
        transactionId: payment.payId,
        payUrl: payment.payUrl,
      };
    } catch (error) {
      console.error('MAIB createTransaction error:', error);
      throw new AppError(
        error instanceof Error ? error.message : 'Payment gateway error',
        500
      );
    }
  },

  // Check transaction status
  async checkTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    // Mock mode for testing
    if (config.maib.mockMode) {
      const mockTx = mockTransactions.get(transactionId);
      if (mockTx) {
        console.log(`[MOCK] Transaction ${transactionId} status: ${mockTx.status}`);
        return {
          success: mockTx.status === 'OK',
          status: mockTx.status,
          cardNumber: '4***1234',
        };
      }
      return { success: false, status: 'NOT_FOUND' };
    }

    try {
      const info = await maibClient.getPaymentInfo(transactionId);

      const successStatuses = ['OK', 'COMPLETED', 'SUCCESS', 'APPROVED'];
      const success = successStatuses.includes(info.status?.toUpperCase() || '');

      return {
        success,
        status: info.status,
      };
    } catch (error) {
      console.error('MAIB getTransactionStatus error:', error);
      return {
        success: false,
        status: 'ERROR',
      };
    }
  },

  // Reverse (refund) transaction
  async reverseTransaction(transactionId: string, amount?: number): Promise<boolean> {
    // Mock mode for testing
    if (config.maib.mockMode) {
      console.log(`[MOCK] Reversed transaction: ${transactionId}`);
      return true;
    }

    try {
      const result = await maibClient.refundPayment(transactionId, amount);
      return result.success;
    } catch (error) {
      console.error('MAIB reverseTransaction error:', error);
      return false;
    }
  },

  // Verify callback signature
  verifyCallback(data: Record<string, unknown>, signature: string): boolean {
    if (config.maib.mockMode) {
      return true; // Skip verification in mock mode
    }
    return maibClient.verifyCallback(data, signature);
  },

  // Process callback and update mock transaction (for testing)
  processMockCallback(transactionId: string, status: 'OK' | 'FAILED' | 'PENDING'): boolean {
    if (!config.maib.mockMode) return false;

    const mockTx = mockTransactions.get(transactionId);
    if (mockTx) {
      mockTx.status = status === 'PENDING' ? 'pending' : status;
      console.log(`[MOCK] Updated transaction ${transactionId} to ${status}`);
      return true;
    }
    return false;
  },
};
