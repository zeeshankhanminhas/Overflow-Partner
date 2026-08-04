export type TransactionalEmail = {
  subject: string;
  html: string;
  text: string;
};

export type Step2EmailInput = {
  recipientName: string;
  companyName: string;
  projectType: string;
  intakeUrl: string;
  expiresAt: string;
};

export type DeliveryResult = {
  status: 'sent' | 'failed' | 'not_configured';
  messageId: string | null;
  error: string | null;
};
