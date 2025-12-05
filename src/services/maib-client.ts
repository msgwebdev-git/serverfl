import crypto from 'crypto';
import https from 'https';
import { config } from '../config/index.js';

interface PaymentRequest {
  amount: number;
  currency: string;
  clientIp: string;
  orderId?: string;
  description?: string;
  clientName?: string;
  email?: string;
  phone?: string;
  delivery?: number;
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
  }>;
  okUrl?: string;
  failUrl?: string;
  callbackUrl?: string;
  language?: string;
}

interface PaymentResponse {
  payUrl: string;
  payId: string;
  orderId?: string;
}

interface PaymentInfo {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  orderId: string;
  paymentDate?: string;
}

interface RefundResult {
  success: boolean;
  status?: string;
}

class MaibClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.maib.baseUrl;
  }

  /**
   * Generate access token
   */
  private async generateToken(): Promise<string> {
    console.log('MAIB Token Request:', {
      baseUrl: this.baseUrl,
      projectId: config.maib.projectId,
      hasProjectSecret: !!config.maib.projectSecret,
      timestamp: new Date().toISOString()
    });

    const postData = JSON.stringify({
      projectId: config.maib.projectId,
      projectSecret: config.maib.projectSecret,
    });

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/generate-token`);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            console.log('MAIB Token Response:', {
              status: res.statusCode,
              hasResult: !!result.result,
              hasAccessToken: !!(result.result?.accessToken || result.accessToken || result.token),
              resultKeys: Object.keys(result)
            });

            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Failed to generate token: ${res.statusCode} ${data}`));
              return;
            }

            const token = result.result?.accessToken || result.accessToken || result.token;
            if (!token) {
              reject(new Error('No access token in response'));
              return;
            }
            resolve(token);
          } catch (error) {
            reject(new Error(`Failed to parse token response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('MAIB Token Error:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Create payment
   */
  async createPayment(paymentData: PaymentRequest): Promise<PaymentResponse> {
    const token = await this.generateToken();

    const requestBody: Record<string, unknown> = {
      amount: paymentData.amount,
      currency: paymentData.currency,
      clientIp: paymentData.clientIp,
      language: paymentData.language || 'ro',
    };

    // Add optional parameters
    if (paymentData.orderId) requestBody.orderId = paymentData.orderId;
    if (paymentData.description) requestBody.description = paymentData.description;
    if (paymentData.clientName) requestBody.clientName = paymentData.clientName;
    if (paymentData.email) requestBody.email = paymentData.email;
    if (paymentData.phone) requestBody.phone = paymentData.phone;
    if (paymentData.delivery) requestBody.delivery = paymentData.delivery;
    if (paymentData.items) requestBody.items = paymentData.items;
    if (paymentData.okUrl) requestBody.okUrl = paymentData.okUrl;
    if (paymentData.failUrl) requestBody.failUrl = paymentData.failUrl;
    if (paymentData.callbackUrl) requestBody.callbackUrl = paymentData.callbackUrl;

    console.log('MAIB Payment Request:', {
      url: `${this.baseUrl}/pay`,
      hasToken: !!token,
      requestBody,
      timestamp: new Date().toISOString()
    });

    const postData = JSON.stringify(requestBody);

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/pay`);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(postData)
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              let errorMessage = res.statusMessage || 'Unknown error';
              try {
                const errorData = JSON.parse(data);
                if (errorData.errors && Array.isArray(errorData.errors)) {
                  errorMessage = errorData.errors.map((err: { errorCode?: string; errorMessage?: string }) =>
                    `${err.errorCode}: ${err.errorMessage}`
                  ).join(', ');
                } else {
                  errorMessage = errorData.message || data;
                }
              } catch {
                errorMessage = data || res.statusMessage || 'Unknown error';
              }

              console.error('MAIB Payment Error:', {
                status: res.statusCode,
                statusText: res.statusMessage,
                errorMessage,
                responseText: data,
                timestamp: new Date().toISOString()
              });

              reject(new Error(`Payment creation failed: ${res.statusCode} ${errorMessage}`));
              return;
            }

            const result = JSON.parse(data);
            console.log('MAIB Payment Response:', {
              hasResult: !!result.result,
              hasPayUrl: !!(result.result?.payUrl || result.payUrl),
              hasPayId: !!(result.result?.payId || result.payId),
              resultKeys: Object.keys(result)
            });

            const paymentResponse: PaymentResponse = {
              payUrl: result.result?.payUrl || result.payUrl,
              payId: result.result?.payId || result.payId,
              orderId: result.result?.orderId || result.orderId || paymentData.orderId
            };

            if (!paymentResponse.payUrl || !paymentResponse.payId) {
              reject(new Error('Invalid payment response: missing payUrl or payId'));
              return;
            }

            resolve(paymentResponse);
          } catch (error) {
            reject(new Error(`Failed to parse payment response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('MAIB Payment Request Error:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Get payment info
   */
  async getPaymentInfo(payId: string): Promise<PaymentInfo> {
    const token = await this.generateToken();

    const postData = JSON.stringify({ payId });

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/pay-info`);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(postData)
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Failed to get payment info: ${res.statusCode} ${data}`));
              return;
            }

            const result = JSON.parse(data);
            const info = result.result || result;

            resolve({
              transactionId: info.payId || info.transactionId,
              status: info.status,
              amount: info.amount,
              currency: info.currency,
              orderId: info.orderId,
              paymentDate: info.paymentDate,
            });
          } catch (error) {
            reject(new Error(`Failed to parse payment info response: ${error}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Refund payment
   */
  async refundPayment(payId: string, refundAmount?: number): Promise<RefundResult> {
    const token = await this.generateToken();

    const requestBody: Record<string, unknown> = { payId };
    if (refundAmount) {
      requestBody.refundAmount = refundAmount;
    }

    const postData = JSON.stringify(requestBody);

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/refund`);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(postData)
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              let errorMessage = res.statusMessage || 'Unknown error';
              try {
                const errorData = JSON.parse(data);
                if (errorData.errors && Array.isArray(errorData.errors)) {
                  errorMessage = errorData.errors.map((err: { errorCode?: string; errorMessage?: string }) =>
                    `${err.errorCode}: ${err.errorMessage}`
                  ).join(', ');
                }
              } catch { /* ignore */ }
              reject(new Error(`Refund failed: ${res.statusCode} ${errorMessage}`));
              return;
            }

            const result = JSON.parse(data);

            if (!result.ok) {
              let errorMessage = 'Unknown error';
              if (result.errors && Array.isArray(result.errors)) {
                errorMessage = result.errors.map((err: { errorCode?: string; errorMessage?: string }) =>
                  `${err.errorCode}: ${err.errorMessage}`
                ).join(', ');
              }
              reject(new Error(`Refund failed: ${errorMessage}`));
              return;
            }

            resolve({
              success: result.result?.status === 'OK',
              status: result.result?.status,
            });
          } catch (error) {
            reject(new Error(`Failed to parse refund response: ${error}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Verify callback signature
   */
  verifyCallback(data: Record<string, unknown>, signature: string): boolean {
    try {
      // MAIB sends data in 'result' object
      const resultData = (data.result || data) as Record<string, unknown>;

      // Sort keys alphabetically, excluding 'signature'
      const sortedKeys = Object.keys(resultData)
        .filter(key => key !== 'signature')
        .sort();

      // Create string from values separated by ':'
      const values = sortedKeys.map(key => String(resultData[key]));

      // Add signature key at the end
      values.push(config.maib.signatureKey);

      // Join all values with ':'
      const signString = values.join(':');

      // Generate SHA256 hash and convert to base64
      const expectedSignature = crypto
        .createHash('sha256')
        .update(signString)
        .digest('base64');

      console.log('MAIB Signature Verification:', {
        receivedSignature: signature,
        expectedSignature,
        match: signature === expectedSignature,
      });

      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying callback signature:', error);
      return false;
    }
  }
}

// Export singleton instance
export const maibClient = new MaibClient();
export type { PaymentRequest, PaymentResponse, PaymentInfo };
