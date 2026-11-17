const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const config = window.AMEZA_FIREBASE_CONFIG;
const storeId = new URLSearchParams(location.search).get('loja');
const productsBox = $('products');
let products = [];

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

function showUnavailable(title, message) {
  $('restaurant-name').textContent = title;
  $('restaurant-description').textContent = message;
  if (productsBox) productsBox.innerHTML = '<div class="notice danger">Este cardápio não está disponível no momento.</div>';
}

function render() {
  if (!productsBox) return;
  const term = ($('search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const selectedFilters = [...document.querySelectorAll('.filter-list input:checked')].map((input) => input.value);
  const visible = products.filter((product) => {
    const text = `${product.name || ''} ${product.ingredients || ''}`.toLocaleLowerCase('pt-BR');
    return (!term || text.includes(term)) && selectedFilters.every((field) => product[field] === true);
  });
  $('product-count').textContent = `${visible.length} prato(s)`;
  productsBox.innerHTML = visible.length ? visible.map((product) => {
    const phone = normalizePhone(window.AMEZA_RESTAURANT_PHONE);
    const message = `Olá! Encontrei o cardápio do ${window.AMEZA_RESTAURANT_NAME}. Gostaria de saber mais sobre: ${product.name}. Poderia confirmar ingredientes e cuidados de preparo?`;
    const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
    const tags = [
      product.milkFree ? '<span class="pill dietary-pill"><img src="assets/icon-no-milk.svg?v=5" alt="">Declarado sem leite e derivados</span>' : '',
      product.lactoseFree ? '<span class="pill">Declarado sem lactose</span>' : '',
      product.glutenFree ? '<span class="pill dietary-pill"><img src="assets/icon-ingredients.svg?v=5" alt="">Declarado sem glúten</span>' : ''
    ].filter(Boolean).join('');
    return `<article class="menu-card">
      <div class="menu-card-head"><h3>${escapeHtml(product.name)}</h3><strong>${money(product.price)}</strong></div>
      ${tags ? `<div class="badge-row">${tags}</div>` : ''}
      <p><strong>Ingredientes:</strong> ${escapeHtml(product.ingredients)}</p>
      <p><strong>Alergênicos e cuidados de preparo:</strong> ${escapeHtml(product.warnings)}</p>
      <p><strong>Adaptações informadas:</strong> ${escapeHtml(product.adaptations || 'Não informadas')}</p>
      ${whatsapp ? `<a class="btn primary" href="${whatsapp}" target="_blank" rel="noopener noreferrer">Perguntar sobre este prato →</a>` : '<p class="note">WhatsApp do estabelecimento não informado.</p>'}
    </article>`;
  }).join('') : '<div class="empty-state">Nenhum prato encontrado com essa busca ou esses filtros.</div>';
}

if (!productsBox) {
  console.error('AMEZA: elemento #products não encontrado.');
} else if (!storeId) {
  showUnavailable('Cardápio não selecionado', 'Volte à lista de estabelecimentos e escolha um cardápio.');
} else if (
  !config?.apiKey || config.apiKey.startsWith('PREENCHA_') ||
  !config?.projectId || config.projectId.startsWith('PREENCHA_')
) {
  showUnavailable('Cardápio em configuração', 'A conexão do Firebase ainda precisa ser configurada para publicar este cardápio.');
} else {
  productsBox.innerHTML = '<p class="muted">Carregando pratos…</p>';
  try {
    const [{ initializeApp }, { getFirestore, collection, doc, getDoc, getDocs, query, where }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js')
    ]);
    const app = initializeApp(config, 'ameza-menu-public');
    const db = getFirestore(app);
    const restaurantSnapshot = await getDoc(doc(db, 'publicRestaurants', storeId));
    if (!restaurantSnapshot.exists() || restaurantSnapshot.data().active !== true) {
      throw new Error('Este estabelecimento não possui cardápio publicado no momento.');
    }
    const restaurant = restaurantSnapshot.data();
    $('restaurant-name').textContent = restaurant.businessName || 'Cardápio do estabelecimento';
    $('restaurant-description').textContent = 'Confira os pratos, ingredientes e informações alimentares declaradas pelo estabelecimento.';
    window.AMEZA_RESTAURANT_NAME = restaurant.businessName || 'restaurante';
    window.AMEZA_RESTAURANT_PHONE = restaurant.whatsapp || '';
    const phone = normalizePhone(restaurant.whatsapp);
    if (phone) {
      const link = $('restaurant-whatsapp');
      link.href = `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Encontrei o cardápio de ${restaurant.businessName} na AMEZA e gostaria de tirar uma dúvida.`)}`;
      link.hidden = false;
    }
    const result = await getDocs(query(collection(db, 'menuProducts'), where('merchantUid', '==', storeId), where('published', '==', true)));
    products = result.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    render();
  } catch (error) {
    console.error('AMEZA: falha ao carregar o cardápio.', error);
    showUnavailable('Cardápio indisponível', error.message || 'Não foi possível carregar as informações.');
  }
}

$('search')?.addEventListener('input', render);
document.querySelectorAll('.filter-list input').forEach((input) => input.addEventListener('change', render));
