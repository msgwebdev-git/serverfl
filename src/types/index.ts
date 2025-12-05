// Order status enum
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'expired';

// Payment status from MAIB
export type PaymentStatus = 'pending' | 'ok' | 'failed' | 'reversed';

// Order
export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  discount_amount: number;
  promo_code: string | null;
  maib_transaction_id: string | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
  reminder_sent_at: string | null;
  language: 'ro' | 'ru';
  is_invitation: boolean;
  created_at: string;
  updated_at: string;
}

// Create invitation request
export interface CreateInvitationRequest {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    ticketId: string;
    optionId?: string;
    quantity: number;
  }>;
  language: 'ro' | 'ru';
  note?: string;
}

// Order item (ticket in order)
export interface OrderItem {
  id: string;
  order_id: string;
  ticket_id: string;
  ticket_option_id: string | null;
  quantity: number;
  unit_price: number;
  ticket_code: string;
  qr_data: string;
  pdf_url: string | null;
  created_at: string;
}

// Promo code
export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

// Ticket (from existing schema)
export interface Ticket {
  id: string;
  name: string;
  name_ro: string;
  name_ru: string;
  description_ro: string | null;
  description_ru: string | null;
  features_ro: string[];
  features_ru: string[];
  price: number;
  original_price: number | null;
  currency: string;
  is_active: boolean;
  sort_order: number;
  max_per_order: number;
  has_options: boolean;
}

// Ticket option
export interface TicketOption {
  id: string;
  ticket_id: string;
  name: string;
  name_ro: string;
  name_ru: string;
  description_ro: string | null;
  description_ru: string | null;
  price_modifier: number;
  is_default: boolean;
  sort_order: number;
}

// API Request types
export interface CreateOrderRequest {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  items: Array<{
    ticketId: string;
    optionId?: string;
    quantity: number;
  }>;
  promoCode?: string;
  language: 'ro' | 'ru';
  clientIp: string;
}

export interface ValidatePromoRequest {
  code: string;
  totalAmount: number;
}

// MAIB response types
export interface MAIBTransactionResult {
  TRANSACTION_ID: string;
}

export interface MAIBStatusResult {
  RESULT: string;
  RESULT_CODE: string;
  '3DSECURE'?: string;
  RRN?: string;
  APPROVAL_CODE?: string;
  CARD_NUMBER?: string;
}
