(()=>{'use strict';
let sb,user,role,db={partners:[],packages:[],opportunities:[],referrals:[],replacements:[],history:[]};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const partner=id=>db.partners.find(x=>x.id===id),pkg=id=>db.packages.find(x=>x.id===id),opp=id=>db.opportunities.find(x=>x.id===id);
const active=oid=>db.referrals.find(x=>x.opportunity_id===oid&&x.active);
const count=pid=>db.referrals.filter(x=>x.package_id===pid&&x.active).length;
const obligations=pid=>db.replacements.filter(x=>x.package_id===pid).length;
const pending=p=>Math.max(0,p.quantity+obligations(p.id)-count(p.id));
const due=p=>{let d=new Date(p.purchased_at+'T12:00:00');d.setDate(d.getDate()+p.term_days);return d};
const date=s=>s?new Date(s).toLocaleDateString('pt-BR'):'';
function flash(m,b=false){const e=$('#flash');e.textContent=m;e.className='flash'+(b?' bad':'');e.style.display='block';setTimeout(()=>e.style.display='none',5500)}
function options(el,items,label){if(!el)return;const v=el.value;el.innerHTML='<option value="">Selecione</option>'+items.map(x=>'<option value="'+x.id+'">'+esc(label(x))+'</option>').join('');if(items.some(x=>x.id===v))el.value=v}
function addAuth(){
 document.querySelector('header p').textContent='Base compartilhada · Supabase';
 $('.notice').innerHTML='<strong>Base compartilhada.</strong> Os dados desta versão ficam centralizados no Supabase e exigem usuário autorizado.';
 const box=document.createElement('section');box.id='auth-box';box.className='panel';box.style='max-width:440px;margin:30px auto';
 box.innerHTML='<h2>Entrar no CRM</h2><div class="fields"><label>E-mail<input id="crm-email" type="email"></label><label>Senha<input id="crm-password" type="password"></label><div class="row"><button id="crm-login" type="button">Entrar</button><button id="crm-signup" type="button" class="secondary">Criar conta</button></div><p id="auth-status" class="muted mini"><strong>Versão 03/10 · diagnóstico ativo.</strong> Preparando conexão...</p></div>';
 $('main').prepend(box);
 const admin=document.createElement('section');admin.id='admin-box';admin.className='panel section';admin.style.display='none';
 admin.innerHTML='<details><summary><strong>Administração de acesso</strong><span class="muted mini">Usuários</span></summary><div class="collapsible-content"><div class="row"><input id="member-email" type="email" placeholder="E-mail da pessoa"><select id="member-role"><option value="operator">Operador</option><option value="admin">Administrador</option></select><button id="member-add" type="button">Liberar acesso</button></div><p class="muted mini">Use somente quando precisar liberar um novo usuário. A pessoa precisa criar a conta primeiro.</p></div></details>';
 $('.notice').after(admin);
 const out=document.createElement('button');out.id='crm-logout';out.textContent='Sair';out.className='secondary';out.style='float:right;display:none';document.querySelector('header').prepend(out);
 $('#export').closest('.panel').style.display='none';
}
function appVisible(on){$$('main>section,main>.notice,main>footer').forEach(e=>{if(e.id!=='auth-box')e.style.display=on?'':'none'});$('#auth-box').style.display=on?'none':'block';$('#crm-logout').style.display=on?'block':'none'}
async function boot(){
 const cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.url||!cfg.key)throw Error(cfg.error||'Configuração indisponível');
 sb=supabase.createClient(cfg.url,cfg.key);
 const {data:{session}}=await sb.auth.getSession();user=session?.user||null;
 if(!user){appVisible(false);return}
 await sb.rpc('claim_first_admin');
 const {data:m}=await sb.from('crm_members').select('role,enabled').eq('user_id',user.id).maybeSingle();
 if(!m?.enabled){appVisible(false);flash('Conta criada, mas ainda não liberada para o CRM.',true);return}
 role=m.role;appVisible(true);$('#admin-box').style.display=role==='admin'?'block':'none';await load();
}
async function load(){
 const rs=await Promise.all([
  sb.from('partners').select('*').order('created_at'),
  sb.from('packages').select('*').order('created_at'),
  sb.from('opportunities').select('*').order('created_at',{ascending:false}),
  sb.from('referrals').select('*').order('created_at'),
  sb.from('replacements').select('*').order('created_at'),
  sb.from('audit_events').select('*').order('occurred_at',{ascending:false}).limit(200)
 ]);
 const bad=rs.find(x=>x.error);if(bad)throw bad.error;
 [db.partners,db.packages,db.opportunities,db.referrals,db.replacements,db.history]=rs.map(x=>x.data);render();
}
function renderPartnerDirectory(){
 const el=$('#partner-directory');if(!el)return;
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const q=norm($('#partner-search')?.value),words=q.split(' ').filter(Boolean),st=$('#partner-status-filter')?.value||'',aud=norm($('#partner-audience-filter')?.value),av=norm($('#partner-availability-filter')?.value),ap=norm($('#partner-approach-filter')?.value),dm=norm($('#partner-demand-filter')?.value);
 const scored=db.partners.map(p=>{const name=norm(p.name),hay=norm([p.name,p.approach,p.topics,p.audiences,p.availability,p.professional_registry,p.email,p.phone].join(' '));let score=0;if(q){if(name===q)score=1000;else if(name.startsWith(q))score=800;else if(name.includes(q))score=650;else if(words.every(w=>name.includes(w)))score=550;else if(words.every(w=>hay.includes(w)))score=250;else return null}return {p,score}});
 const list=scored.filter(Boolean).filter(x=>{const p=x.p;return(!st||p.status===st)&&(!aud||norm(p.audiences).includes(aud))&&(!av||norm([p.availability,p.shifts].join(' ')).includes(av))&&(!ap||norm(p.approach).includes(ap))&&(!dm||norm(p.topics).includes(dm))}).sort((a,b)=>b.score-a.score||norm(a.p.name).localeCompare(norm(b.p.name),'pt-BR')).map(x=>x.p);
 $('#partner-count').textContent=list.length+' de '+db.partners.length+' profissionais'+(q?' encontrados para a busca':'');
 el.innerHTML=list.map(p=>'<article class="partner-card"><div class="partner-card-head"><div><strong>'+esc(p.name)+'</strong><div class="muted mini">'+esc(p.professional_registry||'Registro não informado')+'</div></div><select class="partner-status-quick" data-partner-id="'+p.id+'" aria-label="Status de '+esc(p.name)+'"><option value="em análise"'+(p.status==='em análise'?' selected':'')+'>Em análise</option><option value="ativo"'+(p.status==='ativo'?' selected':'')+'>Ativo</option><option value="pausado"'+(p.status==='pausado'?' selected':'')+'>Pausado</option></select></div><p><b>Abordagem:</b> '+esc(p.approach||'Não informada')+'</p><p><b>Demandas:</b> '+esc(p.topics||'Não informadas')+'</p><p><b>Disponibilidade:</b> '+esc(p.availability||p.shifts||'Não informada')+'</p><p><b>Público:</b> '+esc(p.audiences||'Não informado')+'</p></article>').join('')||'<p class="muted">Nenhum profissional encontrado. Confira o nome ou limpe os outros filtros ativos.</p>';
}
function render(){
 const open=db.opportunities.filter(o=>!active(o.id)&&o.status!=='Finalizada'),assigned=db.opportunities.filter(o=>active(o.id));
 const total=db.packages.reduce((n,p)=>n+pending(p),0),late=db.packages.filter(p=>pending(p)>0&&due(p)<new Date()).length;
 $('#metrics').innerHTML=[['Parceiros ativos',db.partners.filter(p=>p.status==='ativo').length],['Oportunidades abertas',db.opportunities.filter(o=>o.status!=='Finalizada').length],['Encaminhamentos ativos',db.referrals.filter(r=>r.active).length],['Pendências',total],['Pacotes vencidos',late]].map(x=>'<div class="card"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');
 $$('.partners').forEach(e=>options(e,db.partners,x=>x.name));
 $$('.packages').forEach(e=>options(e,db.packages,x=>(partner(x.partner_id)?.name||'?')+' · pacote '+x.quantity+' · '+pending(x)+' pend.'));
 options($('#edit-partner'),db.partners,x=>x.name+' · '+x.status);options($('#match-opportunity'),db.opportunities,x=>x.name+' · '+x.period);
 options($('#available'),open,x=>x.name);options($('#assigned'),assigned,x=>x.name);
 const rp=$('#replacement-form [name="packageId"]')?.value;
 options($('#replacement-referral'),db.referrals.filter(r=>(!rp||r.package_id===rp)&&r.active&&!db.replacements.some(x=>x.referral_id===r.id)),r=>(opp(r.opportunity_id)?.name||'?'));
 $('#packages').innerHTML=db.packages.map(p=>{let n=pending(p),over=n>0&&due(p)<new Date();return '<tr><td>'+esc(partner(p.partner_id)?.name)+'</td><td>'+date(p.purchased_at)+' / '+date(due(p))+'</td><td>'+p.quantity+'</td><td>'+obligations(p.id)+'</td><td>'+count(p.id)+'</td><td><strong>'+n+'</strong></td><td><span class="status '+(over?'overdue':'')+'">'+(over?'Vencido':n?'Em andamento':'Concluído')+'</span></td><td>'+(db.referrals.some(r=>r.package_id===p.id)||db.replacements.some(r=>r.package_id===p.id)?'<span class="muted mini">Histórico preservado</span>':'<button type="button" class="danger delete-package" data-package-id="'+p.id+'">Excluir</button>')+'</td></tr>'}).join('')||'<tr><td colspan="8" class="muted">Nenhum pacote.</td></tr>';
 {const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),q=norm($('#opportunity-search')?.value),st=$('#opportunity-status-filter')?.value||'',filtered=db.opportunities.filter(o=>(!st||(o.status||'Nova')===st)&&(!q||norm([o.name,o.phone,o.reason,o.period,o.age].join(' ')).includes(q)));$('#opportunity-count').textContent=filtered.length+' de '+db.opportunities.length+' oportunidades';$('#opportunities').innerHTML=filtered.map(o=>{let r=active(o.id),p=r&&pkg(r.package_id),current=r&&o.status==='Nova'?'Encaminhada':o.status||'Nova';return '<tr><td><strong>'+esc(o.name)+'</strong><br><span class="muted">'+(o.age?esc(o.age)+' anos · ':'')+esc(o.period)+' · '+esc(o.reason)+'</span></td><td>'+(r?esc(partner(p?.partner_id)?.name)+' · '+date(r.created_at):'Aguardando')+'</td><td><select class="opportunity-status-quick" data-opportunity-id="'+o.id+'" aria-label="Status de '+esc(o.name)+'"><option'+(current==='Nova'?' selected':'')+'>Nova</option><option'+(current==='Em triagem'?' selected':'')+'>Em triagem</option><option'+(current==='Disponível'?' selected':'')+'>Disponível</option><option'+(current==='Encaminhada'?' selected':'')+'>Encaminhada</option><option'+(current==='Acompanhamento'?' selected':'')+'>Acompanhamento</option><option'+(current==='Finalizada'?' selected':'')+'>Finalizada</option></select></td></tr>'}).join('')||'<tr><td colspan="3" class="muted">Nenhuma oportunidade encontrada.</td></tr>'}
 $('#history').innerHTML=db.history.map(h=>'<tr><td>'+new Date(h.occurred_at).toLocaleString('pt-BR')+'</td><td>'+esc(h.event_type)+'</td><td>'+esc(h.payload?.detail||h.legacy_detail||JSON.stringify(h.payload||{}))+'</td></tr>').join('')||'<tr><td colspan="3" class="muted">Nenhum evento.</td></tr>';
 renderMatches();renderPartnerDirectory();
}
function renderMatches(){
 const o=opp($('#match-opportunity')?.value),el=$('#matches');if(!el)return;if(!o){el.textContent='Selecione uma oportunidade.';return}
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),tokens=s=>norm(s).split(/[^a-z0-9]+/).filter(w=>w.length>3);
 const reason=tokens(o.reason),period=norm(o.period),age=Number(o.age)||null,ageAudience=age===null?'':age<12?'crianca':age<18?'adolescente':age>=60?'idoso':'adulto',audienceHint=norm([o.reason,ageAudience].join(' '));
 const approachRules=[
  {demands:['burnout','esgotamento','estresse','ansiedade','depressao','autoestima'],approaches:['tcc','terapia cognitiva comportamental','cognitivo comportamental']},
  {demands:['relacionamento','relacionamentos','autoestima','ansiedade','depressao'],approaches:['terapia de esquemas','terapia do esquema','esquemas']}
 ];
 const scored=db.partners.filter(p=>p.status==='ativo').map(p=>{
  const pt=tokens(p.topics),pa=tokens(p.audiences),avail=norm([p.availability,p.shifts].join(' ')),approach=norm(p.approach);
  const demand=[...new Set(reason.filter(w=>pt.includes(w)))],approachCompat=approachRules.filter(r=>r.demands.some(d=>reason.includes(d))&&r.approaches.some(a=>approach.includes(a))).map(r=>r.approaches.find(a=>approach.includes(a))).filter(Boolean);
  const audienceTerms=['crianca','criancas','adolescente','adolescentes','adulto','adultos','idoso','idosos'];
  const audienceAsked=audienceTerms.filter(w=>audienceHint.includes(w)),audienceOk=!audienceAsked.length||audienceAsked.some(w=>norm(p.audiences).includes(w));
  const shiftOk=!period||period.includes('combinar')||avail.includes(period)||(['manha','tarde','noite'].some(x=>period.includes(x)&&avail.includes(x)));
  const packs=db.packages.filter(x=>x.partner_id===p.id&&pending(x)>0),debt=packs.reduce((n,x)=>n+pending(x),0);
  let score=0;if(demand.length)score+=45;else if(approachCompat.length)score+=30;if(audienceOk&&audienceAsked.length)score+=20;if(shiftOk)score+=20;if(debt>0)score+=15;
  return {p,demand,approachCompat,audienceOk,audienceAsked,shiftOk,debt,score};
 }).filter(x=>(x.demand.length||x.approachCompat.length)&&x.audienceOk&&x.shiftOk&&x.debt>0).sort((a,b)=>b.score-a.score||b.debt-a.debt||a.p.name.localeCompare(b.p.name)).slice(0,5);
 el.innerHTML=scored.length?scored.map((x,n)=>{
  const why=x.demand.length?'Demanda cadastrada compatível: '+x.demand.join(', '):'Abordagem com compatibilidade preliminar para a demanda: '+x.p.approach;
  const caution=!x.demand.length&&x.approachCompat.length?'<p class="muted mini">⚠ A demanda não consta explicitamente no cadastro deste profissional. Confirme o perfil antes de encaminhar.</p>':'<p class="muted mini">Sugestão operacional. Confirme o perfil antes do encaminhamento.</p>';
  return '<article class="partner-card"><div class="partner-card-head"><strong>'+(n+1)+'. '+esc(x.p.name)+'</strong><span class="status">'+x.score+' pts</span></div><p><b>Compatibilidade preliminar:</b> '+esc(why)+(x.audienceAsked.length?' · público compatível':'')+' · disponibilidade compatível</p><p><b>Abordagem:</b> '+esc(x.p.approach||'Não informada')+'</p><p><b>Pendências:</b> '+x.debt+'</p>'+caution+'</article>'
 }).join(''):'Nenhum profissional ativo com compatibilidade preliminar, disponibilidade e pacote pendente. Revise manualmente.';
}
function bindForm(sel,fn){$(sel).addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('button');b.disabled=true;try{const ok=await fn(Object.fromEntries(new FormData(form)));if(ok===false)return;form.reset();await load();flash('Registrado com sucesso.')}catch(x){flash(x.message,true)}finally{b.disabled=false}})}
function bind(){
 $('#crm-login').onclick=async()=>{const status=$('#auth-status'),email=$('#crm-email').value.trim(),password=$('#crm-password').value;if(!email||!password){status.textContent='Preencha e-mail e senha.';return}status.textContent='Entrando...';try{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;status.textContent='Login realizado.';await boot()}catch(e){status.textContent='Erro: '+e.message;flash(e.message,true)}};
 $('#crm-signup').onclick=async()=>{const btn=$('#crm-signup'),status=$('#auth-status'),email=$('#crm-email').value.trim(),password=$('#crm-password').value;if(!email||!password){status.textContent='Preencha e-mail e senha antes de criar a conta.';return}if(password.length<6){status.textContent='A senha precisa ter pelo menos 6 caracteres.';return}btn.disabled=true;status.textContent='Criando conta...';try{const {data,error}=await sb.auth.signUp({email,password});if(error)throw error;if(data.session){status.textContent='Conta criada e autenticada. Abrindo o CRM...';await boot()}else{status.textContent='Conta criada. Confira seu e-mail para confirmar o cadastro e depois toque em Entrar.';flash('Conta criada. Confira seu e-mail para confirmar o cadastro.')}}catch(e){status.textContent='Erro ao criar conta: '+e.message;flash(e.message,true)}finally{btn.disabled=false}};
 $('#crm-logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
 $('#member-add').onclick=async()=>{const {error}=await sb.rpc('add_crm_member',{member_email:$('#member-email').value.trim(),member_role:$('#member-role').value});if(error)flash(error.message,true);else{flash('Acesso liberado.');$('#member-email').value=''}};
 bindForm('#partner-form',async v=>{const {error}=await sb.from('partners').insert({name:v.name.trim(),approach:v.approach.trim(),topics:v.topics.trim(),shifts:v.shifts,status:v.status,created_by:user.id});if(error)throw error});
 bindForm('#partner-edit-form',async v=>{const {error}=await sb.from('partners').update({approach:v.approach.trim(),topics:v.topics.trim(),shifts:v.shifts,status:v.status,version:partner(v.partnerId).version+1}).eq('id',v.partnerId).eq('version',partner(v.partnerId).version);if(error)throw error});
 $('#edit-partner').onchange=e=>{const p=partner(e.target.value),f=$('#partner-edit-form');f.elements.approach.value=p?.approach||'';f.elements.topics.value=p?.topics||'';f.elements.shifts.value=p?.shifts||'Todos';f.elements.status.value=p?.status||'ativo'};
 bindForm('#package-form',async v=>{const {error}=await sb.from('packages').insert({partner_id:v.partnerId,quantity:+v.quantity,term_days:+v.days,purchased_at:v.purchasedAt,created_by:user.id});if(error)throw error});
 bindForm('#opportunity-form',async v=>{const phone=v.phone.trim().replace(/\D/g,'');if(phone){const duplicate=db.opportunities.find(o=>String(o.phone||'').replace(/\D/g,'')===phone);if(duplicate&&!confirm('Já existe uma oportunidade com este WhatsApp: '+duplicate.name+'. Deseja cadastrar mesmo assim?'))return false}const age=v.age?+v.age:null;const {error}=await sb.from('opportunities').insert({name:v.name.trim(),age,phone,period:v.period,reason:v.reason.trim(),created_by:user.id});if(error)throw error});
 bindForm('#referral-form',async v=>{const {error}=await sb.rpc('create_referral',{p_opportunity_id:v.opportunityId,p_package_id:v.packageId});if(error)throw error});
 bindForm('#transfer-form',async v=>{const {error}=await sb.rpc('transfer_referral',{p_opportunity_id:v.opportunityId,p_new_package_id:v.packageId,p_reason:v.reason.trim()});if(error)throw error});
 bindForm('#replacement-form',async v=>{const {error}=await sb.rpc('create_replacement',{p_referral_id:v.referralId,p_reason:v.reason.trim()});if(error)throw error});
 $('#replacement-form [name="packageId"]').onchange=()=>render();$('#match-opportunity').onchange=()=>{renderMatches();const r=$('#ai-match-result');if(r)r.textContent='Clique em Analisar com IA para uma segunda leitura.'};$('#ai-match').onclick=async()=>{const o=opp($('#match-opportunity')?.value),el=$('#ai-match-result'),btn=$('#ai-match');if(!o){el.textContent='Selecione uma oportunidade primeiro.';return}const candidates=db.partners.filter(p=>p.status==='ativo').map(p=>({id:p.id,name:p.name,approach:p.approach,topics:p.topics,audiences:p.audiences,availability:p.availability||p.shifts,pending:db.packages.filter(x=>x.partner_id===p.id).reduce((n,x)=>n+pending(x),0)})).filter(p=>p.pending>0);btn.disabled=true;el.textContent='Analisando compatibilidade...';try{const token=(await sb.auth.getSession()).data.session?.access_token;if(!token)throw Error('Sessão expirada. Entre novamente.');const res=await fetch('/api/ai-match',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({opportunity:{period:o.period,reason:o.reason},candidates})});const data=await res.json();if(!res.ok)throw Error(data.error||'Falha na análise por IA');el.innerHTML='<strong>Leitura da IA</strong><div style="white-space:pre-wrap;margin-top:8px">'+esc(data.analysis||'Sem análise retornada.')+'</div>'}catch(e){el.textContent='IA indisponível: '+e.message}finally{btn.disabled=false}};$('#opportunity-search').oninput=render;$('#opportunity-status-filter').onchange=render;$('#partner-search').oninput=renderPartnerDirectory;$('#partner-status-filter').onchange=renderPartnerDirectory;['#partner-audience-filter','#partner-availability-filter','#partner-approach-filter','#partner-demand-filter'].forEach(sel=>$(sel).oninput=renderPartnerDirectory);document.addEventListener('click',async e=>{const b=e.target.closest('.delete-package');if(!b)return;const p=pkg(b.dataset.packageId),name=partner(p?.partner_id)?.name||'este parceiro';if(!p||!confirm('Excluir o pacote de '+name+'? Esta ação só é permitida se ainda não houver histórico operacional.'))return;b.disabled=true;try{const {error}=await sb.rpc('delete_unused_package',{p_package_id:p.id});if(error)throw error;await load();flash('Pacote excluído.')}catch(x){flash(x.message,true)}finally{b.disabled=false}});document.addEventListener('change',async e=>{if(!e.target.matches('.opportunity-status-quick'))return;const id=e.target.dataset.opportunityId,o=opp(id),status=e.target.value;if(!o)return;e.target.disabled=true;try{const {data,error}=await sb.from('opportunities').update({status,version:o.version+1}).eq('id',id).eq('version',o.version).select('id');if(error)throw error;if(!data?.length)throw Error('A oportunidade foi alterada em outro acesso. Atualize a página.');await load();flash('Status da oportunidade atualizado.')}catch(x){flash(x.message,true);e.target.value=o.status||'Nova'}finally{e.target.disabled=false}});document.addEventListener('change',async e=>{if(!e.target.matches('.partner-status-quick'))return;const id=e.target.dataset.partnerId,p=partner(id),status=e.target.value;if(!p)return;e.target.disabled=true;try{const {data,error}=await sb.from('partners').update({status,version:p.version+1}).eq('id',id).eq('version',p.version).select('id');if(error)throw error;if(!data?.length)throw Error('O cadastro foi alterado em outro acesso. Atualize a página e tente novamente.');await load();flash('Status atualizado.')}catch(x){flash(x.message,true);e.target.value=p.status}finally{e.target.disabled=false}});
}
addAuth();
fetch('/api/config',{cache:'no-store'}).then(async r=>{const cfg=await r.json();if(!r.ok||!cfg.url||!cfg.key)throw Error(cfg.error||'Configuração indisponível');if(typeof supabase==='undefined')throw Error('Biblioteca de autenticação não carregou');sb=supabase.createClient(cfg.url,cfg.key);bind();$('#auth-status').innerHTML='<strong>Versão 03/10 · conexão pronta.</strong> Preencha e-mail e senha.';return boot()}).catch(e=>{const s=$('#auth-status');if(s)s.textContent='Falha ao iniciar CRM: '+e.message;flash('Falha ao iniciar CRM: '+e.message,true)});
})();