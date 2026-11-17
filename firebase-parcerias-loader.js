// Inicializa a área de parcerias e apresenta falhas de carregamento sem deixar a tela presa.
(() => {
  const status = document.getElementById('firebase-status') || document.getElementById('account-status');
  const setup = document.getElementById('setup');
  const authForms = document.getElementById('auth-forms');
  const adminLogin = document.getElementById('admin-login');
  const config = window.AMEZA_FIREBASE_CONFIG || {};
  const hasValue = (value) => {
    if (typeof value !== 'string') return false;
    const clean = value.trim();
    return clean.length > 0 && !clean.startsWith('PREENCHA_')
      && !clean.startsWith('YOUR_') && !clean.includes('{{') && !clean.startsWith('<');
  };
  const configured = ['apiKey', 'authDomain', 'projectId', 'appId']
    .every((key) => hasValue(config[key]));
  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.className = isError ? 'alert error' : 'muted';
  };
  if (!configured) {
    setup?.classList.remove('hidden');
    authForms?.classList.add('hidden');
    adminLogin?.classList.add('hidden');
    setStatus('Configuração pendente: o projeto Firebase exclusivo da AMEZA ainda não foi configurado.', true);
    return;
  }
  let settled = false;
  setStatus('Carregando a integração segura com o Firebase…');
  const timeout = window.setTimeout(() => {
    if (settled) return;
    setStatus(navigator.onLine
      ? 'A conexão está demorando para responder. Confira a internet e atualize a página.'
      : 'Sem conexão com a internet. Reconecte-se e atualize a página.');
  }, 12000);
  window.addEventListener('ameza:firebase-ready', () => {
    settled = true;
    window.clearTimeout(timeout);
  }, { once: true });
  window.addEventListener('offline', () => {
    if (!settled) setStatus('Sem conexão com a internet. Reconecte-se e atualize a página.');
  });
  window.addEventListener('online', () => {
    if (!settled) setStatus('Internet restabelecida. Atualize a página para tentar novamente.');
  });
  import('./firebase-parcerias.js').catch((error) => {
    settled = true;
    window.clearTimeout(timeout);
    setStatus('Não foi possível carregar o módulo de parcerias do Firebase. Confira sua conexão e atualize a página.', true);
    console.error('Falha ao carregar firebase-parcerias.js:', error);
  });
})();