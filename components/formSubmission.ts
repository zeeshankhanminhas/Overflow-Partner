export const REQUEST_TIMEOUT_MS = 120000;

export type SubmitResult = {
  submissionId: string;
  timestamp: string;
};

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function submitNativeIntake(payload: Record<string, string>): Promise<SubmitResult> {
  let response: Response;

  try {
    response = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: withTimeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw new Error('The requirement service could not be reached. Please try again shortly.');
  }

  const json = await response.json().catch(() => ({})) as {
    success?: boolean;
    message?: string;
    submissionId?: string;
    timestamp?: string;
  };

  if (!response.ok || json.success !== true) {
    throw new Error(json.message || 'The requirement could not be submitted. Please try again shortly.');
  }

  return {
    submissionId: json.submissionId || `overflow-partner-${Date.now()}`,
    timestamp: json.timestamp || new Date().toISOString(),
  };
}

export type EncodedUploadFile = {
  name: string;
  type: string;
  sizeBytes: number;
  contentBase64: string;
};

export async function filesToBase64(files: File[], onProgress?: (completed: number, total: number) => void): Promise<EncodedUploadFile[]> {
  const encoded: EncodedUploadFile[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const nextFile = await new Promise<EncodedUploadFile>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const [, base64 = ''] = result.split(',');
        resolve({
          name: file.name,
          type: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          contentBase64: base64,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
      reader.readAsDataURL(file);
    });

    encoded.push(nextFile);
    onProgress?.(index + 1, files.length);
  }

  return encoded;
}
