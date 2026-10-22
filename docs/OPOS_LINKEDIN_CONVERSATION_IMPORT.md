# Manual LinkedIn / Sales Navigator conversation import (staged)

This feature extends the existing LinkedIn prospect record; it does **not** create a second CRM, auto-send LinkedIn messages, import LinkedIn account data via scraping, or change a prospect's interest/technical-qualification state.

## Operator workflow
1. Create or open the existing LinkedIn-sourced Prospect (Company / Contact already linked).
2. Copy the conversation text from LinkedIn or Sales Navigator where you have permission to do so.
3. Select its source, optionally paste the LinkedIn conversation URL, and paste the transcript.
4. For message-by-message display, label lines `You:` / `Prospect:` (also `Me:` / `Contact:`). To keep an exact time, optionally prefix `[2026-10-20T10:15:00Z]`. Any unrecognised source text is preserved verbatim with speaker unknown.
5. Import to the existing prospect. Original pasted text is retained immutably; parsed messages are appended if new. Repeating the same import does not create duplicate messages or another prospect.
6. Review the record and **manually** set outreach reply outcome / interest / follow-up using existing governed controls. No automatic outreach or Step 2 invitation occurs from an import.
7. When prospect moves into formal Case 360, its linked Prospect conversation remains available via the original Prospect record.

## Dedupe / evidence
- Original imports use a per-prospect + source + exact-normalised-text hash.
- Parsed messages use per-prospect + source + speaker + UTC timestamp (if supplied) + normalised body + occurrence count. This preserves repeated identical lines within a complete pasted transcript; exact repeats across imports are ignored.
- When pasting *only a new message* that repeats earlier wording (e.g., another 'Thanks'), supply a unique ISO timestamp, or the duplicate-protection rule may treat it as already archived.
- There is no automatic model-based interpretation. The source text is personal data: collect only relevant business conversations and respect deletion/retention requests under the organisation's privacy policy.

## Deployment / security
- Files and migration on feature branch only. **Do not apply the migration to production or turn the feature flag on for live users until an isolated QA backend is available.**
- Run the migration in an isolated Supabase backend; test row-level security for cross-organisation reading/writing and anonymous users, duplicate imports, partial retry, and portal access.
- Once verified, enable server env `OP_LINKEDIN_CONVERSATION_IMPORT_ENABLED=true` for the target environment only, then run manual authenticated browser tests.
- Requires `public.organisations`, `public.prospects`, `public.profiles` tables and existing auth policies.
- Inserts only; no modify/delete policies on immutable import evidence. A governed GDPR erasure flow must be designed before production if retention/erasure obligations require it.
