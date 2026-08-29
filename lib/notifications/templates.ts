type NotificationRow = {
  event_key: string;
  category: string;
  recipient_name: string | null;
  subject: string;
  template_key: string;
  payload: Record<string, unknown>;
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const lifecycleFamilies = new Set([
  'acknowledgement','nurture','secure_action','reminder','partner_review','quote','payment',
  'partner_work','action_required','delivery_review','completion','internal_alert',
]);

function copy(template: string, payload: Record<string, unknown>) {
  if (lifecycleFamilies.has(template)) {
    return {
      heading: escapeHtml(payload.heading || 'Overflow Partner update'),
      body: escapeHtml(payload.message || 'There is an update in your Overflow Partner workflow.'),
      action: escapeHtml(payload.actionLabel || 'Open workspace'),
    };
  }

  // Backwards-compatible rendering for notifications queued before the lifecycle-family refactor.
  const company = escapeHtml(payload.company || 'your team');
  const reference = escapeHtml(payload.reference || payload.caseReference || payload.projectReference || '');
  const due = escapeHtml(payload.dueDate || payload.validUntil || '');
  const amount = escapeHtml(payload.amount || payload.total || payload.balance || '');
  const variants: Record<string, { heading: string; body: string; action: string }> = {
    enquiry_acknowledgement: { heading:'Thank you for contacting Overflow Partner', body:`We have received your enquiry${company ? ` for ${company}` : ''}. We will review the requirement and confirm the next appropriate step.`, action:'View enquiry' },
    technical_intake_invitation: { heading:'A few technical details will help us assess the requirement', body:'Please complete the secure technical intake so we can understand the scope, deliverables, files and timing before progressing.', action:'Complete technical intake' },
    technical_intake_reminder: { heading:'A polite reminder about your technical intake', body:`We are ready to review the requirement${reference ? ` under ${reference}` : ''}. The secure intake remains available whenever convenient${due ? ` and is due ${due}` : ''}.`, action:'Continue technical intake' },
    partner_review_request: { heading:'A controlled engineering review is ready', body:`Please review the technical package${reference ? ` for ${reference}` : ''} and submit feasibility, assumptions, risks, lead time and pricing through the secure review workspace.`, action:'Open partner review' },
    partner_review_requested: { heading:'A controlled engineering review is ready', body:`Please review the technical package${reference ? ` for ${reference}` : ''} and submit feasibility, assumptions, risks, lead time and pricing through the secure review workspace.`, action:'Open partner review' },
    partner_review_reminder: { heading:'A polite reminder about the engineering review', body:`The controlled review remains open${due ? ` and is due ${due}` : ''}. Please submit the response through the secure workspace so the evidence remains linked to the opportunity.`, action:'Continue review' },
    quote_issued: { heading:'Your controlled quotation is available', body:`The quotation${reference ? ` ${reference}` : ''} has been approved and issued for your review${due ? `. It remains valid until ${due}` : ''}.`, action:'Review quotation' },
    quote_reminder: { heading:'A polite follow-up on your quotation', body:`We wanted to check that you have everything needed to review the quotation${reference ? ` ${reference}` : ''}${due ? `. Its current validity date is ${due}` : ''}.`, action:'Review quotation' },
    invoice_issued: { heading:'Your Overflow Partner invoice is available', body:`Invoice${reference ? ` ${reference}` : ''}${amount ? ` for ${amount}` : ''} has been issued${due ? ` and is due ${due}` : ''}. The secure invoice link below shows the current balance and payment status.`, action:'View invoice' },
    invoice_due_reminder: { heading:'A polite reminder about your invoice', body:`Invoice${reference ? ` ${reference}` : ''}${amount ? ` has an outstanding balance of ${amount}` : ' remains outstanding'}${due ? ` with a due date of ${due}` : ''}. If payment is already in progress, no action is needed.`, action:'View invoice' },
    invoice_overdue_reminder: { heading:'Invoice payment is now overdue', body:`Our records show that invoice${reference ? ` ${reference}` : ''}${amount ? ` has an outstanding balance of ${amount}` : ' remains outstanding'}${due ? ` after its ${due} due date` : ''}. Please contact us if there is a query or payment has already been arranged.`, action:'View invoice' },
    payment_received: { heading:'Payment received — thank you', body:`We have recorded your payment${amount ? ` of ${amount}` : ''}${reference ? ` against invoice ${reference}` : ''}. The secure invoice view has been updated to show the remaining balance, if any.`, action:'View updated invoice' },
    document_issued: { heading:'A controlled document has been issued', body:`A new controlled document${reference ? `, ${reference},` : ''} is available for review and download.`, action:'Open document' },
    client_review_reminder: { heading:'A polite reminder about the issued deliverable', body:`The controlled deliverable${reference ? ` ${reference}` : ''} is awaiting your review${due ? ` by ${due}` : ''}.`, action:'Review deliverable' },
    nurture_capacity: { heading:'A practical way to extend engineering capacity', body:'Overflow Partner provides controlled overflow support when internal teams are busy, without replacing the client’s engineering ownership or controls.', action:'Discuss a requirement' },
    nurture_intake: { heading:'What helps us assess an overflow requirement', body:'A useful first assessment normally needs the intended deliverables, source files, discipline, timescale, standards, review expectations and any known constraints.', action:'Share a requirement' },
    nurture_process: { heading:'From enquiry to controlled delivery', body:'Each requirement moves through requirements capture, delivery review, commercial review, controlled quotation, payment, project delivery, internal review and controlled issue.', action:'See how it works' },
    nurture_checkin: { heading:'Planning for upcoming engineering capacity', body:'Should an upcoming project create a temporary CAD, CAM or engineering-documentation bottleneck, the requirement can be assessed before the pressure becomes urgent.', action:'Start a conversation' },
    nurture_final: { heading:'A final check-in from Overflow Partner', body:'We will leave things here for now. When overflow capacity is useful, you can return to the enquiry at any time or reply directly to this message.', action:'Return to your enquiry' },
    system_failure: { heading:'Overflow Partner notification requires attention', body:escapeHtml(payload.message || 'A notification could not be delivered after repeated attempts.'), action:'Open workspace' },
  };
  return variants[template] || { heading:escapeHtml(payload.heading || 'Overflow Partner update'), body:escapeHtml(payload.message || 'There is an update in your Overflow Partner workflow.'), action:escapeHtml(payload.actionLabel || 'Open workspace') };
}

export function renderNotificationEmail(row: NotificationRow) {
  const payload = row.payload || {};
  const content = copy(row.template_key, payload);
  const actionUrl = escapeHtml(payload.actionUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app');
  const recipient = escapeHtml(row.recipient_name || payload.name || 'there');
  const unsubscribeUrl = row.category === 'nurture' ? escapeHtml(payload.unsubscribeUrl || '') : '';
  const preheader = escapeHtml(payload.preheader || content.heading);
  const reference = escapeHtml(payload.reference || payload.projectReference || payload.opportunityReference || '');
  const due = escapeHtml(payload.dueDate || payload.validUntil || '');
  const amount = escapeHtml(payload.amount || '');
  const context = [reference && `Reference: ${reference}`, due && `Date: ${due}`, amount && `Amount: ${amount}`].filter(Boolean);

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f3f1ec;color:#171717;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f1ec;padding:32px 12px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #d9d5cc">
        <tr><td style="padding:28px 32px 18px;border-top:5px solid #e95d2a">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#6f6a61">Overflow Partner</div>
          <div style="margin-top:6px;font-size:13px;color:#6f6a61">Engineering capacity, delivered with control</div>
        </td></tr>
        <tr><td style="padding:24px 32px 10px">
          <p style="margin:0 0 18px;font-size:16px">Hello ${recipient},</p>
          <h1 style="margin:0 0 18px;font-size:29px;line-height:1.15;font-weight:600">${content.heading}</h1>
          <p style="margin:0;font-size:16px;line-height:1.7;color:#45413b">${content.body}</p>
          ${context.length ? `<div style="margin-top:22px;padding:16px 18px;background:#f7f5f1;border:1px solid #e7e3dc;font-size:13px;line-height:1.8;color:#5d5850">${context.join('<br>')}</div>` : ''}
        </td></tr>
        <tr><td style="padding:24px 32px 34px">
          <a href="${actionUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:13px 20px;font-size:14px;font-weight:600">${content.action}</a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e7e3dc;font-size:12px;line-height:1.6;color:#777168">
          This message was generated from an active Overflow Partner workflow. Replies go to the operating team.
          ${unsubscribeUrl ? `<br><a href="${unsubscribeUrl}" style="color:#777168">Unsubscribe from nurture emails</a>` : ''}
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const textContext = context.length ? `\n\n${context.map((item)=>String(item).replace(/<[^>]+>/g,'')).join('\n')}` : '';
  const text = `Hello ${row.recipient_name || payload.name || 'there'},\n\n${content.heading}\n\n${content.body}${textContext}\n\n${content.action}: ${String(payload.actionUrl || process.env.NEXT_PUBLIC_APP_URL || '')}${unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : ''}`;
  return { html, text };
}
