# Overflow Partner public website security: QA-to-production release checklist

This change must remain in a separate branch until backend dependencies are verified.

## New required environment variables

- NEXT_PUBLIC_TURNSTILE_SITE_KEY — public site key for the correct website/preview domain.
- TURNSTILE_SECRET_KEY — corresponding private Cloudflare Turnstile secret.
- PUBLIC_INTAKE_HASH_SECRET — random secret (32+ characters) used to HMAC IP and email quota keys.

Configure separate QA and production credentials. Never commit real keys. Ensure Cloudflare allows the Vercel preview hostname where testing occurs.

## Database and email prerequisites

1. Verify the selected Supabase project is the isolated QA project before making changes.
2. Apply supabase/migrations/20261108110000_public_intake_security.sql to isolated QA.
3. Verify tables, RLS restrictions and service-role RPC permissions.
4. Verify the existing notification outbox can deliver the secure_action template and the provided confirmation link.
5. Test a valid verification click creates a normal prospect and a single technical intake session. GET link previews must never create prospects.
6. Only after QA: review and apply the migration to production and provision production keys.

## Fail-closed behavior

If mandatory keys are absent, the form remains disabled and the API returns 503. This prevents an insecure fallback. **Do not merge into production until configured.**

Before verification, a submission may create only an expiring pending record and one rate-limited confirmation email. No company/contact/prospect record, Step 2 invitation or reminders are issued.

After verification, the existing OPOS intake creation/technical invitation path is used; no reminders are automatically scheduled. Payment, project creation, approvals, IP, confidentiality and final-handover gates remain untouched.

## Manual QA

- Test invalid/missing Turnstile token, hidden honeypot, malformed request, excessive payload, expired token and repeat verification.
- Test two same-email attempts per 24 hours and twelve per-IP attempts per hour (atomic database quotas); verify concurrency behavior.
- Verify no records/emails are sent when CAPTCHA fails; verify no reminders for unverified addresses.
- Verify finalisation retry after a recoverable error and that duplicate active enquiries do not create duplicate prospects.
- Verify notifications are idempotent and correct for the selected QA organization.
- Verify consent rejection means no analytics, consent acceptance loads both optional analytics components, and preference reopening works.
- Verify login malicious ?error values do not render; check pending button and error states.
- Test form focus, exact six services, mobile menu keyboard behavior, and tablet/mobile viewport overflow.
- Review CSP/frame headers, OG/Twitter card, sitemap, privacy language, and metadata.

## Legal information still required

The repository does not establish a verified UK legal controller name, business/service address or public privacy contact email. Collect these details and update policy before commercial launch. Do not claim incorporation until independently verified.

## Release conditions

Run the full `npm run build`, verify Vercel preview, execute real isolated-QA email+database tests, and confirm required keys exist in the target environment. Only then promote the change via reviewed PR.
