import type { Page } from '@playwright/test';
import { SERVIDOR_E2E } from '../playwright.config';
import { expect, irPara, test } from './apoio';

/**
 * O Edge sem interface não fala com um serviço de push real; simulamos só o PushManager.
 * Permissão, service worker, inscrição no servidor e preferências são reais.
 */
async function pushSimulado(page: Page) {
  await page.context().grantPermissions(['notifications'], { origin: 'http://localhost:4173' });
  await page.addInitScript(() => {
    let atual: object | null = null;
    const endpoint = `https://push.exemplo.invalid/aparelho-${Math.random().toString(36).slice(2)}`;
    const falsa = {
      endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh', auth: 'auth' } }),
      unsubscribe: async () => {
        atual = null;
        return true;
      },
    };
    PushManager.prototype.getSubscription = async () => atual as PushSubscription | null;
    PushManager.prototype.subscribe = async () => {
      atual = falsa;
      return falsa as unknown as PushSubscription;
    };
  });
}

async function conectar(page: Page) {
  await irPara(page, 'Ajustes');
  const form = page.getByRole('form', { name: 'Conectar ao servidor' });
  await form.getByLabel('Endereço do servidor').fill(SERVIDOR_E2E.url);
  await form.getByLabel('Token').fill(SERVIDOR_E2E.token);
  await form.getByRole('button', { name: 'Conectar' }).tap();
  await expect(page.locator('[data-sync]')).toHaveAttribute('data-sync', 'ok');
}

test('ativar, testar e desativar notificações neste aparelho', async ({ page }) => {
  await pushSimulado(page);
  await page.goto('/');
  await conectar(page);
  const status = page.locator('[data-push]');
  await expect(status).toHaveText('Desativadas neste aparelho.');

  await page.getByRole('button', { name: 'Ativar notificações' }).tap();
  await expect(page.getByText('Notificações ativadas')).toBeVisible();
  // "Ativas" só aparece se o servidor confirmar que tem a inscrição deste aparelho.
  await expect(status).toHaveText('Ativas neste aparelho.');

  // O endereço simulado não existe: o servidor tenta e informa que nada chegou.
  await page.getByRole('button', { name: 'Enviar teste' }).tap();
  await expect(page.getByText('Nenhum aparelho recebeu o teste')).toBeVisible();

  await page.getByRole('button', { name: 'Desativar notificações' }).tap();
  await expect(status).toHaveText('Desativadas neste aparelho.');
});

test('preferências dos lembretes sincronizam com o servidor', async ({ page, request }) => {
  // O servidor é compartilhado entre testes e repetições: relógio real (sem empate de horário
  // entre execuções) e valores calculados a partir do que já está lá.
  await page.clock.setFixedTime(new Date());
  await page.goto('/');
  await conectar(page);
  const secao = page.getByLabel('Notificações');
  const hora = `07:${String(10 + Math.floor(Math.random() * 50)).padStart(2, '0')}`;
  const contato = secao.getByRole('switch', { name: /Contato com pessoas/ });
  const contatoAntes = (await contato.getAttribute('aria-checked')) === 'true';
  const antes = secao.getByRole('group', { name: 'Quanto tempo antes' });
  const minutosAntes = Number((await antes.textContent())!.match(/(\d+) min/)![1]);
  const minutos = minutosAntes >= 120 ? minutosAntes - 5 : minutosAntes + 5;

  await secao.getByLabel('Horário do resumo').fill(hora);
  await contato.tap();
  await antes.getByRole('button', { name: minutosAntes >= 120 ? 'Diminuir' : 'Aumentar' }).tap();
  await expect(antes).toContainText(`${minutos} min`);

  // A mudança sincroniza sozinha; o servidor passa a usar essas escolhas.
  await expect
    .poll(
      async () => {
        const r = await request.get(`${SERVIDOR_E2E.url}/api/backup`, { headers: { authorization: `Bearer ${SERVIDOR_E2E.token}` } });
        const prefs = (await r.json()).tabelas.preferencias as { notificacoes: object; atualizadoEm: string }[];
        return prefs.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0]?.notificacoes;
      },
      { timeout: 15_000 },
    )
    .toMatchObject({ horaResumo: hora, minutosAntes: minutos, contatos: !contatoAntes });

  await page.reload();
  await irPara(page, 'Ajustes');
  await expect(page.getByLabel('Notificações').getByLabel('Horário do resumo')).toHaveValue(hora);
});

test('o service worker mostra a notificação recebida e usa a tag', async ({ page }) => {
  await page.context().grantPermissions(['notifications'], { origin: 'http://localhost:4173' });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await page.context().newCDPSession(page);
  const registros: { registrationId: string; scopeURL: string }[] = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => registros.push(...e.registrations));
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => registros.length).toBeGreaterThan(0);
  const registro = registros.find((r) => r.scopeURL.startsWith('http://localhost:4173'))!;

  const entregar = (dados: object) =>
    cdp.send('ServiceWorker.deliverPushMessage', { origin: 'http://localhost:4173', registrationId: registro.registrationId, data: JSON.stringify(dados) });
  await entregar({ titulo: 'Seu dia', corpo: '2 coisas pedem atenção', url: '/', tag: 'resumo:2026-10-13' });
  await entregar({ titulo: 'Seu dia', corpo: '3 coisas pedem atenção', url: '/', tag: 'resumo:2026-10-13' });
  await entregar({ titulo: 'Dentista', corpo: 'Às 15:00 (em 15 minutos)', url: '/semana', tag: 'evento:x' });

  const notificacoes = () =>
    page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title} | ${n.body} | ${n.tag} | ${(n.data as { url: string }).url}`));
  // Mesma tag substitui: o resumo aparece uma vez só, com o texto mais novo.
  // (A substituída vai para o fim da lista; a ordem não importa.)
  await expect.poll(async () => (await notificacoes()).sort()).toEqual(['Dentista | Às 15:00 (em 15 minutos) | evento:x | /semana', 'Seu dia | 3 coisas pedem atenção | resumo:2026-10-13 | /']);
});
