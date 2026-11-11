// New commercial Helix project: genuine operator actions and approved SOW.
import assert from 'node:assert/strict';
import {approveHelixProjectEvidence} from './helix-document-browser.mjs';

export async function mobiliseHelixNewProject(control,admin,operatorDb,orgId,projectId,expectedPartnerId){
 const projectPath='/workspace/projects/'+projectId;
 await control.goto(projectPath);
 await control.locator('#record-next-action').waitFor({timeout:30000});
 const controls=control.locator('form:has(select[name="project_manager_id"])');
 assert.equal(await controls.count(),1,'Project manager and programme controls must appear at mobilisation');
 const start=new Date().toISOString().slice(0,10);
 const due=new Date(Date.now()+21*86400000).toISOString().slice(0,10);
 await controls.locator('select[name="project_manager_id"]').selectOption({index:1});
 await controls.locator('input[name="start_date"]').fill(start);
 await controls.locator('input[name="due_date"]').fill(due);
 await Promise.all([
  control.waitForURL(u=>u.pathname===projectPath&&u.searchParams.has('updated'),{timeout:30000}),
  controls.getByRole('button',{name:'Save mobilisation controls'}).click()
 ]);
 const {data:project,error:projectError}=await admin.from('projects')
  .select('project_stage,project_manager_id,start_date,due_date')
  .eq('organisation_id',orgId).eq('id',projectId).single();
 assert.equal(projectError,null);
 assert.equal(project.project_stage,'mobilisation');
 assert.ok(project.project_manager_id);
 assert.equal(project.start_date,start);
 assert.equal(project.due_date,due);
 console.log('PASS browser: new client-originated Project 360 mobilisation manager and programme saved through UI.');

 const sowId=await approveHelixProjectEvidence(control,admin,orgId,projectId,'statement-of-work');
 await control.goto(projectPath+'/execution');
 const form=control.locator('form:has(select[name="scope_document_id"])');
 assert.equal(await form.count(),1,'Controlled Partner assignment requires commercial lineage and approved SOW');
 const selectedPartner=await form.locator('select[name="partner_id"]').inputValue();
 assert.equal(selectedPartner,expectedPartnerId,'Partner must be inherited from the approved quote');
 await form.locator('select[name="scope_document_id"]').selectOption(sowId);
 await form.locator('input[name="partner_contact_email"]').fill('helix-partner@example.invalid');
 await form.locator('input[name="partner_contact_name"]').fill('Helix QA Partner Lead');
 await form.locator('input[name="planned_start_date"]').fill(start);
 await form.locator('input[name="committed_due_date"]').fill(due);
 await form.locator('select[name="reporting_cadence"]').selectOption('milestone');
 await form.locator('textarea[name="release_notes"]').fill('Controlled GD&T pump assembly engineering package; QA and final payment gates apply.');
 const submit=form.getByRole('button',{name:'Set up Partner work'});
 assert.equal(await submit.isEnabled(),true,'Actual Partner setup must be available during mobilisation');
 await Promise.all([
  control.waitForURL(u=>u.pathname===projectPath+'/execution'&&(u.searchParams.has('success')||u.searchParams.has('error')),{timeout:30000}),
  submit.click()
 ]);
 const url=new URL(control.url());
 assert.equal(url.searchParams.get('error'),null,'Partner assignment failed: '+url.searchParams.get('error'));
 const {data:assignments,error:assignmentError}=await admin.from('project_execution_assignments')
  .select('id,partner_id,scope_document_id,execution_state').eq('organisation_id',orgId).eq('project_id',projectId);
 assert.equal(assignmentError,null);
 assert.equal(assignments.length,1);
 assert.equal(assignments[0].partner_id,expectedPartnerId);
 assert.equal(assignments[0].scope_document_id,sowId);
 console.log('PASS browser: approved SOW and commercially selected partner assigned through Project Execution UI.');
 const {data:readiness,error:readinessError}=await operatorDb.rpc('op_project_stage_readiness',{p_project_id:projectId});
 assert.equal(readinessError,null,'Canonical next-stage readiness must use authenticated operator context');
 console.log('HELIX REAL PROJECT MOBILISATION READINESS '+JSON.stringify(readiness));
 assert.equal(readiness.stage,'mobilisation');
 assert.equal(readiness.ready,true,'Commercially backed mobilisation still has missing evidence: '+JSON.stringify(readiness.reasons));
 await control.goto(projectPath);
 const advance=control.locator('form:has(input[name="target_stage"][value="ready_for_execution"])');
 assert.equal(await advance.count(),1,'A fully ready Project must expose its actual lifecycle transition');
 await Promise.all([
  control.waitForURL(u=>u.pathname===projectPath&&(u.searchParams.has('advanced')||u.searchParams.has('error')),{timeout:30000}),
  advance.getByRole('button').first().click()
 ]);
 const advancedUrl=new URL(control.url());
 assert.equal(advancedUrl.searchParams.get('error'),null,'Partner release transition failed: '+advancedUrl.searchParams.get('error'));
 const {data:after,error:afterError}=await admin.from('projects').select('project_stage')
  .eq('organisation_id',orgId).eq('id',projectId).single();
 assert.equal(afterError,null);
 assert.equal(after.project_stage,'ready_for_execution');
 console.log('PASS browser: new Project 360 advanced to Ready for Execution by operator stage action.');
 return assignments[0].id;
}
