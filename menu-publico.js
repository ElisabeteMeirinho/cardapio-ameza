import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const config = window.AMEZA_FIREBASE_CONFIG;
const storeId = new URLSearchParams(location.search).get('loja');
const productsBox = $('products');
let products = [];

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = \`55\${digits}\`;
  return digits;
}

function render() {
  const term = ($('search').value || '').trim().toLocaleLowerCase('pt-BR');
  const selectedFilters = [...document.querySelectorAll('.filter-list input:checked')].map((input) => input.value);
  const visible = products.filter((product) => {
    const matchesText = !term || \`\${product.name || ''} \${product.ingredients || ''}\`.toLocaleLowerCase('pt-BR').includes(term);
    const matchesFilters = selectedFilters.every((field) => product[field] === true);
    return matchesText && matchesFilters;
  });
  $('product-count').textContent = \`\${visible.length} prato(s)\`;
  productsBox.innerHTML = visible.length ? visible.map((product) => {
    const phone = normalizePhone(window.AMEZA_RESTAURANT_PHONE);
    const message = \`Olá! Encontrei o cardápio do \${window.AMEZA_RESTAURANT_NAME}. Gostaria de saber mais sobre: \${product.name}. Poderia confirmar ingredientes e cuidados de preparo?\`;
    const whatsapp = phone ? \`https://wa.me/\${phone}?text=\${encodeURIComponent(message)}\` : '';
    const tags = [
      product.milkFree ? '<span class="pill dietary-pill"><img src="assets/icon-no-milk.svg" alt="">Declarado sem leite e derivados</span>' : '',
      product.lactoseFree ? '<span class="pill dietary-pill"><img src="assets/icon-no-lactose.svg" alt="">Declarado sem lactose</span>' : '',
      product.glutenFree ? '<span class="pill dietary-pill"><img src="assets/icon-no-gluten.svg" alt="">Declarado sem glúten</span>' : ''
    ].filter(Boolean).join('');
    return \`<article class="menu-card">
      <div class="menu-card-head"><h3>\${escapeHtml(product.name)}</h3><strong>\${money(product.price)}</strong></div>
      \${tags ? \`<div class="badge-row">\${tags}</div>\` : ''}
      <p><strong>Ingredientes:</strong> \${escapeHtml(product.ingredients)}</p>
      <p><strong>Alergênicos e cuidados de preparo:</strong> \${escapeHtml(product.warnings)}</p>
      <p><strong>Adaptações informadas:</strong> \${escapeHtml(product.adaptations || 'Não informadas')}</p>
      \${whatsapp ? \`<a class="btn primary" href="\${whatsapp}" target="_blank" rel="noopener noreferrer">Perguntar sobre este prato →</a>\` : '<p class="note">WhatsApp do estabelecimento não informado.</p>'}
    </article>\`;
  }).join('') : '<div class="empty-state">Nenhum prato encontrado com essa busca ou esses filtros.</div>';
}

if (!storeId || !config?.apiKey || config.apiKey.startsWith('PREENCHA_') || !config?.projectId || config.projectId.startsWith('PREENCHA_')) {
  $('restaurant-name').textContent = 'Cardápio indisponível';
  $('restaurant-description').textContent = 'O endereço está incompleto ou a conexão ainda não foi configurada.';
  productsBox.innerHTML = '<div class="notice danger">Volte à lista de estabelecimentos e escolha um cardápio publicado.</div>';
} else {
  try {
    const app = initializeApp(config);
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
      link.href = \`https://wa.me/\${phone}?text=\${encodeURIComponent(\`Olá! Encontrei o cardápio de \${restaurant.businessName} na AMEZA e gostaria de tirar uma dúvida.\`)}\`;
      link.hidden = false;
    }
    const result = await getDocs(query(collection(db, 'menuProducts'), where('merchantUid', '==', storeId), where('published', '==', true)));
    products = result.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    render();
  } catch (error) {
    console.error(error);
    $('restaurant-name').textContent = 'Cardápio indisponível';
    $('restaurant-description').textContent = error.message || 'Não foi possível carregar as informações.';
    productsBox.innerHTML = '<div class="notice danger">Não foi possível carregar este cardápio. Tente novamente mais tarde.</div>';
  }
}

$('search').addEventListener('input', render);
document.querySelectorAll('.filter-list input').forEach((input) => input.addEventListener('change', render));
