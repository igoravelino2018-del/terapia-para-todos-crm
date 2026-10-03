export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
 const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'OPENAI_API_KEY ainda não configurada no Vercel'});
 const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Autenticação necessária'});
 const supabaseUrl=process.env.SUPABASE_URL,publishable=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!supabaseUrl||!publishable)return res.status(503).json({error:'Supabase não configurado'});
 const userCheck=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:publishable,authorization:auth}});
 if(!userCheck.ok)return res.status(401).json({error:'Sessão inválida'});
 const body=req.body||{},opportunity=body.opportunity||{},candidates=Array.isArray(body.candidates)?body.candidates.slice(0,40):[];
 if(!opportunity.reason||!candidates.length)return res.status(400).json({error:'Oportunidade ou candidatos insuficientes'});
 const safeCandidates=candidates.map(({id,name,approach,topics,audiences,availability,pending})=>({id,name,approach,topics,audiences,availability,pending}));
 const input='Você é um assistente operacional do CRM Terapia para Todos. Analise compatibilidade para encaminhamento, sem diagnosticar, sem decidir automaticamente e sem inventar dados. Considere demanda descrita, público atendido, disponibilidade, abordagem informada e pendências. Retorne no máximo 5 profissionais em ordem de compatibilidade, com justificativa curta e qualquer ressalva. Se os dados forem insuficientes, diga isso. O encaminhamento final é humano.\n\nOportunidade: '+JSON.stringify({period:opportunity.period,reason:opportunity.reason})+'\n\nCandidatos: '+JSON.stringify(safeCandidates);
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:'gpt-6-luna',input,max_output_tokens:700})});
 const data=await r.json();if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'Falha no provedor de IA'});
 const analysis=data.output_text||data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||'';
 return res.status(200).json({analysis});
}