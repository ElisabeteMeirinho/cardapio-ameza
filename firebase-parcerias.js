// Autenticacao e solicitacoes reais, com dados compartilhados no Firestore.
// IMPORTANTE: a seguranca depende das regras publicadas em firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch, serverTimestamp, query, where } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
const $=id=>document.getElementById(id);
const page=document.body.dataset.page;
const cfg=window.AMEZA_FIREBASE_CONFIG||{};
const configured=cfg.apiKey&&!cfg.apiKey.startsWith('PREENCHA_')&&cfg.projectId&&!cfg.projectId.startsWith('PREENCHA_')&&cfg.authDomain&&!cfg.authDomain.startsWith('PREENCHA_')&&cfg.appId&&!cfg.appId.startsWith('PREENCHA_');
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const names={pending:'Aguardando avaliacao',approved:'Aprovada',rejected:'Recusada',suspended:'Suspensa'};
const benefits={base:'Mensalidade base (proposta)',reduced:'Mensalidade reduzida (proposta)',free:'Parceira gratuita / isenta'};
const stamp=t=>t?.toDate?.()?.toLocaleString('pt-BR')||'Data indisponivel';
function msg(id,t,isError=false){const el=$(id);if(el){el.className='alert '+(isError?'error':'good');el.textContent=t;}}
function show(el,on){$(el)?.classList.toggle('hidden',!on);}
function setFirebaseStatus(text,isError=false){
 const el=$('firebase-status');if(!el)return;
 el.textContent=text;
 el.className=isError?'alert error':'muted';
}
function failure(e){const k=e?.code||'';return ({'auth/email-already-in-use':'Este e-mail já está cadastrado.','auth/invalid-email':'E-mail inválido.','auth/invalid-credential':'E-mail ou senha incorretos.','auth/weak-password':'Senha muito fraca.','auth/unauthorized-domain':'Domínio não autorizado no Firebase Authentication.','auth/network-request-failed':'Falha de rede ao acessar o Firebase. Verifique sua conexão.','auth/operation-not-allowed':'O login por e-mail e senha ainda não está ativado no Firebase Authentication.','auth/too-many-requests':'Muitas tentativas. Aguarde um pouco e tente novamente.','permission-denied':'Permissão negada. Confira as regras do Firestore e a confirmação do e-mail.','unavailable':'O Firestore está indisponível no momento. Tente novamente.','failed-precondition':'O Firestore precisa de uma configuração adicional no Console Firebase.'})[k]||e.message||'Erro desconhecido';}
if(!configured){show('setup',true);show('auth-forms',false);show('admin-login',false);setFirebaseStatus('Configuração pendente: o projeto Firebase exclusivo da AMEZA ainda não foi configurado.',true);throw new Error('Firebase da AMEZA ainda não configurado.');}
const app=initializeApp(cfg), auth=getAuth(app),db=getFirestore(app);
let user=null, rows=[];
$('signin')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await signInWithEmailAndPassword(auth,$('si-email').value.trim(),$('si-password').value);msg('auth-note','Login realizado.');}catch(err){msg('auth-note',failure(err),true)}finally{b.disabled=false;}});
$('signup')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const r=await createUserWithEmailAndPassword(auth,$('su-email').value.trim(),$('su-password').value);await sendEmailVerification(r.user);msg('auth-note','Conta criada. Confira o e-mail de verificacao, confirme e depois saia e entre novamente.');}catch(err){msg('auth-note',failure(err),true)}finally{b.disabled=false;}});
$('logout')?.addEventListener('click',async()=>{await signOut(auth);location.reload();});
onAuthStateChanged(auth,async u=>{user=u;try{setFirebaseStatus(u?'Conta reconhecida pelo Firebase. Verificando permissões…':'Módulo Firebase carregado. Entre ou crie uma conta para continuar.');if(page==='company')await company();else await admin();}catch(err){const detail=failure(err);setFirebaseStatus('Não foi possível consultar os dados no Firebase: '+detail,true);msg(page==='company'?'request-note':'auth-note',detail,true);}finally{window.dispatchEvent(new Event('ameza:firebase-ready'));}});
async function company(){
 const active=!!user;
 show('auth-forms',!active);show('logout',active);show('request-panel',active);
 $('account-status').textContent=active?'Conta: '+user.email:'Entre ou crie uma conta para solicitar parceria.';
 if(!active)return;
 await user.reload();await user.getIdToken(true);
 if(!user.emailVerified){$('existing-request').textContent='Confirme seu e-mail antes de enviar a solicitacao.';show('application-form',false);return;}
 const ref=doc(db,'partnerApplications',user.uid);
 const result=await getDoc(ref);
 if(result.exists()){
  const a=result.data();show('application-form',false);
  $('existing-request').innerHTML=`<div class="alert"><strong>${esc(a.businessName)}</strong> · <span class="pill">${esc(names[a.status]||a.status)}</span><p>Enviada: ${esc(stamp(a.createdAt))}</p><p>${esc(a.adminNote||'Sua solicitacao esta em analise.')}</p><p>Plano: ${esc(a.benefit?benefits[a.benefit]:'A definir apos avaliacao')}.</p><p>Quando aprovada, sua conta acessa o painel para cadastrar pratos e publicar seu cardápio. A cobrança continua manual e fora da plataforma nesta versão.</p>${a.status==='approved'?'<p><a class="btn primary" href="restaurante.html">Abrir painel do restaurante →</a></p>':''}</div>`;
 }else{show('application-form',true);$('existing-request').innerHTML='';}
}
$('application-form')?.addEventListener('submit',async e=>{
 e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
 try{
  if(!user){throw Error('Entre na sua conta.')}await user.reload();await user.getIdToken(true);if(!user.emailVerified)throw Error('Confirme seu e-mail antes de solicitar parceria.');
  const flags={milkFree:$('milk').checked,lactoseFree:$('lactose').checked,glutenFree:$('gluten').checked,adaptation:$('adapt').checked};
  if(!Object.values(flags).some(Boolean))throw Error('Selecione uma opcao inclusiva ou adaptacao viavel.');
  const cnpj=$('cnpj').value.trim();if(!/^\d{14}$/.test(cnpj))throw Error('Informe 14 digitos para CNPJ.');
  const body={ownerUid:user.uid,ownerEmail:user.email,businessName:$('name').value.trim(),cnpj,contactName:$('contact').value.trim(),whatsapp:$('phone').value.trim(),...flags,evidence:$('evidence').value.trim(),status:'pending',benefit:'base',adminNote:'',createdAt:serverTimestamp()};
  if(body.evidence.length<20)throw Error('Descreva os cuidados alimentares com pelo menos 20 caracteres.');
  await setDoc(doc(db,'partnerApplications',user.uid),body);
  msg('request-note','Solicitacao enviada e registrada no Firebase. Acompanhe o status ao entrar nesta pagina.');await company();
 }catch(err){msg('request-note',failure(err),true)}finally{b.disabled=false;}
});
async function admin(){
 if(!user){show('admin-login',true);show('dashboard',false);return;}
 await user.reload();await user.getIdToken(true);
 if(!user.emailVerified){show('admin-login',true);show('dashboard',false);msg('auth-note','Confirme o e-mail da sua conta antes de entrar.',true);return;}
 const grant=await getDoc(doc(db,'platformAdmins',user.uid));
 if(!grant.exists()||grant.data().enabled!==true){show('admin-login',true);show('dashboard',false);msg('auth-note','Conta sem acesso de administracao. Configure seu UID no Firestore conforme as instrucoes.',true);return;}
 show('admin-login',false);show('dashboard',true);
 const snapshot=await getDocs(collection(db,'partnerApplications'));
 rows=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 render();
}
function render(){
 const selection=$('status-filter').value;
 const entries=rows.filter(r=>selection==='all'||r.status===selection);
 $('totals').textContent=`Empresas: ${rows.length} · Pendentes: ${rows.filter(r=>r.status==='pending').length} · Aprovadas: ${rows.filter(r=>r.status==='approved').length} · Isentas: ${rows.filter(r=>r.status==='approved'&&r.benefit==='free').length}`;
 $('companies').innerHTML=entries.length?entries.map(a=>`<article class="company"><div class="topline"><h3>${esc(a.businessName)}</h3><span class="pill">${esc(names[a.status]||a.status)}</span></div><p>CNPJ: ${esc(a.cnpj)} · Responsavel: ${esc(a.contactName)}</p><p>E-mail: ${esc(a.ownerEmail)} · WhatsApp: ${esc(a.whatsapp)}</p><p>Enviada: ${esc(stamp(a.createdAt))}</p><p><strong>Opcoes declaradas:</strong> ${[a.milkFree&&'Sem leite e derivados',a.lactoseFree&&'Sem lactose',a.glutenFree&&'Sem gluten / celiacos',a.adaptation&&'Adaptacoes'].filter(Boolean).join(', ')}</p><p><strong>Explicacao:</strong> ${esc(a.evidence)}</p><div class="field"><label>Observacoes da analise<textarea maxlength="1000" data-note="${a.id}">${esc(a.adminNote||'')}</textarea></label></div><div class="field"><label>Beneficio proposto<select data-benefit="${a.id}"><option value="base" ${a.benefit==='base'?'selected':''}>Mensalidade base</option><option value="reduced" ${a.benefit==='reduced'?'selected':''}>Mensalidade reduzida</option><option value="free" ${a.benefit==='free'?'selected':''}>Isencao</option></select></label></div><div class="actions"><button data-status="approved" data-id="${a.id}">Aprovar</button><button class="secondary" data-status="rejected" data-id="${a.id}">Recusar</button><button class="danger" data-status="suspended" data-id="${a.id}">Suspender</button><button class="secondary" data-status="pending" data-id="${a.id}">Voltar para analise</button></div></article>`).join(''):'<p class="empty">Nenhuma empresa nesta situacao.</p>';
}
$('status-filter')?.addEventListener('change',render);
$('companies')?.addEventListener('click',async e=>{
 const button=e.target.closest('button[data-status]');if(!button)return;
 const id=button.dataset.id,status=button.dataset.status;
 const note=document.querySelector(`[data-note="${id}"]`)?.value.trim()||'';
 const benefit=document.querySelector(`[data-benefit="${id}"]`)?.value||'base';
 if(status==='approved'&&!confirm('Aprovar esta empresa? Essa decisao sera registrada no Firestore.'))return;
 button.disabled=true;
 try{
  const application=rows.find(item=>item.id===id);
  if(!application)throw Error('Solicitação não encontrada. Atualize o painel e tente novamente.');
  const batch=writeBatch(db),ref=doc(db,'partnerApplications',id);
  batch.update(ref,{status,benefit,adminNote:note,reviewedBy:user.uid,reviewedAt:serverTimestamp()});
  // Publica apenas os dados comerciais mínimos do estabelecimento aprovado.
  batch.set(doc(db,'publicRestaurants',id),{
    ownerUid:id,
    businessName:application.businessName,
    whatsapp:application.whatsapp,
    active:status==='approved',
    updatedAt:serverTimestamp()
  },{merge:true});
  const log=doc(collection(db,'partnerAudit'));
  batch.set(log,{applicationId:id,adminUid:user.uid,status,benefit,adminNote:note,createdAt:serverTimestamp()});
  await batch.commit();
  // Ao retirar a aprovação, despublica os pratos para que não continuem visíveis no catálogo.
  if(status!=='approved'){
    const published=await getDocs(query(collection(db,'menuProducts'),where('merchantUid','==',id),where('published','==',true)));
    for(let offset=0;offset<published.docs.length;offset+=400){
      const disableBatch=writeBatch(db);
      published.docs.slice(offset,offset+400).forEach(item=>disableBatch.update(item.ref,{published:false,updatedAt:serverTimestamp()}));
      await disableBatch.commit();
    }
  }
  msg('admin-note',status==='approved'?'Parceiro aprovado. O perfil público foi ativado; o restaurante já pode cadastrar e publicar pratos.':'Decisão registrada. Perfil público desativado e pratos publicados ocultados.');await admin();
 }catch(err){msg('admin-note',failure(err),true)}finally{button.disabled=false;}
});
