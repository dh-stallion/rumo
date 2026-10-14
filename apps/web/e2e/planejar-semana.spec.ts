import type { Page } from '@playwright/test';
import { expect, irPara, novaAtividade, test } from './apoio';
import { centro, diasVisiveis, gestos, pontoNaGrade, rolarGradePara } from './toque';

const convite = (page: Page) => page.getByRole('region', { name: 'Convite para planejar a semana' });

/** Muda o relógio fixo (horário de São Paulo) e recarrega, como reabrir o app. */
async function reabrirEm(page: Page, quandoSP: string) {
  await page.clock.setFixedTime(new Date(`${quandoSP}-03:00`));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hoje' })).toBeVisible();
}

test('convite aparece uma vez por semana, some ao dispensar e volta na semana seguinte', async ({ page }) => {
  await page.goto('/');
  await expect(convite(page)).toContainText('Semana nova: planejar?');

  await convite(page).getByRole('button', { name: 'Dispensar convite' }).tap();
  await expect(convite(page)).toBeHidden();

  // Reabrir na mesma semana (inclusive domingo à noite, que já é segunda em UTC): continua dispensado.
  await reabrirEm(page, '2026-10-14T08:00');
  await expect(convite(page)).toBeHidden();
  await reabrirEm(page, '2026-10-18T23:59');
  await expect(convite(page)).toBeHidden();

  // Segunda 00:00 em São Paulo: semana nova, convite de volta.
  await reabrirEm(page, '2026-10-19T00:00');
  await expect(convite(page)).toBeVisible();
});

test('com a semana começando no domingo, o convite volta no domingo', async ({ page }) => {
  await page.goto('/');
  await irPara(page, 'Ajustes');
  await page.getByRole('radio', { name: 'Domingo' }).tap();
  // O estado marcado vem do IndexedDB: espera a gravação antes de seguir.
  await expect(page.getByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');
  await irPara(page, 'Hoje');
  await convite(page).getByRole('button', { name: 'Dispensar convite' }).tap();
  await reabrirEm(page, '2026-10-17T23:59'); // sábado
  await expect(convite(page)).toBeHidden();
  await reabrirEm(page, '2026-10-18T00:00'); // domingo
  await expect(convite(page)).toBeVisible();
});

test('pode ser desligado nos Ajustes', async ({ page }) => {
  await page.goto('/');
  await expect(convite(page)).toBeVisible();
  await irPara(page, 'Ajustes');
  await page.getByRole('switch', { name: /Convite para planejar a semana/ }).tap();
  await irPara(page, 'Hoje');
  await expect(convite(page)).toBeHidden();
  await reabrirEm(page, '2026-10-19T09:00');
  await expect(convite(page)).toBeHidden();
});

test('"Planejar" abre a semana toda em 7 colunas, com arraste e fluxo sem arrastar', async ({ page }) => {
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  await irPara(page, 'Hoje');
  await convite(page).getByRole('button', { name: 'Planejar' }).tap();

  await expect(page).toHaveURL(/\/semana\?planejar=1$/);
  await expect(page.getByRole('heading', { name: 'Planejar a semana' })).toBeVisible();
  await expect.poll(() => diasVisiveis(page)).toEqual([
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
  ]);

  // Arraste por toque longo do banco até sexta 18:00.
  await rolarGradePara(page, 16);
  await page.getByRole('button', { name: 'Banco de afazeres' }).tap();
  const banco = page.getByRole('region', { name: 'Banco de afazeres' });
  await expect.poll(() => banco.evaluate((el) => el.getAnimations().length)).toBe(0);
  const toque = await gestos(page);
  const de = await centro(banco.getByRole('button', { name: /^Violão,/ }));
  await toque.pressionar(de);
  await toque.esperar(400);
  await toque.moverPara({ x: de.x, y: de.y - 40 }, 4);
  const sexta = await pontoNaGrade(page, '2026-10-16', '18:00');
  await toque.moverPara({ x: sexta.x, y: sexta.y + 10 });
  await toque.soltar();
  await expect(page.locator('[data-dia="2026-10-16"]').getByRole('button', { name: 'Violão, 18:00–18:30, planejado' })).toBeVisible();

  // Fluxo sem arrastar continua disponível.
  await page.getByRole('button', { name: 'Banco de afazeres' }).tap();
  await expect.poll(() => banco.evaluate((el) => el.getAnimations().length)).toBe(0);
  await banco.getByRole('button', { name: /^Violão,/ }).tap();
  const folha = page.getByRole('dialog', { name: 'Agendar Violão' });
  await folha.getByRole('radio', { name: 'sábado, 17 de outubro' }).tap();
  await folha.getByLabel('Horário').fill('10:00');
  await folha.getByRole('button', { name: 'Agendar' }).tap();
  await expect(page.locator('[data-dia="2026-10-17"]').getByRole('button', { name: 'Violão, 10:00–10:30, planejado' })).toBeAttached();

  // Voltar para 3 dias.
  await page.getByRole('button', { name: 'Ver 3 dias' }).tap();
  await expect(page).toHaveURL(/\/semana$/);
  await expect.poll(() => diasVisiveis(page)).toHaveLength(3);

  // Em Hoje, o convite já foi tratado nesta semana.
  await irPara(page, 'Hoje');
  await expect(convite(page)).toBeHidden();
});

test('"Ver semana toda" também abre pela aba Semana', async ({ page }) => {
  await page.goto('/semana');
  await page.getByRole('button', { name: 'Ver semana toda' }).tap();
  await expect(page.getByRole('heading', { name: 'Planejar a semana' })).toBeVisible();
  await expect.poll(() => diasVisiveis(page)).toHaveLength(7);
});
