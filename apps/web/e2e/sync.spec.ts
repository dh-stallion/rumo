import type { Browser, Page, TestInfo } from '@playwright/test';
import { SERVIDOR_E2E } from '../playwright.config';
import { expect, irPara, novaAtividade, test, TERCA } from './apoio';

/** Um segundo "aparelho": outro contexto de navegador, com as mesmas opções e relógio. */
async function outroAparelho(browser: Browser, info: TestInfo, agora: Date): Promise<Page> {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, colorScheme, baseURL } = info.project.use;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, colorScheme, baseURL });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(agora);
  await page.goto('/');
  return page;
}

async function conectar(page: Page, token = SERVIDOR_E2E.token, url = SERVIDOR_E2E.url) {
  await irPara(page, 'Ajustes');
  const form = page.getByRole('form', { name: 'Conectar ao servidor' });
  await form.getByLabel('Endereço do servidor').fill(url);
  await form.getByLabel('Token').fill(token);
  await form.getByRole('button', { name: 'Conectar' }).tap();
}

async function sincronizar(page: Page) {
  await irPara(page, 'Ajustes');
  await page.getByRole('button', { name: 'Sincronizar agora' }).tap();
  await expect(page.locator('[data-sync]')).toHaveAttribute('data-sync', 'ok');
}

const sufixo = () => Math.random().toString(36).slice(2, 7);

test('dois aparelhos: criar, editar e excluir se propagam', async ({ page, browser }, info) => {
  const nome = `Violão ${sufixo()}`;
  await page.goto('/');
  await novaAtividade(page, { nome, meta: 3 });
  await conectar(page);
  await expect(page.locator('[data-sync]')).toHaveAttribute('data-sync', 'ok');
  await expect(page.locator('[data-sync]')).toHaveText('Sincronizado agora');

  // Aparelho B recebe ao conectar.
  const b = await outroAparelho(browser, info, new Date(TERCA.getTime() + 60_000));
  await conectar(b);
  await expect(b.locator('[data-sync]')).toHaveAttribute('data-sync', 'ok');
  await irPara(b, 'Atividades');
  await expect(b.getByRole('button', { name: new RegExp(`^${nome}`) })).toBeVisible();

  // B edita (um minuto depois): a mudança sincroniza sozinha e A recebe.
  await b.getByRole('button', { name: new RegExp(`^${nome}`) }).tap();
  await b.getByRole('textbox', { name: 'Nome' }).fill(`${nome} (clássico)`);
  await b.getByRole('button', { name: 'Salvar' }).tap();
  // Sem tocar em nada no B: a sincronização automática (após a edição) leva a mudança.
  await expect
    .poll(
      async () => {
        await sincronizar(page);
        await irPara(page, 'Atividades');
        return page.getByRole('button', { name: new RegExp(`^${nome} \\(clássico\\)`) }).count();
      },
      { timeout: 15_000, intervals: [1000] },
    )
    .toBe(1);

  // A exclui (dois minutos depois): some de B.
  await page.clock.setFixedTime(new Date(TERCA.getTime() + 120_000));
  await page.getByRole('button', { name: new RegExp(`^${nome}`) }).tap();
  await page.getByRole('button', { name: 'Excluir atividade' }).tap();
  await sincronizar(page);
  await sincronizar(b);
  await irPara(b, 'Atividades');
  await expect(b.getByRole('button', { name: new RegExp(`^${nome}`) })).toHaveCount(0);
  await b.context().close();
});

test.describe('erros de conexão', () => {
  // O navegador registra no console as falhas de rede provocadas aqui.
  test.use({ errosPermitidos: /Failed to load resource|ERR_CONNECTION_REFUSED/ });

test('token errado e endereço errado mostram o motivo', async ({ page }) => {
  await page.goto('/');
  await conectar(page, 'token-errado-com-mais-de-16');
  await expect(page.getByRole('alert')).toHaveText('O servidor recusou o token.');
  await page.getByRole('form', { name: 'Conectar ao servidor' }).getByLabel('Endereço do servidor').fill('http://127.0.0.1:9');
  await page.getByRole('form', { name: 'Conectar ao servidor' }).getByLabel('Token').fill(SERVIDOR_E2E.token);
  await page.getByRole('button', { name: 'Conectar' }).tap();
  await expect(page.getByRole('alert')).toHaveText('Não foi possível falar com o servidor. Confira o endereço e a conexão.');
});
});

test('mostra o endereço do calendário assinável e desconecta', async ({ page }) => {
  await page.goto('/');
  await conectar(page);
  await expect(page.locator('[data-feed]')).toHaveText(/^webcal:\/\/127\.0\.0\.1:8799\/feed\/[0-9a-f]{32}\.ics$/);
  await expect(page.locator('[data-feed]')).not.toContainText(SERVIDOR_E2E.token);
  await page.getByRole('button', { name: 'Desconectar do servidor' }).tap();
  await expect(page.getByRole('form', { name: 'Conectar ao servidor' })).toBeVisible();
});
