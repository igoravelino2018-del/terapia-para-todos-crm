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
 box.innerHTML='<h2>Entrar no CRM</h2><div class="fields"><label>E-mail<input id="crm-email" type="email"></label><label>Senha<input id="crm-password" type="password"></label><div class="row"><button id="crm-login" type="button">Entrar</button><button id="crm-signup" type="button" class="secondary">Criar conta</button></div><p class="muted mini">A primeira conta assume a administração inicial. Outras contas precisam ser liberadas pelo administrador.</p></div>';
 $('main').prepend(box);
 const admin=document.createElement('section');admin.id='admin-box';admin.className='panel section';admin.style.display='none';
 admin.innerHTML='<h2>Liberar usuário</h2><div class="row"><input id="member-email" type="email" placeholder="E-mail da pessoa"><select id="member-role"><option value="operator">Operador</option><option value="admin">Administrador</option></select><button id="member-add" type="button">Liberar acesso</button></div><p class="muted mini">A pessoa precisa criar a conta primeiro.</p>';
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
function render(){
 const open=db.opportunities.filter(o=>!active(o.id)),assigned=db.opportunities.filter(o=>active(o.id));
 const total=db.packages.reduce((n,p)=>n+pending(p),0),late=db.packages.filter(p=>pending(p)>0&&due(p)<new Date()).length;
 $('#metrics').innerHTML=[['Parceiros',db.partners.length],['Oportunidades',db.opportunities.length],['Encaminhamentos ativos',db.referrals.filter(r=>r.active).length],['Pendências',total],['Pacotes vencidos',late]].map(x=>'<div class="card"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');
 $$('.partners').forEach(e=>options(e,db.partners,x=>x.name));
 $$('.packages').forEach(e=>options(e,db.packages,x=>(partner(x.partner_id)?.name||'?')+' · pacote '+x.quantity+' · '+pending(x)+' pend.'));
 options($('#edit-partner'),db.partners,x=>x.name+' · '+x.status);options($('#match-opportunity'),db.opportunities,x=>x.name+' · '+x.period);
 options($('#available'),open,x=>x.name);options($('#assigned'),assigned,x=>x.name);
 const rp=$('#replacement-form [name="packageId"]')?.value;
 options($('#replacement-referral'),db.referrals.filter(r=>(!rp||r.package_id===rp)&&r.active&&!db.replacements.some(x=>x.referral_id===r.id)),r=>(opp(r.opportunity_id)?.name||'?'));
 $('#packages').innerHTML=db.packages.map(p=>{let n=pending(p),over=n>0&&due(p)<new Date();return '<tr><td>'+esc(partner(p.partner_id)?.name)+'</td><td>'+date(p.purchased_at)+' / '+date(due(p))+'</td><td>'+p.quantity+'</td><td>'+obligations(p.id)+'</td><td>'+count(p.id)+'</td><td><strong>'+n+'</strong></td><td><span class="status '+(over?'overdue':'')+'">'+(over?'Vencido':n?'Em andamento':'Concluído')+'</span></td></tr>'}).join('')||'<tr><td colspan="7" class="muted">Nenhum pacote.</td></tr>';
 $('#opportunities').innerHTML=db.opportunities.map(o=>{let r=active(o.id),p=r&&pkg(r.package_id);return '<tr><td><strong>'+esc(o.name)+'</strong><br><span class="muted">'+esc(o.period)+' · '+esc(o.reason)+'</span></td><td>'+(r?esc(partner(p?.partner_id)?.name)+' · '+date(r.created_at):'Aguardando')+'</td><td>'+(r?'Redirecionar no formulário abaixo':'Encaminhar no formulário abaixo')+'</td></tr>'}).join('')||'<tr><td colspan="3" class="muted">Nenhuma oportunidade.</td></tr>';
 $('#history').innerHTML=db.history.map(h=>'<tr><td>'+new Date(h.occurred_at).toLocaleString('pt-BR')+'</td><td>'+esc(h.event_type)+'</td><td>'+esc(h.payload?.detail||h.legacy_detail||JSON.stringify(h.payload||{}))+'</td></tr>').join('')||'<tr><td colspan="3" class="muted">Nenhum evento.</td></tr>';
 renderMatches();
}
function renderMatches(){
 const o=opp($('#match-opportunity')?.value),el=$('#matches');if(!el)return;if(!o){el.textContent='Selecione uma oportunidade.';return}
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),topics=['ansiedade','luto','depressao','relacionamento','tdah','tea','compulsao','dependencia','trauma','panico','toc'];
 const words=topics.filter(t=>norm(o.reason).includes(t));if(!words.length){el.textContent='Motivo sem palavra reconhecida. Faça a triagem manual.';return}
 const found=db.partners.filter(p=>p.status==='ativo').map(p=>({p,fit:words.filter(t=>norm(p.topics).includes(t)),shift:p.shifts==='Todos'||o.period==='A combinar'||p.shifts===o.period,packs:db.packages.filter(x=>x.partner_id===p.id&&pending(x)>0)})).filter(x=>x.fit.length&&x.shift&&x.packs.length);
 el.innerHTML=found.length?found.map(x=>'<p><strong>'+esc(x.p.name)+'</strong> · '+esc(x.p.approach||'Abordagem não informada')+' · '+esc(x.fit.join(', '))+' · '+x.packs.reduce((n,p)=>n+pending(p),0)+' pendente(s)</p>').join(''):'Nenhum parceiro ativo compatível. Revise manualmente.';
}
function bindForm(sel,fn){$(sel).addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{await fn(Object.fromEntries(new FormData(e.currentTarget)));e.currentTarget.reset();await load();flash('Registrado com sucesso.')}catch(x){flash(x.message,true)}finally{b.disabled=false}})}
function bind(){
 $('#crm-login').onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('#crm-email').value.trim(),password:$('#crm-password').value});if(error)flash(error.message,true);else boot()};
 $('#crm-signup').onclick=async()=>{const {error}=await sb.auth.signUp({email:$('#crm-email').value.trim(),password:$('#crm-password').value});if(error)flash(error.message,true);else{flash('Conta criada. Se receber confirmação por e-mail, confirme e depois entre.');boot()}};
 $('#crm-logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
 $('#member-add').onclick=async()=>{const {error}=await sb.rpc('add_crm_member',{member_email:$('#member-email').value.trim(),member_role:$('#member-role').value});if(error)flash(error.message,true);else{flash('Acesso liberado.');$('#member-email').value=''}};
 bindForm('#partner-form',async v=>{const {error}=await sb.from('partners').insert({name:v.name.trim(),approach:v.approach.trim(),topics:v.topics.trim(),shifts:v.shifts,status:v.status,created_by:user.id});if(error)throw error});
 bindForm('#partner-edit-form',async v=>{const {error}=await sb.from('partners').update({approach:v.approach.trim(),topics:v.topics.trim(),shifts:v.shifts,status:v.status,version:partner(v.partnerId).version+1}).eq('id',v.partnerId).eq('version',partner(v.partnerId).version);if(error)throw error});
 $('#edit-partner').onchange=e=>{const p=partner(e.target.value),f=$('#partner-edit-form');f.elements.approach.value=p?.approach||'';f.elements.topics.value=p?.topics||'';f.elements.shifts.value=p?.shifts||'Todos';f.elements.status.value=p?.status||'ativo'};
 bindForm('#package-form',async v=>{const {error}=await sb.from('packages').insert({partner_id:v.partnerId,quantity:+v.quantity,term_days:+v.days,purchased_at:v.purchasedAt,created_by:user.id});if(error)throw error});
 bindForm('#opportunity-form',async v=>{const {error}=await sb.from('opportunities').insert({name:v.name.trim(),phone:v.phone.trim(),period:v.period,reason:v.reason.trim(),created_by:user.id});if(error)throw error});
 bindForm('#referral-form',async v=>{const {error}=await sb.rpc('create_referral',{p_opportunity_id:v.opportunityId,p_package_id:v.packageId});if(error)throw error});
 bindForm('#transfer-form',async v=>{const {error}=await sb.rpc('transfer_referral',{p_opportunity_id:v.opportunityId,p_new_package_id:v.packageId,p_reason:v.reason.trim()});if(error)throw error});
 bindForm('#replacement-form',async v=>{const {error}=await sb.rpc('create_replacement',{p_referral_id:v.referralId,p_reason:v.reason.trim()});if(error)throw error});
 $('#replacement-form [name="packageId"]').onchange=()=>render();$('#match-opportunity').onchange=renderMatches;
}
addAuth();
fetch('/api/config',{cache:'no-store'}).then(r=>r.json()).then(cfg=>{if(!cfg.url||!cfg.key)throw Error(cfg.error||'Configuração indisponível');sb=supabase.createClient(cfg.url,cfg.key);bind();return boot()}).catch(e=>flash('Falha ao iniciar CRM: '+e.message,true));
})();