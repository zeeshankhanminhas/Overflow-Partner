import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/payments/stripeSignature';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const payload = await request.text();
  if (payload.length > 1_000_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  if (!verifyStripeSignature(payload, signature, webhookSecret)) return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });

  try {
    const event = JSON.parse(payload);
    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) return NextResponse.json({ received: true });
    const session = event.data?.object;
    if (!session?.id || !session.metadata?.op_quote_payment_request_id) return NextResponse.json({ error: 'Payment session metadata is incomplete.' }, { status: 400 });
    const db = createAdminClient();
    const { data: paymentRequest, error: requestError } = await db.from('quote_payment_requests')
      .select('id,status,stripe_session_id,stripe_livemode').eq('id', session.metadata.op_quote_payment_request_id).maybeSingle();
    if (requestError || !paymentRequest || paymentRequest.stripe_session_id !== session.id || paymentRequest.stripe_livemode !== Boolean(event.livemode)) {
      return NextResponse.json({ error: 'Payment session does not match the recorded request.' }, { status: 400 });
    }
    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      if (paymentRequest.status !== 'paid') await db.from('quote_payment_requests').update({ status: event.type.endsWith('.expired') ? 'expired' : 'failed', updated_at: new Date().toISOString() }).eq('id', paymentRequest.id);
      return NextResponse.json({ received: true });
    }
    // For delayed payment methods, Checkout completion is not proof until Stripe
    // reports payment_status=paid or sends async_payment_succeeded.
    if (session.payment_status !== 'paid') return NextResponse.json({ received: true });
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntent || !Number.isInteger(session.amount_total) || !session.currency) return NextResponse.json({ error: 'Paid session is missing verified payment details.' }, { status: 400 });
    const { error: confirmationError } = await db.rpc('op_record_stripe_quote_payment', {
      p_provider_event_id: event.id, p_event_type: event.type, p_request_id: paymentRequest.id,
      p_checkout_session_id: session.id, p_payment_intent_id: paymentIntent,
      p_amount_total: session.amount_total, p_currency: session.currency,
      p_livemode: Boolean(event.livemode), p_paid_at: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    });
    if (confirmationError) return NextResponse.json({ error: 'Payment could not be reconciled with the quote.' }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
