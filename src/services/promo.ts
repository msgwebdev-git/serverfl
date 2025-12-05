import { supabase } from './supabase.js';

interface PromoValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  code?: string;
  discountPercent?: number;
  discountAmount?: number;
  allowedTicketIds?: string[] | null;
}

interface ValidatePromoOptions {
  code: string;
  totalAmount: number;
  email?: string;
  ticketIds?: string[];
}

export const promoService = {
  async validatePromoCode(options: ValidatePromoOptions): Promise<PromoValidationResult> {
    const { code, totalAmount, email, ticketIds } = options;

    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !promo) {
      return { valid: false, error: 'Неверный промо-код', errorCode: 'INVALID_CODE' };
    }

    // Check validity dates
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return { valid: false, error: 'Промо-код ещё не активен', errorCode: 'NOT_YET_ACTIVE' };
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return { valid: false, error: 'Срок действия промо-кода истёк', errorCode: 'EXPIRED' };
    }

    // Check usage limit
    if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
      return { valid: false, error: 'Лимит использований промо-кода исчерпан', errorCode: 'USAGE_LIMIT' };
    }

    // Check minimum order amount
    if (promo.min_order_amount && totalAmount < promo.min_order_amount) {
      return {
        valid: false,
        error: `Минимальная сумма заказа для этого промо-кода: ${promo.min_order_amount} MDL`,
        errorCode: 'MIN_ORDER_AMOUNT',
      };
    }

    // Check ticket restrictions
    if (promo.allowed_ticket_ids && promo.allowed_ticket_ids.length > 0 && ticketIds) {
      const hasAllowedTicket = ticketIds.some((id) =>
        promo.allowed_ticket_ids.includes(id)
      );
      if (!hasAllowedTicket) {
        return {
          valid: false,
          error: 'Промо-код не применим к выбранным билетам',
          errorCode: 'TICKET_RESTRICTION',
        };
      }
    }

    // Check one per email restriction
    if (promo.one_per_email && email) {
      const { data: existingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('promo_code', promo.code)
        .eq('customer_email', email.toLowerCase())
        .in('status', ['paid', 'pending'])
        .limit(1);

      if (!ordersError && existingOrders && existingOrders.length > 0) {
        return {
          valid: false,
          error: 'Вы уже использовали этот промо-код',
          errorCode: 'ALREADY_USED_BY_EMAIL',
        };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discount_percent) {
      discountAmount = Math.round(totalAmount * promo.discount_percent / 100);
    } else if (promo.discount_amount) {
      discountAmount = Math.min(promo.discount_amount, totalAmount);
    }

    return {
      valid: true,
      code: promo.code,
      discountPercent: promo.discount_percent,
      discountAmount,
      allowedTicketIds: promo.allowed_ticket_ids,
    };
  },

  async incrementUsage(code: string): Promise<void> {
    const { data: promo } = await supabase
      .from('promo_codes')
      .select('used_count')
      .eq('code', code.toUpperCase())
      .single();

    if (promo) {
      await supabase
        .from('promo_codes')
        .update({ used_count: promo.used_count + 1 })
        .eq('code', code.toUpperCase());
    }
  },
};
