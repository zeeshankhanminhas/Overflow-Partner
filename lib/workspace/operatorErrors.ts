export type OperatorError = {
  title: string;
  message: string;
  code?: string;
};

export function toOperatorError(error: unknown): OperatorError {
  const raw = String(error ?? '').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('documents_reference_key') || (lower.includes('duplicate key') && lower.includes('document'))) {
    return {
      title: 'Document reference already in use',
      message: 'A controlled document already uses this reference. Open the existing document instead of creating another copy.',
      code: 'DOCUMENT_ALREADY_EXISTS',
    };
  }

  if (lower.includes('commencement') && (lower.includes('required') || lower.includes('missing'))) {
    return {
      title: 'Waiting for Execution Partner',
      message: 'The Partner has not confirmed commencement yet. Open Partner execution to review the current release and status.',
      code: 'PARTNER_COMMENCEMENT_REQUIRED',
    };
  }

  if (lower.includes('client transmittal') || lower.includes('transmittal record')) {
    return {
      title: 'Client delivery has not been recorded',
      message: 'Record who received the approved delivery and how it was sent before moving forward.',
      code: 'CLIENT_TRANSMITTAL_REQUIRED',
    };
  }

  if (lower.includes('delivery submission') && lower.includes('required')) {
    return {
      title: 'Partner delivery required',
      message: 'The Execution Partner must submit the current delivery and its files before internal review can begin.',
      code: 'PARTNER_DELIVERY_REQUIRED',
    };
  }

  if (lower.includes('acceptance') && lower.includes('evidence')) {
    return {
      title: 'Client acceptance evidence required',
      message: 'Record the written acceptance you are relying on, such as a PO, signed quote or client email.',
      code: 'CLIENT_ACCEPTANCE_REQUIRED',
    };
  }

  if (lower.includes('duplicate key')) {
    return {
      title: 'Already recorded',
      message: 'This appears to have already been created. Refresh the record before trying again.',
      code: 'DUPLICATE_RECORD',
    };
  }

  if (lower.includes('foreign key') || lower.includes('violates foreign key')) {
    return {
      title: 'Related records must be resolved first',
      message: 'This item is linked to other records. Resolve those links before making this change.',
      code: 'RELATED_RECORDS',
    };
  }

  if (lower.includes('permission') || lower.includes('42501') || lower.includes('row-level security')) {
    return {
      title: 'You do not have access to this action',
      message: 'Your account does not have permission to make this change.',
      code: 'PERMISSION_DENIED',
    };
  }

  if (lower.includes('readiness') || lower.includes('cannot advance') || lower.includes('not ready')) {
    return {
      title: 'Not ready to move forward',
      message: 'One or more required checks are still outstanding. Review “Ready to proceed?” for the next item to resolve.',
      code: 'NOT_READY',
    };
  }

  return {
    title: 'We could not complete that action',
    message: 'Refresh the record and try again. If the problem continues, check the current stage and required evidence before retrying.',
  };
}

export function operatorErrorMessage(error: unknown) {
  return toOperatorError(error).message;
}
