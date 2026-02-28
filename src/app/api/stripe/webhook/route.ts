import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, PLANS } from '@/lib/stripe';
import { syncPlanCredits } from '@/lib/credits';
import type { PlanKey } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import type Stripe from 'stripe';
import { sendSubscriptionEmail, sendPaymentFailedEmail } from '@/lib/email';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as PlanKey;
        if (!userId || !plan) break;

        const subscriptionId = session.subscription as string;
        const stripeSubResponse = await stripe.subscriptions.retrieve(subscriptionId);
        const stripeSub = stripeSubResponse as unknown as { items: { data: Array<{ price: { id: string } }> }; current_period_start: number; current_period_end: number };
        const priceId = stripeSub.items?.data?.[0]?.price?.id || null;
        const periodStart = stripeSub.current_period_start;
        const periodEnd = stripeSub.current_period_end;

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            plan: plan as 'STARTER' | 'PRO' | 'ENTERPRISE',
            status: 'ACTIVE',
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: session.customer as string,
            stripePriceId: priceId,
            currentPeriodStart: new Date(periodStart * 1000),
            currentPeriodEnd: new Date(periodEnd * 1000),
          },
          create: {
            userId,
            plan: plan as 'STARTER' | 'PRO' | 'ENTERPRISE',
            status: 'ACTIVE',
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: session.customer as string,
            stripePriceId: priceId,
            currentPeriodStart: new Date(periodStart * 1000),
            currentPeriodEnd: new Date(periodEnd * 1000),
          },
        });

        await syncPlanCredits(userId, plan);

        // Send subscription confirmation email
        try {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user?.email) {
            const planConfig = PLANS[plan];
            await sendSubscriptionEmail(
              user.email,
              user.name || '',
              planConfig.name,
              planConfig.price,
              new Date(periodEnd * 1000)
            );
          }
        } catch (emailErr) {
          console.error('Failed to send subscription email:', emailErr);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as unknown as Stripe.Subscription & { current_period_start: number; current_period_end: number };
        const subId = sub.id;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subId },
        });
        if (!dbSub) break;

        const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID'> = {
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELED',
          unpaid: 'UNPAID',
        };

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subId },
          data: {
            status: statusMap[sub.status] || 'ACTIVE',
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        const deletedSubId = deletedSub.id;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: deletedSubId },
        });
        if (!dbSub) break;

        await prisma.subscription.update({
          where: { stripeSubscriptionId: deletedSubId },
          data: {
            plan: 'FREE',
            status: 'CANCELED',
            stripeSubscriptionId: null,
            stripePriceId: null,
          },
        });

        await syncPlanCredits(dbSub.userId, 'FREE');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const dbSub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!dbSub) break;

        // Mark subscription as past due
        await prisma.subscription.update({
          where: { userId: dbSub.userId },
          data: { status: 'PAST_DUE' },
        });

        // Send payment failed email
        try {
          const user = await prisma.user.findUnique({ where: { id: dbSub.userId } });
          if (user?.email) {
            await sendPaymentFailedEmail(user.email, user.name || '', dbSub.plan);
          }
        } catch (emailErr) {
          console.error('Failed to send payment failed email:', emailErr);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
