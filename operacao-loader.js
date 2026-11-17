// Inicializa o painel do restaurante sem manter "Conectando..." indefinidamente.
(() => {
  const status = document.getElementById('session');
  const setup = document.getElementById('setup');
  const signIn = document.getElementById('signin');
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
    if (status) {
      status.textContent = message;
      status.className = isError ? 'alert error' : 'muted';
    }
  };
  if (!configured) {
    setup?.classList.remove('hidden');
    signIn?.classList.add('hidden');
    setStatus('Configuração pendente: preencha config.js com os dados do projeto Firebase exclusivo da AMEZA.');
    return;
  }
  let settled = false;
  setStatus('Carregando o painel do restaurante…');
  const timeout = window.setTimeout(() => {
    if (settled) return;
    setStatus(navigator.onLine
      ? 'O painel ainda não conseguiu iniciar. Confira a internet e atualize a página.'
      : 'Sem conexão com a internet. Reconecte-se e atualize a página.');
  }, 12000);
  window.addEventListener('ameza:operacao-ready', () => {
    settled = true;
    window.clearTimeout(timeout);
  }, { once: true });
  window.addEventListener('offline', () => {
    if (!settled) setStatus('Sem conexão com a internet. Reconecte-se e atualize a página.');
  });
  window.addEventListener('online', () => {
    if (!settled) setStatus('Internet restabelecida. Atualize a página para tentar novamente.');
  });
  import('./operacao.js').catch((error) => {
    settled = true;
    window.clearTimeout(timeout);
    setStatus('Não foi possível carregar o painel do restaurante. Confira sua conexão e atualize a página.', true);
    console.error('Falha ao carregar operacao.js:', error);
  });
})();