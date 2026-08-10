export class RecordNotFoundError extends Error {
  readonly recordType: string;

  constructor(recordType: string, message?: string) {
    super(message || `${recordType} not found in the current organisation.`);
    this.name = 'RecordNotFoundError';
    this.recordType = recordType;
  }
}

export function isRecordNotFoundError(error: unknown): error is RecordNotFoundError {
  return error instanceof RecordNotFoundError;
}
