import * as React from 'react';
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'react-email';

export type EmailFact = { label: string; value: string };

export type LifecycleEmailProps = {
  recipient: string;
  heading: string;
  message: string;
  preheader?: string;
  actionLabel: string;
  actionUrl: string;
  facts?: EmailFact[];
  unsubscribeUrl?: string;
  note?: string;
};

type FamilyConfig = {
  eyebrow: string;
  accent: string;
  panelBackground: string;
  actionBackground: string;
  footer: string;
};

const palette = {
  ink: '#171717',
  muted: '#6f6a61',
  canvas: '#f3f1ec',
  paper: '#ffffff',
  line: '#ded9d0',
  soft: '#f8f6f2',
  orange: '#e95d2a',
  amber: '#9a6516',
  amberSoft: '#fff8e8',
  green: '#2f6a4f',
  greenSoft: '#eef7f1',
  red: '#9b3a31',
  redSoft: '#fff2f0',
};

const base: FamilyConfig = {
  eyebrow: 'Overflow Partner',
  accent: palette.orange,
  panelBackground: palette.soft,
  actionBackground: palette.ink,
  footer: 'Engineering capacity, delivered with control.',
};

const familyConfig = {
  acknowledgement: { ...base, eyebrow: 'Overflow Partner · Update' },
  nurture: { ...base, eyebrow: 'Overflow Partner · Engineering capacity' },
  secure_action: { ...base, eyebrow: 'Overflow Partner · Secure action', panelBackground: '#f5f6f7' },
  reminder: { ...base, eyebrow: 'Overflow Partner · Reminder', accent: palette.amber, panelBackground: palette.amberSoft },
  partner_review: { ...base, eyebrow: 'Overflow Partner · Delivery review', panelBackground: '#f4f5f6' },
  quote: { ...base, eyebrow: 'Overflow Partner · Commercial', panelBackground: '#f5f4f1' },
  payment: { ...base, eyebrow: 'Overflow Partner · Payment', accent: palette.green, panelBackground: palette.greenSoft },
  partner_work: { ...base, eyebrow: 'Overflow Partner · Partner work', panelBackground: '#f3f5f5' },
  action_required: { ...base, eyebrow: 'Overflow Partner · Action required', accent: palette.red, panelBackground: palette.redSoft },
  delivery_review: { ...base, eyebrow: 'Overflow Partner · Delivery', panelBackground: '#f4f5f4' },
  completion: { ...base, eyebrow: 'Overflow Partner · Complete', accent: palette.green, panelBackground: palette.greenSoft },
  internal_alert: { ...base, eyebrow: 'Overflow Partner · Internal', accent: palette.red, panelBackground: palette.redSoft },
} satisfies Record<string, FamilyConfig>;

function FactGrid({ facts }: { facts: EmailFact[] }) {
  if (!facts.length) return null;
  return (
    <Section style={{ marginTop: '24px', border: `1px solid ${palette.line}`, backgroundColor: palette.soft }}>
      {facts.map((fact, index) => (
        <React.Fragment key={`${fact.label}-${index}`}>
          <Row style={{ padding: '0 18px' }}>
            <Column style={{ width: '38%', verticalAlign: 'top', padding: '11px 10px 11px 0' }}>
              <Text style={{ margin: 0, color: palette.muted, fontSize: '12px', lineHeight: '18px' }}>{fact.label}</Text>
            </Column>
            <Column style={{ verticalAlign: 'top', padding: '11px 0' }}>
              <Text style={{ margin: 0, color: palette.ink, fontSize: '13px', lineHeight: '18px', fontWeight: 600 }}>{fact.value}</Text>
            </Column>
          </Row>
          {index < facts.length - 1 ? <Hr style={{ margin: 0, borderColor: palette.line }} /> : null}
        </React.Fragment>
      ))}
    </Section>
  );
}

