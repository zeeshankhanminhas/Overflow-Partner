
-- QA-only cleanup: do not auto-create obsolete document approval tasks when delivery enters Internal Review.
-- Existing historical document rows remain untouched for audit and traceability.
do $qa$
declare v_src text;v_begin int;v_end int;v_updated text;
begin
 select pg_get_functiondef(oid) into v_src from pg_proc
 where proname='op_advance_project_stage' and pronamespace='public'::regnamespace limit 1;
 if v_src is null then raise exception 'Missing stage transition function'; end if;
 v_begin:=strpos(v_src,'    if not exists(select 1 from public.documents where project_id=v_project.id and document_type=''technical-review''');
 v_end:=strpos(v_src,E'\n  end if;\n\n  if p_target_stage=''partner_correction''');
 if v_begin=0 or v_end=0 or v_end<=v_begin
 then raise exception 'Transition definition changed; refuse unsafe edit'; end if;
 if position('document_type=''document-register''' in substr(v_src,v_begin,v_end-v_begin))=0
 then raise exception 'Expected legacy register auto-creation missing'; end if;
 v_updated:=substr(v_src,1,v_begin-1)||substr(v_src,v_end+1);
 if position('update public.partner_delivery_submissions set review_status=''under_review''' in v_updated)=0
 or position('if p_target_stage=''partner_correction''' in v_updated)=0
 then raise exception 'Partner delivery lifecycle must remain intact'; end if;
 execute v_updated;
end $qa$;