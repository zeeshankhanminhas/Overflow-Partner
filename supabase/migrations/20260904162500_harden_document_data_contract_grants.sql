-- Keep the document evidence tables available to signed-in workspace users
-- through organisation-scoped RLS without inheriting schema-level DDL powers.

revoke all on table
  public.client_commercial_profiles,
  public.requirement_items,
  public.quote_line_items,
  public.invoice_line_items,
  public.project_change_requests,
  public.approved_clause_versions
from anon;

revoke truncate, references, trigger on table
  public.client_commercial_profiles,
  public.requirement_items,
  public.quote_line_items,
  public.invoice_line_items,
  public.project_change_requests,
  public.approved_clause_versions
from authenticated;

grant select, insert, update, delete on table
  public.client_commercial_profiles,
  public.requirement_items,
  public.quote_line_items,
  public.invoice_line_items,
  public.project_change_requests,
  public.approved_clause_versions
to authenticated;