function LifecycleEmailShell({ config, props }: { config: FamilyConfig; props: LifecycleEmailProps }) {
  const facts = props.facts?.filter((fact) => fact.value) ?? [];
  return (
    <Html lang="en">
      <Head />
      <Preview>{props.preheader || props.heading}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: palette.canvas, color: palette.ink, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 12px' }}>
          <Section style={{ backgroundColor: palette.paper, border: `1px solid ${palette.line}`, borderTop: `5px solid ${config.accent}` }}>
            <Section style={{ padding: '26px 32px 18px' }}>
              <Text style={{ margin: 0, color: palette.muted, fontSize: '11px', lineHeight: '16px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>{config.eyebrow}</Text>
              <Text style={{ margin: '6px 0 0', color: palette.muted, fontSize: '13px', lineHeight: '20px' }}>{config.footer}</Text>
            </Section>
            <Hr style={{ margin: 0, borderColor: palette.line }} />
            <Section style={{ padding: '26px 32px 10px' }}>
              <Text style={{ margin: '0 0 18px', fontSize: '15px', lineHeight: '24px' }}>Hello {props.recipient},</Text>
              <Heading as="h1" style={{ margin: '0 0 16px', fontSize: '28px', lineHeight: '34px', fontWeight: 600, letterSpacing: '-0.02em' }}>{props.heading}</Heading>
              <Text style={{ margin: 0, color: '#45413b', fontSize: '15px', lineHeight: '25px', whiteSpace: 'pre-line' }}>{props.message}</Text>
              <FactGrid facts={facts} />
              {props.note ? (
                <Section style={{ marginTop: '18px', padding: '14px 16px', backgroundColor: config.panelBackground, borderLeft: `3px solid ${config.accent}` }}>
                  <Text style={{ margin: 0, color: '#4d4942', fontSize: '13px', lineHeight: '21px' }}>{props.note}</Text>
                </Section>
              ) : null}
            </Section>
            <Section style={{ padding: '22px 32px 34px' }}>
              <Button href={props.actionUrl} style={{ backgroundColor: config.actionBackground, color: '#ffffff', textDecoration: 'none', padding: '13px 20px', fontSize: '14px', lineHeight: '18px', fontWeight: 700 }}>{props.actionLabel}</Button>
              <Text style={{ margin: '16px 0 0', color: palette.muted, fontSize: '12px', lineHeight: '19px' }}>If the button does not open, copy this link into your browser:</Text>
              <Link href={props.actionUrl} style={{ color: palette.ink, fontSize: '12px', lineHeight: '19px', wordBreak: 'break-all' }}>{props.actionUrl}</Link>
            </Section>
            <Hr style={{ margin: 0, borderColor: palette.line }} />
            <Section style={{ padding: '18px 32px 24px' }}>
              <Text style={{ margin: 0, color: '#777168', fontSize: '11px', lineHeight: '18px' }}>This message relates to an active Overflow Partner workflow. Replies go to the operating team.</Text>
              {props.unsubscribeUrl ? <Text style={{ margin: '8px 0 0', fontSize: '11px', lineHeight: '18px' }}><Link href={props.unsubscribeUrl} style={{ color: '#777168' }}>Unsubscribe from nurture emails</Link></Text> : null}
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function family(config: FamilyConfig) {
  return function FamilyEmail(props: LifecycleEmailProps) {
    return <LifecycleEmailShell config={config} props={props} />;
  };
}

export const AcknowledgementEmail = family(familyConfig.acknowledgement);
export const NurtureEmail = family(familyConfig.nurture);
export const SecureActionEmail = family(familyConfig.secure_action);
export const ReminderEmail = family(familyConfig.reminder);
export const PartnerReviewEmail = family(familyConfig.partner_review);
export const QuoteEmail = family(familyConfig.quote);
export const PaymentEmail = family(familyConfig.payment);
export const PartnerWorkEmail = family(familyConfig.partner_work);
export const ActionRequiredEmail = family(familyConfig.action_required);
export const DeliveryReviewEmail = family(familyConfig.delivery_review);
export const CompletionEmail = family(familyConfig.completion);
export const InternalAlertEmail = family(familyConfig.internal_alert);

export const lifecycleEmailComponents = {
  acknowledgement: AcknowledgementEmail,
  nurture: NurtureEmail,
  secure_action: SecureActionEmail,
  reminder: ReminderEmail,
  partner_review: PartnerReviewEmail,
  quote: QuoteEmail,
  payment: PaymentEmail,
  partner_work: PartnerWorkEmail,
  action_required: ActionRequiredEmail,
  delivery_review: DeliveryReviewEmail,
  completion: CompletionEmail,
  internal_alert: InternalAlertEmail,
} as const;
