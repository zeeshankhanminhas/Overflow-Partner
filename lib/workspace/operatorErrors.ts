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
      title: 'Controlled document already exists',
      message: 'An existing controlled document already uses this reference. Open and continue the existing document instead of generating another copy.',
      code: 'DOCUMENT_ALREADY_EXISTS',
    };
  }

  if (lower.includes('duplicate key')) {
    return {
      title: 'Record already exists',
      message: 'The requested record appears to have already been created. Refresh the current record before trying again.',
      code: 'DUPLICATE_RECORD',
    };
  }

  if (lower.includes('foreign key') || lower.includes('violates foreign key')) {
    return {
      title: 'Action blocked by related records',
      message: 'This record is linked to other governed data and cannot be changed in this way until those relationships are resolved.',
      code: 'RELATED_RECORDS',
    };
  }

  if (lower.includes('permission') || lower.includes('42501') || lower.includes('row-level security')) {
    return {
      title: 'Permission required',
      message: 'Your account is not permitted to perform this action.',
      code: 'PERMISSION_DENIED',
    };
  }

  return {
    title: 'Action could not be completed',
    message: raw || 'The requested action could not be completed. Refresh the record and try again.',
  };
}

export function operatorErrorMessage(error: unknown) {
  return toOperatorError(error).message;
}
