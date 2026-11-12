import {PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage} from 'pdf-lib';

const W=595.28, H=841.89;
const ink=rgb(0.07,0.10,0.08), orange=rgb(0.91,0.37,0.12), muted=rgb(0.34,0.40,0.36);
const paper=rgb(0.96,0.96,0.94), light=rgb(0.90,0.92,0.89), white=rgb(1,1,1);
type Fonts={regular:PDFFont;bold:PDFFont};

function txt(page:PDFPage,content:string,x:number,y:number,size:number,font:PDFFont,color=ink){
  page.drawText(content,{x,y,size,font,color});
}
function rule(page:PDFPage,x1:number,y:number,x2:number,color=light){
  page.drawLine({start:{x:x1,y},end:{x:x2,y},thickness:0.9,color});
}
function lines(text:string,font:PDFFont,size:number,maxWidth:number):string[]{
  const out:string[]=[];
  for(const paragraph of text.split('\n')){
    if(!paragraph){out.push('');continue;}
    let cur='';
    for(const word of paragraph.split(/\s+/)){
      const attempt=cur?cur+' '+word:word;
      if(font.widthOfTextAtSize(attempt,size)>maxWidth && cur){out.push(cur);cur=word;}
      else cur=attempt;
    }
    if(cur)out.push(cur);
  }
  return out;
}
function paragraph(page:PDFPage,content:string,x:number,y:number,width:number,font:PDFFont,size=10.2,leading=15.5,color=muted){
  for(const row of lines(content,font,size,width)){if(row)txt(page,row,x,y,size,font,color);y-=leading;}
  return y;
}
function brandedPage(pdf:PDFDocument,fonts:Fonts,pageNo:number,total:number,title:string){
  const p=pdf.addPage([W,H]);
  p.drawRectangle({x:0,y:H-13,width:W,height:13,color:orange});
  txt(p,'OVERFLOW',38,786,16,fonts.bold,ink);
  txt(p,'PARTNER',135,786,16,fonts.regular,ink);
  txt(p,'ENGINEERING CAPABILITY',W-182,790,7.8,fonts.bold,orange);
  rule(p,38,772,W-38);
  rule(p,38,54,W-38);
  txt(p,title,38,37,7.7,fonts.regular,muted);
  txt(p,'Illustrative information | '+pageNo+' / '+total,W-171,37,7.7,fonts.regular,muted);
  return p;
}
function section(page:PDFPage,label:string,x:number,y:number,fonts:Fonts){
  txt(page,label.toUpperCase(),x,y,9.2,fonts.bold,orange);
}
function box(page:PDFPage,x:number,y:number,w:number,h:number,title:string,body:string,fonts:Fonts){
  page.drawRectangle({x,y:y-h,width:w,height:h,color:paper});
  page.drawRectangle({x,y:y-h,width:3,height:h,color:orange});
  txt(page,title,x+16,y-24,11.6,fonts.bold,ink);
  paragraph(page,body,x+16,y-44,w-31,fonts.regular,9.0,13.8,muted);
}
function bullet(page:PDFPage,x:number,y:number,title:string,body:string,fonts:Fonts,width=475){
  page.drawCircle({x:x+4,y:y+3,size:3,color:orange});
  txt(page,title,x+16,y,11,fonts.bold,ink);
  const end=paragraph(page,body,x+16,y-18,width-16,fonts.regular,9.5,14.5,muted);
  return end-13;
}
function labelValue(page:PDFPage,x:number,y:number,label:string,value:string,fonts:Fonts,valueX=185){
  txt(page,label,x,y,9.1,fonts.bold,ink);
  txt(page,value,valueX,y,9.1,fonts.regular,muted);
  rule(page,x,y-10,W-38);
}
function tableHeader(page:PDFPage,y:number,cols:[number,string][],fonts:Fonts){
  page.drawRectangle({x:38,y:y-28,width:W-76,height:34,color:ink});
  cols.forEach(([x,label])=>txt(page,label,x,y-16,9,fonts.bold,white));
}
function tableRow(page:PDFPage,y:number,values:[number,string][],fonts:Fonts){
  values.forEach(([x,value])=>paragraph(page,value,x,y,Math.max(50,W-x-40),fonts.regular,8.5,11,ink));
  rule(page,38,y-17,W-38);
}
async function init(title:string){
  const pdf=await PDFDocument.create();
  const fonts={regular:await pdf.embedFont(StandardFonts.Helvetica),bold:await pdf.embedFont(StandardFonts.HelveticaBold)};
  pdf.setTitle(title);pdf.setAuthor('Overflow Partner');pdf.setSubject('Engineering support information and illustrative process documentation');pdf.setCreator('Overflow Partner');
  return {pdf,fonts};
}

