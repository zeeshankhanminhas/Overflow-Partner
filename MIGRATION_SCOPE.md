# Overflow Partner UI Foundation Migration

This repository will receive the existing MIDTS engineering-overflow product surfaces as its starting foundation.

## Included

- Public frontend
- Protected Workspace
- Document Engine / Document Suite
- Shared UI components and required Next.js configuration
- Existing frontend workflow adapters required by these surfaces

## Excluded

- Google Apps Script source
- Google Sheets backend implementation
- Cloud Run gateway source
- Old-site reference files
- MIDTS deployment diagnostics and unrelated programme documentation

## Architecture direction

The product workflow and user experience are retained. The next architectural step is to replace legacy Apps Script integrations with Supabase Auth, Postgres, Storage, Row Level Security, and server-side application services.
