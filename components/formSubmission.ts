export const REQUEST_TIMEOUT_MS = 120000;

export type SubmitResult = {
  submissionId: string;
  timestamp: string;
};

export type WebhookDiagnostics = {
  hasGatewayUrl: boolean;
  gatewayLooksLikeAppsScript: boolean;
};

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function getGatewayConfig(): { gatewayUrl: string } {
  return {
    gatewayUrl: process.env.NEXT_PUBLIC_MIDTS_GATEWAY_URL || '',
  };
}

export function getWebhookDiagnostics(): WebhookDiagnostics {
  const { gatewayUrl } = getGatewayConfig();

  return {
    hasGatewayUrl: Boolean(gatewayUrl),
    gatewayLooksLikeAppsScript: /^https:\/\/script\.google\.com\/macros\/s\/.+\/(exec|dev)$/.test(gatewayUrl),
  };
}

function assertGatewayConfig(): { gatewayUrl: string } {
  const { gatewayUrl } = getGatewayConfig();

  if (!gatewayUrl) {
    throw new Error('Workspace service is not configured.');
  }

  if (getWebhookDiagnostics().gatewayLooksLikeAppsScript) {
    throw new Error('Workspace service configuration is invalid.');
  }

  return { gatewayUrl };
}

export type StructuredWebhookResponse<T = Record<string, unknown>> = {
  success: boolean;
  message: string;
  data?: T;
};

type RawStructuredWebhookResponse<T = Record<string, unknown>> = Partial<StructuredWebhookResponse<T>> & {
  ok?: boolean;
  status?: string;
  code?: string;
  details?: Record<string, unknown>;
};

function safeWorkspaceError(message: string, payload?: Record<string, unknown>): string {
  const normalized = message.toLowerCase();
  const isWorkspaceRequest = payload?.formStage === 'workspaceRead' || String(payload?.source || '').startsWith('Workspace');

  if (isWorkspaceRequest && (normalized.includes('unsupported workspace') || normalized.includes('unsupported action') || normalized.includes('not implemented'))) {
    return 'This workflow is not yet connected to the live workspace.';
  }

  if (normalized.includes('gateway') || normalized.includes('apps script') || normalized.includes('cloud run')) {
    return 'The workspace service is temporarily unavailable.';
  }

  if (/\b(list|create|update|submit|approve|reject)[a-z0-9]+\b/i.test(message) || message.includes('action:')) {
    return 'The workspace request could not be completed. Please try again shortly.';
  }

  return message || 'The workspace request could not be completed. Please try again shortly.';
}

export async function submitStructuredPayload<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<StructuredWebhookResponse<T>> {
  const { gatewayUrl } = assertGatewayConfig();

  let response: Response;
  try {
    response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: withTimeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The workspace request timed out. Please try again.');
    }
    throw new Error('The workspace service could not be reached. Please try again shortly.');
  }

  const json = (await response.json().catch(() => ({}))) as RawStructuredWebhookResponse<T>;
  const success = json.success === true || json.ok === true || json.status === 'success';
  const data = json.data as T | undefined;
  const dataMessage = data && typeof (data as Record<string, unknown>).message === 'string' ? String((data as Record<string, unknown>).message) : '';
  const message = typeof json.message === 'string' ? json.message : dataMessage || `Request failed with status ${response.status}.`;

  if (!response.ok || !success) {
    throw new Error(safeWorkspaceError(message, payload));
  }

  return {
    success,
    message,
    data,
  };
}

export async function submitJsonPayload(payload: Record<string, unknown>): Promise<SubmitResult> {
  const { gatewayUrl } = assertGatewayConfig();

  let response: Response;
  try {
    response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: withTimeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw new Error('The service could not be reached. Please try again shortly.');
  }

  if (!response.ok) {
    throw new Error('The request could not be completed. Please try again shortly.');
  }

  const json = await response.json().catch(() => ({}));
  return {
    submissionId: typeof json.submissionId === 'string' ? json.submissionId : `midts-${Date.now()}`,
    timestamp: typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
  };
}

export async function submitUrlEncodedPayload(payload: Record<string, string>): Promise<void> {
  const { gatewayUrl } = assertGatewayConfig();

  let response: Response;
  try {
    response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload).toString(),
      signal: withTimeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw new Error('The service could not be reached. Please try again shortly.');
  }

  if (!response.ok) {
    throw new Error('The request could not be completed. Please try again shortly.');
  }
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
