import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder_not_configured', {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
  typescript: true,
});

// Plan configuration
export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    monthlyCredits: 10,
    retentionDays: 1,
    features: ['10 images/month', 'AI car detection', 'Basic sorting'],
    stripePriceId: null,
  },
  STARTER: {
    name: 'Starter',
    price: 29,
    monthlyCredits: 500,
    retentionDays: 7,
    features: ['500 images/month', 'AI car detection', '13 color categories', 'ZIP download', 'Quick reassign', '7-day file storage'],
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
  },
  PRO: {
    name: 'Pro',
    price: 79,
    monthlyCredits: 5000,
    retentionDays: 30,
    features: ['5,000 images/month', 'Everything in Starter', 'Watermark editor', 'Priority processing', 'Email support', '30-day file storage'],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 199,
    monthlyCredits: -1, // unlimited
    retentionDays: 90,
    features: ['Unlimited images', 'Everything in Pro', 'API access', 'Custom categories', 'Dedicated support', 'SLA guarantee', '90-day file storage'],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanCredits(plan: PlanKey): number {
  return PLANS[plan].monthlyCredits;
}
