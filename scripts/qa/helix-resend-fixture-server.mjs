// Isolated CI-only Resend HTTP contract fixture. Never sends external email.
import http from 'node:http';
const received=[];
const port=Number(process.env.OP_QA_RESEND_PORT||3411);
const server=http.createServer(async(req,res)=>{
 const done=(code,payload)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(payload));};
 if(req.method==='GET'&&req.url==='/health')return done(200,{ok:true});
 if(req.method==='GET'&&req.url==='/messages')return done(200,{messages:received});
 if(req.method!=='POST'||req.url!=='/emails')return done(404,{message:'not found'});
 if(req.headers.authorization!=='Bearer qa-local-resend-test-key')return done(401,{message:'bad test auth'});
 let body='';
 for await(const chunk of req){body+=chunk.toString();if(body.length>3000000)return done(413,{message:'too large'});}
 let msg;try{msg=JSON.parse(body)}catch{return done(400,{message:'invalid JSON'})}
 if(!Array.isArray(msg.to)||msg.to.length!==1||!msg.to[0].endsWith('@example.invalid')||
   !String(msg.from||'').endsWith('@example.invalid')||
   !msg.attachments?.some(x=>x.filename?.endsWith('.pdf')&&x.content?.length>100)||
   !String(msg.html||'').includes('/quote-response?token='))return done(422,{message:'missing governed quote PDF or client response link'});
 received.push({id:'qa-local-provider-'+received.length,...msg});
 return done(200,{id:'qa-local-provider-'+(received.length-1)});
});
server.listen(port,'127.0.0.1',()=>console.log('Local CI mail transport ready on '+port));
