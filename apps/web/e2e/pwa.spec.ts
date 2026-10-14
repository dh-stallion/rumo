import { expect, irPara, novaAtividade, test } from './apoio';

test('persiste, funciona offline e troca de tema', async ({ page, context }) => {
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão' });

  await page.reload();
  await expect(page.getByText('Violão')).toBeVisible();

  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Violão')).toBeVisible();
  await context.setOffline(false);

  await irPara(page, 'Ajustes');
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  await page.getByRole('radio', { name: 'Claro' }).tap();
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
});

test('áreas de toque de pelo menos 44px em todas as abas', async ({ page }) => {
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  for (const aba of ['Hoje', 'Semana', 'Atividades', 'Pessoas', 'Ajustes'] as const) {
    await irPara(page, aba);
    await page.waitForLoadState('networkidle');
    const pequenos = await page.evaluate(() =>
      // Blocos da grade têm a altura da duração (15 min = 14px); a alternativa acessível é a folha da sessão.
      [...document.querySelectorAll('button:not([data-bloco]), a, input, select')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
        .map(({ el, r }) => `${el.textContent?.trim() || el.getAttribute('aria-label')} ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(pequenos, `aba ${aba}`).toEqual([]);
  }
});