export async function createCapabilityStatementPdf():Promise<Uint8Array>{
  const {pdf,fonts}=await init('Overflow Partner - Engineering Capability Statement');
  const p1=brandedPage(pdf,fonts,1,2,'Capability statement | Public information');
  section(p1,'Engineering capability',38,740,fonts);
  txt(p1,'Engineering support.',38,703,29,fonts.bold,ink);
  txt(p1,'Organised around your team.',38,670,28,fonts.regular,ink);
  paragraph(p1,'Additional engineering execution capacity for defined design, CAD, drawing and documentation work packages. Clear scope, review responsibilities and controlled handover are built into the proposed delivery approach.',38,634,508,fonts.regular,11.1,17,muted);
  section(p1,'Areas of support',38,553,fonts);
  const serviceBoxes=[
    ['3D CAD modelling','Part and assembly modelling to agreed design inputs.'],
    ['Production drawings','Controlled technical drawing and revision packages.'],
    ['Reverse engineering','Reconstruction from suitable measured references.'],
    ['Technical documentation','Registers, BOMs and technical handover records.'],
    ['Drawing conversion','Legacy drawing updates and format migration.'],
    ['Overflow engineering support','Defined work packages alongside existing teams.'],
  ] as const;
  serviceBoxes.forEach((item,i)=>{
    const x=i%2===0?38:302;
    const y=532-Math.floor(i/2)*76;
    box(p1,x,y,255,67,item[0],item[1],fonts);
  });
  section(p1,'Engagement approach',38,286,fonts);
  let y=261;
  y=bullet(p1,38,y,'Clarify','Establish outcome, design inputs, constraints and acceptance criteria.',fonts);
  y=bullet(p1,38,y,'Agree','Confirm the scope, responsible parties, delivery dates and commercial terms.',fonts);
  y=bullet(p1,38,y,'Execute and review','Work to agreed standards with defined technical decision points.',fonts);
  bullet(p1,38,y,'Handover','Release the agreed files, identified revisions and supporting records.',fonts);

  const p2=brandedPage(pdf,fonts,2,2,'Capability statement | Delivery controls');
  section(p2,'Engineering assurance',38,740,fonts);
  txt(p2,'Quality is a process,',38,701,27,fonts.bold,ink);
  txt(p2,'not a claim on a badge.',38,670,27,fonts.regular,ink);
  paragraph(p2,'A practical control framework for work packages. Exact technical responsibilities and review requirements are agreed with each client; they are not represented here as independently certified performance.',38,637,503,fonts.regular,10.5,16,muted);
  section(p2,'Delivery checkpoints',38,575,fonts);
  let y2=548;
  const checkpoints=[
    ['Scope control','Requirements, source data, boundaries and acceptance conditions are recorded.'],
    ['Information protection','Confidentiality and sharing arrangements are confirmed before sensitive data transfer.'],
    ['Technical review','Clarifications, comments and revisions follow an agreed review responsibility.'],
    ['Release control','Files, drawing numbers and revisions are identified in the handover index.'],
  ] as const;
  for(const c of checkpoints){y2=bullet(p2,38,y2,c[0],c[1],fonts);}
  section(p2,'Typical handover records (where agreed)',38,288,fonts);
  labelValue(p2,38,266,'Document register','Drawing / document numbers and revisions',fonts,207);
  labelValue(p2,38,237,'Bill of materials','Part references, quantities and material fields',fonts,207);
  labelValue(p2,38,208,'Technical review log','Findings, responsible parties and dispositions',fonts,207);
  labelValue(p2,38,179,'Handover index','Issued file inventory and acceptance record',fonts,207);
  p2.drawRectangle({x:38,y:77,width:W-76,height:59,color:paper});
  txt(p2,'START A CONVERSATION',52,116,9.1,fonts.bold,orange);
  txt(p2,'overflow-partner.vercel.app/contact',52,94,12,fonts.bold,ink);
  txt(p2,'No client logos, project outcomes, credentials or accreditations are implied.',38,67,8,fonts.regular,muted);
  return pdf.save();
}

