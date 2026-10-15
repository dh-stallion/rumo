/* Notificações do Rumo (importado pelo service worker gerado pelo vite-plugin-pwa). */

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Rumo', {
      body: dados.corpo || '',
      // Mesma tag substitui em vez de empilhar (ex.: o resumo do dia).
      tag: dados.tag || undefined,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: dados.url || '/' },
    }),
  );
});

// Tocar na notificação abre (ou traz para frente) o app na tela do lembrete.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const janela = janelas.find((j) => j.url.startsWith(self.location.origin));
      if (janela) return janela.focus().then((j) => (j && 'navigate' in j ? j.navigate(url) : j));
      return self.clients.openWindow(url);
    }),
  );
});
