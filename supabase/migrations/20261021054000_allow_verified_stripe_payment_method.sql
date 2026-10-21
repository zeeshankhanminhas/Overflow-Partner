-- Bring the frozen Stripe deposit evidence into line with the underlying
-- payment confirmation constraint. Previously only bank_transfer/card/other
-- were accepted while the governed finalizer writes 'stripe'.
-- Isolated QA first; no change to any current production rows.
alter table public.quote_payment_confirmations
  drop constraint if exists quote_payment_confirmations_payment_method_check;

alter table public.quote_payment_confirmations
  add constraint quote_payment_confirmations_payment_method_check
  check (payment_method in ('bank_transfer','card','other','stripe'));

comment on constraint quote_payment_confirmations_payment_method_check
  on public.quote_payment_confirmations is
  'Stripe is a separately webhook-verified payment method. Card/other records never satisfy the controlled opening-payment project-creation gate.';
