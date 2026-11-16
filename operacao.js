import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const config = window.AMEZA_FIREBASE_CONFIG;
let auth, db, user = null, partner = null, products = [];

function notify(message, isError = false) {
  const node = $('notice');
  if (!node) return;
  node.textContent = message;
  node.className = isError ? 'alert error' : 'alert good';
}
function show(id, visible) { $(id)?.classList.toggle('hidden', !visible); }
function failMessage(error) {
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Conta não encontrada. Solicite uma parceria primeiro.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/unauthorized-domain': 'Este endereço ainda não está autorizado no Firebase Authentication.',
    'permission-denied': 'Acesso negado. Confira se a parceria foi aprovada e se as regras do Firestore estão atualizadas.'
  };
  return messages[error?.code] || error?.message || 'Ocorreu um erro inesperado.';
}

if (!config?.apiKey || config.apiKey.startsWith('PREENCHA_') || !config?.projectId || config.projectId.startsWith('PREENCHA_')) {
  notify('A conexão com o Firebase ainda não foi configurada.', true);
  throw new Error('Firebase não configurado');
}

const app = initializeApp(config);
auth = getAuth(app);
db = getFirestore(app);

$('signin').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, event.target.email.value.trim(), event.target.password.value);
    notify('Login realizado.');
  } catch (error) {
    notify(failMessage(error), true);
  } finally {
    button.disabled = false;
  }
});
$('signout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (currentUser) => {
  user = currentUser;
  show('signout', !!user);
  show('signin', !user);
  show('workspace', false);
  if (!user) {
    $('session').textContent = 'Entre com a conta vinculada ao estabelecimento aprovado.';
    return;
  }
  $('session').textContent = \`Conta: \${user.email}\`;
  try {
    await user.reload();
    await user.getIdToken(true);
    if (!user.emailVerified) {
      notify('Confirme seu e-mail antes de acessar o painel.', true);
      return;
    }
    const application = await getDoc(doc(db, 'partnerApplications', user.uid));
    if (!application.exists()) {
      notify('Não encontramos uma solicitação de parceria nesta conta. Acesse “Solicitar parceria”.', true);
      return;
    }
    partner = application.data();
    if (partner.status !== 'approved') {
      notify(\`Sua solicitação está com status “\${partner.status}”. O painel é liberado após aprovação.\`, true);
      return;
    }
    show('workspace', true);
    setupPublicLink();
    await refreshProducts();
  } catch (error) {
    notify(failMessage(error), true);
  }
});

function setupPublicLink() {
  const url = new URL('menu.html', location.href);
  url.searchParams.set('loja', user.uid);
  $('public-menu-url').value = url.toString();
  const qr = $('menu-qr');
  qr.innerHTML = '';
  if (window.QRCode) {
    new window.QRCode(qr, { text: url.toString(), width: 168, height: 168, colorDark: '#173c31', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  } else {
    qr.innerHTML = '<span class="muted">QR Code indisponível. Use o link acima.</span>';
  }
}

$('copy-menu-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('public-menu-url').value);
    notify('Link do cardápio copiado.');
  } catch {
    $('public-menu-url').select();
    notify('Selecione e copie o link do cardápio.');
  }
});
$('download-qr').addEventListener('click', () => {
  const canvas = $('menu-qr').querySelector('canvas');
  const image = $('menu-qr').querySelector('img');
  const dataUrl = canvas?.toDataURL('image/png') || image?.src;
  if (!dataUrl) return notify('QR Code ainda não está disponível. Use o link do cardápio.', true);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'qr-code-cardapio-ameza.png';
  link.click();
});

async function refreshProducts() {
  const snapshot = await getDocs(query(collection(db, 'menuProducts'), where('merchantUid', '==', user.uid)));
  products = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  $('product-total').textContent = \`\${products.length} prato(s)\`;
  $('products').innerHTML = products.length ? products.map((product) => \`
    <article class="product-admin">
      <div class="product-admin-main">
        <div class="topline"><h3>\${escapeHtml(product.name)}</h3><span class="price">\${money(product.price)}</span></div>
        <p>\${escapeHtml(product.ingredients)}</p>
        <p class="note">\${escapeHtml(product.warnings)}</p>
        <div class="badge-row">
          \${product.milkFree ? '<span class="pill">Sem leite declarado</span>' : ''}
          \${product.lactoseFree ? '<span class="pill">Sem lactose declarado</span>' : ''}
          \${product.glutenFree ? '<span class="pill">Sem glúten declarado</span>' : ''}
          <span class="pill \${product.published ? '' : 'warn'}">\${product.published ? 'Publicado' : 'Rascunho'}</span>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="secondary" data-action="edit" data-id="\${product.id}">Editar</button>
        <button type="button" class="secondary" data-action="toggle" data-id="\${product.id}">\${product.published ? 'Ocultar' : 'Publicar'}</button>
        <button type="button" class="danger" data-action="delete" data-id="\${product.id}">Excluir</button>
      </div>
    </article>\`).join('') : '<p class="muted">Você ainda não cadastrou pratos. Use o formulário abaixo para começar.</p>';
}

function resetForm() {
  $('product-form').reset();
  $('product-id').value = '';
  $('form-title').textContent = 'Cadastrar prato';
  $('save-product').textContent = 'Salvar prato';
  show('cancel-edit', false);
}
function startEdit(product) {
  const form = $('product-form');
  form.elements.productId.value = product.id;
  form.elements.name.value = product.name || '';
  form.elements.price.value = product.price || '';
  form.elements.ingredients.value = product.ingredients || '';
  form.elements.warnings.value = product.warnings || '';
  form.elements.adaptations.value = product.adaptations || '';
  form.elements.milk.checked = product.milkFree === true;
  form.elements.lactose.checked = product.lactoseFree === true;
  form.elements.gluten.checked = product.glutenFree === true;
  $('form-title').textContent = 'Editar prato';
  $('save-product').textContent = 'Salvar alterações';
  show('cancel-edit', true);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('cancel-edit').addEventListener('click', resetForm);

$('product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user || partner?.status !== 'approved') return;
  const form = event.target;
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const ingredients = String(data.get('ingredients') || '').trim();
  const warnings = String(data.get('warnings') || '').trim();
  const price = Number(data.get('price'));
  if (!name || !ingredients || !warnings || !Number.isFinite(price) || price <= 0) {
    return notify('Preencha nome, preço, ingredientes e alergênicos/cuidados de preparo.', true);
  }
  const payload = {
    name, price, ingredients, warnings,
    adaptations: String(data.get('adaptations') || '').trim(),
    milkFree: data.has('milk'), lactoseFree: data.has('lactose'), glutenFree: data.has('gluten')
  };
  const id = String(data.get('productId') || '').trim();
  const button = $('save-product');
  button.disabled = true;
  try {
    if (id) {
      await updateDoc(doc(db, 'menuProducts', id), { ...payload, updatedAt: serverTimestamp() });
      notify('Prato atualizado.');
    } else {
      await addDoc(collection(db, 'menuProducts'), {
        ...payload,
        merchantUid: user.uid,
        merchantName: partner.businessName,
        published: false,
        createdAt: serverTimestamp()
      });
      notify('Prato cadastrado como rascunho. Revise e publique quando estiver pronto.');
    }
    resetForm();
    await refreshProducts();
  } catch (error) {
    notify(failMessage(error), true);
  } finally {
    button.disabled = false;
  }
});

$('products').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.id);
  if (!product) return;
  const action = button.dataset.action;
  if (action === 'edit') return startEdit(product);
  if (action === 'delete' && !confirm(\`Excluir o prato “\${product.name}”? \`)) return;
  button.disabled = true;
  try {
    if (action === 'toggle') {
      await updateDoc(doc(db, 'menuProducts', product.id), { published: !product.published, updatedAt: serverTimestamp() });
      notify(product.published ? 'Prato ocultado do cardápio público.' : 'Prato publicado no cardápio público.');
    } else if (action === 'delete') {
      await deleteDoc(doc(db, 'menuProducts', product.id));
      notify('Prato excluído.');
      if ($('product-id').value === product.id) resetForm();
    }
    await refreshProducts();
  } catch (error) {
    notify(failMessage(error), true);
  } finally {
    button.disabled = false;
  }
});
