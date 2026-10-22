/** Manual LinkedIn conversation import: preserves original text and parses only
 * explicitly labelled messages or reviewable unlabelled paragraphs. This never infers who spoke or sends outreach. */
export type ConversationSource = 'linkedin' | 'sales_navigator';
export type ConversationSpeaker = 'you' | 'prospect' | 'unknown';
export type ParsedConversationMessage = {
  speaker: ConversationSpeaker;
  body: string;
  sentAt: string | null;
  originalOrder: number;
  occurrence: number;
};

export function isLinkedInConversationUrl(input: string): boolean {
  if (!input.trim()) return true;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' &&
      (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')) &&
      !url.username && !url.password;
  } catch { return false; }
}

function parsedTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  // Preserve timestamps only when the pasted text specifies a timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function parseConversationTranscript(input: string): ParsedConversationMessage[] {
  const text = input.replace(/\r\n?/g, '\n').trim();
  if (!text || text.length > 60000) throw new Error('Paste between 1 and 60,000 characters of conversation.');
  const lines = text.split('\n');
  const parts: {speaker:ConversationSpeaker;body:string;sentAt:string|null}[] = [];
  // Example: [2026-10-20T10:15:00Z] You: Hello
  // Or: Prospect: We occasionally need CAD support.
  const marker = /^(?:\[([^\]]{1,40})\]\s*)?(You|Me|Prospect|Contact):\s*(.*)$/i;
  let unlabelledBreak = false;
  for (const line of lines) {
    const hit = line.match(marker);
    if (hit) {
      parts.push({
        speaker:/^(you|me)$/i.test(hit[2])?'you':'prospect',
        body:hit[3],
        sentAt:parsedTimestamp(hit[1]),
      });
      unlabelledBreak = false;
    } else if (!line.trim()) {
      // Unlabelled pasted paragraphs are review candidates, not confident messages.
      unlabelledBreak = parts.length>0 && parts[parts.length-1].speaker==='unknown';
      if (parts.length && parts[parts.length-1].speaker!=='unknown')
        parts[parts.length-1].body += '\n';
    } else if (parts.length && !unlabelledBreak) {
      parts[parts.length-1].body += '\n'+line;
    } else {
      parts.push({speaker:'unknown',body:line,sentAt:null});
      unlabelledBreak = false;
    }
  }
  const counts = new Map<string,number>();
  const messages: ParsedConversationMessage[] = [];
  for (const part of parts) {
    const body = part.body.trim();
    if (!body) continue;
    if (body.length > 20000) throw new Error('A message exceeds 20,000 characters; split the transcript.');
    const key = part.speaker + '|' + (part.sentAt ?? '') + '|' + body.replace(/\s+/g,' ').toLowerCase();
    const occurrence = (counts.get(key) ?? 0) + 1;
    counts.set(key, occurrence);
    messages.push({speaker:part.speaker,body,sentAt:part.sentAt,originalOrder:messages.length,occurrence});
  }
  if (!messages.length || messages.length > 250) throw new Error('Paste between 1 and 250 messages per import.');
  return messages;
}
