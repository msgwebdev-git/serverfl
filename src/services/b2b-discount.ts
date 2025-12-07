/**
 * B2B Discount Service
 * Progressive discount calculation for corporate packages
 *
 * Discount tiers:
 * - 50-99 tickets: 10%
 * - 100-149 tickets: 12%
 * - 150-199 tickets: 15%
 * - 200+ tickets: 20%
 */

export interface B2BDiscountTier {
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
  label: string;
}

export interface B2BDiscountCalculation {
  totalQuantity: number;
  discountPercent: number;
  discountTier: B2BDiscountTier;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

// Discount tiers configuration
const DISCOUNT_TIERS: B2BDiscountTier[] = [
  {
    minQuantity: 50,
    maxQuantity: 99,
    discountPercent: 10,
    label: '50-99 билетов',
  },
  {
    minQuantity: 100,
    maxQuantity: 149,
    discountPercent: 12,
    label: '100-149 билетов',
  },
  {
    minQuantity: 150,
    maxQuantity: 199,
    discountPercent: 15,
    label: '150-199 билетов',
  },
  {
    minQuantity: 200,
    maxQuantity: null,
    discountPercent: 20,
    label: '200+ билетов',
  },
];

// Minimum quantity required for B2B order
export const MIN_B2B_QUANTITY = 50;

export const b2bDiscountService = {
  /**
   * Get all discount tiers
   */
  getDiscountTiers(): B2BDiscountTier[] {
    return DISCOUNT_TIERS;
  },

  /**
   * Get discount tier for given quantity
   */
  getDiscountTier(totalQuantity: number): B2BDiscountTier | null {
    if (totalQuantity < MIN_B2B_QUANTITY) {
      return null;
    }

    for (const tier of DISCOUNT_TIERS) {
      if (
        totalQuantity >= tier.minQuantity &&
        (tier.maxQuantity === null || totalQuantity <= tier.maxQuantity)
      ) {
        return tier;
      }
    }

    return null;
  },

  /**
   * Calculate discount percent for given quantity
   */
  calculateDiscountPercent(totalQuantity: number): number {
    const tier = this.getDiscountTier(totalQuantity);
    return tier ? tier.discountPercent : 0;
  },

  /**
   * Calculate full discount details
   */
  calculateDiscount(totalAmount: number, totalQuantity: number): B2BDiscountCalculation {
    const tier = this.getDiscountTier(totalQuantity);
    const discountPercent = tier ? tier.discountPercent : 0;
    const discountAmount = Math.round((totalAmount * discountPercent) / 100 * 100) / 100;
    const finalAmount = totalAmount - discountAmount;

    return {
      totalQuantity,
      discountPercent,
      discountTier: tier || {
        minQuantity: 0,
        maxQuantity: MIN_B2B_QUANTITY - 1,
        discountPercent: 0,
        label: `Минимум ${MIN_B2B_QUANTITY} билетов`,
      },
      totalAmount,
      discountAmount,
      finalAmount,
    };
  },

  /**
   * Validate if quantity meets B2B minimum
   */
  validateMinimumQuantity(totalQuantity: number): boolean {
    return totalQuantity >= MIN_B2B_QUANTITY;
  },

  /**
   * Get next discount tier (for upselling)
   */
  getNextTier(totalQuantity: number): B2BDiscountTier | null {
    const currentTier = this.getDiscountTier(totalQuantity);

    if (!currentTier) {
      // If below minimum, return first tier
      return DISCOUNT_TIERS[0];
    }

    // Find next tier
    const currentIndex = DISCOUNT_TIERS.findIndex(
      t => t.minQuantity === currentTier.minQuantity
    );

    if (currentIndex >= 0 && currentIndex < DISCOUNT_TIERS.length - 1) {
      return DISCOUNT_TIERS[currentIndex + 1];
    }

    // Already at highest tier
    return null;
  },

  /**
   * Calculate how many more tickets needed for next tier
   */
  getTicketsToNextTier(totalQuantity: number): number | null {
    const nextTier = this.getNextTier(totalQuantity);

    if (!nextTier) {
      return null;
    }

    return Math.max(0, nextTier.minQuantity - totalQuantity);
  },

  /**
   * Get discount summary for display
   */
  getDiscountSummary(totalAmount: number, totalQuantity: number): {
    isValid: boolean;
    message: string;
    discount: B2BDiscountCalculation | null;
    nextTier: {
      tier: B2BDiscountTier;
      ticketsNeeded: number;
      additionalDiscount: number;
    } | null;
  } {
    const isValid = this.validateMinimumQuantity(totalQuantity);

    if (!isValid) {
      return {
        isValid: false,
        message: `Минимальное количество для корпоративного заказа: ${MIN_B2B_QUANTITY} билетов`,
        discount: null,
        nextTier: null,
      };
    }

    const discount = this.calculateDiscount(totalAmount, totalQuantity);
    const nextTier = this.getNextTier(totalQuantity);
    const ticketsToNext = this.getTicketsToNextTier(totalQuantity);

    return {
      isValid: true,
      message: `Скидка ${discount.discountPercent}% применена`,
      discount,
      nextTier: nextTier && ticketsToNext !== null ? {
        tier: nextTier,
        ticketsNeeded: ticketsToNext,
        additionalDiscount: nextTier.discountPercent - discount.discountPercent,
      } : null,
    };
  },
};
