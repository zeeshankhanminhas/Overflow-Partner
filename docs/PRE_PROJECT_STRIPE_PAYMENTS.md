# Pre-project Stripe payments

## Intended workflow

1. The client accepts the current issued quote through its secure link.
2. The client portal offers secure checkout for a quote that requires an advance payment. Explicit no-advance terms do not show the payment control.
3. Checkout uses the full quote total and currency. The Checkout return URL is informational only.
4. Stripe sends a signed webhook. OP verifies the signature, quote revision, amount, currency, mode, accepted state and payment session before recording provider proof.
5. A workspace operator reviews the verified payment proof and releases Project 360. The database rejects card release without a matching Stripe payment.
6. Failed, cancelled, expired and incomplete payments do not create a project. Repeated webhooks are idempotent.

## Configuration

Configure server-only STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the deployment environment. Start with Stripe test mode (sk_test_...). STRIPE_LIVE_PAYMENTS_ENABLED must remain false during testing.

Register this webhook destination in Stripe:

https://overflow-partner.vercel.app/api/stripe/webhook

Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and checkout.session.expired.

Copy the webhook signing secret (whsec_...) into STRIPE_WEBHOOK_SECRET. Never put either Stripe secret in a NEXT_PUBLIC_ variable or source control.

## Database and release

Apply the new Supabase migration before deploying code. Do not record a payment manually as a substitute for the Stripe webhook test. For the accepted QA quote, test a failed/cancelled checkout first, then a successful test checkout. Confirm no Project 360 exists before payment, inspect the verified payment in the Case, and create the project only through the governed release action. Also verify a duplicate webhook does not create duplicate payment evidence or projects.

The no-advance route remains separate: it is released against the issued quote terms without checkout. This integration has not been connected to a Stripe account or tested against Stripe because credentials and webhook signing secret are not yet configured.
