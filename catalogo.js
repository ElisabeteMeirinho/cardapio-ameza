import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const config = window.AMEZA_FIREBASE_CONFIG;
const list = $('directory');
let restaurants = [];

if (!config?.apiKey || config.apiKey.startsWith('PREENCHA_') || !config?.projectId || config.projectId.startsWith('PREENCHA_')) {
  list.innerHTML = '<div class="notice danger">A conexão do catálogo ainda não foi configurada.</div>';
} else {
  try {
    const app = initializeApp(config);
    const db = getFirestore(app);
    const snapshot = await getDocs(query(collection(db, 'publicRestaurants'), where('active', '==', true)));
    restaurants = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.businessName || '').localeCompare(String(b.businessName || ''), 'pt-BR'));
    render();
  } catch (error) {
    console.error(error);
    list.innerHTML = '<div class="notice danger">Não foi possível carregar os estabelecimentos. Confira a conexão e as regras do Firebase.</div>';
    $('directory-count').textContent = 'Indisponível';
  }
}

function render() {
  const term = ($('search').value || '').trim().toLocaleLowerCase('pt-BR');
  const filtered = restaurants.filter((restaurant) => String(restaurant.businessName || '').toLocaleLowerCase('pt-BR').includes(term));
  $('directory-count').textContent = \`\${filtered.length} estabelecimento(s)\`;
  list.innerHTML = filtered.length ? filtered.map((restaurant) => \`
    <article class="restaurant-card">
      <div class="logo-mark" aria-hidden="true">A</div>
      <div class="restaurant-card-copy">
        <p class="eyebrow">CARDÁPIO PARCEIRO</p>
        <h3>\${escapeHtml(restaurant.businessName)}</h3>
        <p>Consulte os pratos, ingredientes e informações alimentares declaradas por este estabelecimento.</p>
        <a class="btn primary" href="menu.html?loja=\${encodeURIComponent(restaurant.id)}">Ver cardápio →</a>
      </div>
    </article>\`).join('') : '<div class="empty-state">Nenhum estabelecimento publicado por aqui ainda. Volte em breve!</div>';
}

$('search').addEventListener('input', render);