export async function createSampleHandoverPdf():Promise<Uint8Array>{
  const {pdf,fonts}=await init('Overflow Partner - Illustrative Controlled Handover Templates');
  const p1=brandedPage(pdf,fonts,1,3,'Sample handover pack | Template only');
  section(p1,'Illustrative documents - not client work',38,740,fonts);
  txt(p1,'Controlled handover.',38,700,30,fonts.bold,ink);
  txt(p1,'Example document structure.',38,666,26,fonts.regular,ink);
  paragraph(p1,'This pack demonstrates how a defined engineering work package could be organised. Every sample identifier is fictional. No files, drawings, tests, certifications, acceptance or project performance are represented as real client records.',38,630,506,fonts.regular,11,17,muted);
  p1.drawRectangle({x:38,y:493,width:W-76,height:48,color:paper});
  txt(p1,'SAMPLE ONLY - NOT APPROVED FOR MANUFACTURE OR CLIENT RELEASE',50,512,10.0,fonts.bold,orange);
  section(p1,'Example handover index',38,455,fonts);
  tableHeader(p1,432,[[52,'REFERENCE'],[178,'DOCUMENT'],[389,'STATUS']],fonts);
  const rows=[
    ['SAMPLE-INDEX-001','Handover index','Template'],
    ['SAMPLE-DWG-001','Drawing register','Template'],
    ['SAMPLE-BOM-001','Bill of materials','Template'],
    ['SAMPLE-REV-001','Technical review log','Template'],
    ['SAMPLE-CHK-001','Release checklist','Template'],
  ];
  let y=380;
  for(const r of rows){tableRow(p1,y,[[52,r[0]],[178,r[1]],[389,r[2]]],fonts);y-=40;}
  section(p1,'Handover metadata fields',38,157,fonts);
  paragraph(p1,'Work package reference | Client record reference | Issued revision | Date | Prepared by | Checked by | Release authority | File inventory | Outstanding exclusions',38,134,506,fonts.regular,10,16,muted);

  const p2=brandedPage(pdf,fonts,2,3,'Sample register and BOM | Template only');
  section(p2,'Register templates',38,740,fonts);
  txt(p2,'Drawing register',38,699,26,fonts.bold,ink);
  paragraph(p2,'The example uses neutral placeholder identifiers. Real drawings require client-specific information, approved revisions and a defined release status.',38,667,505,fonts.regular,10,16,muted);
  tableHeader(p2,622,[[52,'DRAWING NO.'],[194,'TITLE'],[406,'REV.'],[463,'STATE']],fonts);
  const drawings=[
    ['DWG-EX-001','Assembly arrangement','--','Sample'],
    ['DWG-EX-002','Detail part A','--','Sample'],
    ['DWG-EX-003','Detail part B','--','Sample'],
    ['DWG-EX-004','Interface / installation','--','Sample'],
  ];
  let rowY=573;
  for(const r of drawings){tableRow(p2,rowY,[[52,r[0]],[194,r[1]],[406,r[2]],[463,r[3]]],fonts);rowY-=39;}
  section(p2,'Bill of materials',38,379,fonts);
  paragraph(p2,'Items and material descriptions below illustrate a field structure only, not an engineered assembly.',38,356,500,fonts.regular,9.8,15,muted);
  tableHeader(p2,327,[[52,'ITEM'],[112,'PART NO.'],[249,'DESCRIPTION'],[466,'QTY']],fonts);
  const bom=[['01','PART-EX-A','Example fabricated plate','1'],['02','PART-EX-B','Example machined spacer','2'],['03','HARDWARE-EX','Specified fastener (TBC)','4']];
  rowY=278;
  for(const r of bom){tableRow(p2,rowY,[[52,r[0]],[112,r[1]],[249,r[2]],[466,r[3]]],fonts);rowY-=39;}
  p2.drawRectangle({x:38,y:75,width:W-76,height:55,color:paper});
  paragraph(p2,'Example release fields: material / standard, finishing, inspection, revision, file format, checked-by, approval record and outstanding exceptions.',50,111,480,fonts.regular,9.2,14,ink);

  const p3=brandedPage(pdf,fonts,3,3,'Sample review and release | Template only');
  section(p3,'Traceability templates',38,740,fonts);
  txt(p3,'Technical review log',38,700,27,fonts.bold,ink);
  paragraph(p3,'Issues should be assigned and resolved against a controlled file revision before a technical release. Entries here are instructions, not evidence of completed checks.',38,665,505,fonts.regular,10.3,16,muted);
  const findings=[
    ['REVIEW-01','Input dimensions confirmed','Owner / evidence','Open'],
    ['REVIEW-02','Critical interfaces evaluated','Owner / evidence','Open'],
    ['REVIEW-03','Drawing notes and revisions checked','Owner / evidence','Open'],
  ];
  tableHeader(p3,605,[[52,'REF.'],[140,'REVIEW REQUIREMENT'],[455,'STATE']],fonts);
  let y3=556;
  for(const r of findings){tableRow(p3,y3,[[52,r[0]],[140,r[1]],[455,r[3]]],fonts);y3-=40;}
  section(p3,'Sample handover readiness checklist',38,400,fonts);
  const checks=[
    'Scope and agreed deliverable schedule referenced',
    'Drawing and native / neutral file revisions matched',
    'Technical review comments and exceptions recorded',
    'Client-facing release package identified',
    'Outstanding assumptions and exclusions disclosed',
    'Release owner and recipient recorded',
  ];
  let cy=366;
  for(const item of checks){
    p3.drawRectangle({x:41,y:cy-3,width:11,height:11,borderWidth:1,borderColor:muted});
    paragraph(p3,item,64,cy,463,fonts.regular,10,15,ink);
    cy-=39;
  }
  p3.drawRectangle({x:38,y:83,width:W-76,height:43,color:paper});
  txt(p3,'ILLUSTRATIVE ONLY | NO APPROVAL, SIGNATURE OR TEST RESULT IMPLIED',48,99,9.6,fonts.bold,orange);
  return pdf.save();
}
