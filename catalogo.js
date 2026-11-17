const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const config = window.AMEZA_FIREBASE_CONFIG;
const list = $('directory');
const count = $('directory-count');
const search = $('search');
let restaurants = [];

function setDirectoryMessage(message, status = '') {
  if (list) list.innerHTML = message;
  if (count && status) count.textContent = status;
}

function render() {
  if (!list || !search) return;
  const term = (search.value || '').trim().toLocaleLowerCase('pt-BR');
  const filtered = restaurants.filter((restaurant) =>
    String(restaurant.businessName || '').toLocaleLowerCase('pt-BR').includes(term)
  );
  if (count) count.textContent = `${filtered.length} estabelecimento(s)`;

  list.innerHTML = filtered.length ? filtered.map((restaurant) => `
    <article class="restaurant-card">
      <div class="logo-mark" aria-hidden="true">
        <img src="assets/ameza-simbolo-oficial.png?v=1" alt="">
      </div>
      <div class="restaurant-card-copy">
        <p class="eyebrow">CARDÁPIO PARCEIRO</p>
        <h3>${escapeHtml(restaurant.businessName || 'Estabelecimento parceiro')}</h3>
        <p>Consulte os pratos, ingredientes e informações alimentares declaradas por este estabelecimento.</p>
        <a class="btn primary" href="menu.html?loja=${encodeURIComponent(restaurant.id)}">Ver cardápio →</a>
      </div>
    </article>
  `).join('') : '<div class="empty-state">Ainda não há estabelecimentos publicados. Volte em breve!</div>';
}

if (!list) {
  console.error('AMEZA: elemento #directory não encontrado.');
} else if (
  !config?.apiKey || config.apiKey.startsWith('PREENCHA_') ||
  !config?.projectId || config.projectId.startsWith('PREENCHA_')
) {
  setDirectoryMessage(
    '<div class="notice">O catálogo está pronto, mas a conexão com o Firebase ainda precisa ser configurada para exibir os estabelecimentos.</div>',
    'Configuração pendente'
  );
} else {
  setDirectoryMessage('<p class="muted">Carregando estabelecimentos…</p>', 'Carregando…');
  try {
    const [{ initializeApp }, { getFirestore, collection, getDocs, query, where }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js')
    ]);
    const app = initializeApp(config, 'ameza-public-directory');
    const db = getFirestore(app);
    const snapshot = await getDocs(query(collection(db, 'publicRestaurants'), where('active', '==', true)));
    restaurants = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.businessName || '').localeCompare(String(b.businessName || ''), 'pt-BR'));
    render();
  } catch (error) {
    console.error('AMEZA: falha ao carregar o catálogo.', error);
    setDirectoryMessage(
      '<div class="notice danger">Não foi possível carregar os estabelecimentos. Confira a conexão do Firebase e as permissões de leitura do catálogo.</div>',
      'Indisponível'
    );
  }
}

search?.addEventListener('input', render);
