type IntakeSubmission = {
  intake_session_id: string;
  description: string;
  deliverables: string;
  project_type: string;
  discipline: string | null;
  software: string | null;
  drawing_count: number | null;
  source_file_format: string | null;
  required_output_format: string | null;
  deadline: string | null;
  timeline: string | null;
  complexity: string | null;
  files_availability: string | null;
  standards: string | null;
  tolerances: string | null;
  revision_status: string | null;
  special_instructions: string | null;
  submitted_at: string;
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? 'Not specified' : String(value);
}
function deliverableItems(value: string | null | undefined) {
  return value ? value.split(/\r?\n|,\s*/).map((item) => item.trim()).filter(Boolean) : [];
}
function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="vp-fact"><small>{label}</small><strong>{displayValue(value)}</strong></div>;
}

export default function AcquisitionTechnicalBrief({ submission }: { submission: IntakeSubmission }) {
  const deliverables = deliverableItems(submission.deliverables);
  return <div style={{display:'grid',gap:18}}>
    <div className="vp-section-title"><div><p className="vp-label">Structured technical brief</p><h2>{submission.discipline || submission.project_type}</h2></div><span className="vp-row-status">Submitted {dateTime(submission.submitted_at)}</span></div>
    <div className="vp-facts" style={{marginTop:0}}>
      <Fact label="Discipline" value={submission.discipline}/><Fact label="Software" value={submission.software}/><Fact label="Complexity" value={submission.complexity}/><Fact label="Timeline" value={submission.timeline}/><Fact label="Deadline" value={submission.deadline}/><Fact label="Files available" value={submission.files_availability}/><Fact label="Source format" value={submission.source_file_format}/><Fact label="Primary output" value={submission.required_output_format}/><Fact label="Revision status" value={submission.revision_status}/><Fact label="Drawing count" value={submission.drawing_count}/>
    </div>
    <div><p className="vp-label">Deliverables</p><div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>{deliverables.length?deliverables.map(item=><span className="vp-row-status" key={item} style={{border:'1px solid var(--op-line)',borderRadius:6,padding:'7px 9px',background:'rgba(255,255,255,.025)'}}>{item}</span>):<span>Not specified</span>}</div></div>
    <div><p className="vp-label">Description</p><p style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{submission.description}</p></div>
    {(submission.standards || submission.tolerances) ? <div className="vp-facts" style={{marginTop:0}}><Fact label="Standards and specifications" value={submission.standards}/><Fact label="Critical tolerances" value={submission.tolerances}/></div> : null}
    {submission.special_instructions ? <div className="vp-callout"><strong>Engineering notes</strong><p style={{whiteSpace:'pre-wrap'}}>{submission.special_instructions}</p></div> : null}
  </div>;
}
