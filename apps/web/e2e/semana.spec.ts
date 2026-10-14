import { expect, irPara, novoEvento, test } from './apoio';
import { centro, diasVisiveis, gestos } from './toque';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('grade da semana', () => {
  test('abre com 3 dias, começando hoje, e desliza encaixando por dia', async ({ page }) => {
    await irPara(page, 'Semana');
    await expect(page.getByText('12 – 18 de outubro')).toBeVisible();
    await expect.poll(() => diasVisiveis(page)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);

    // Deslizar o dedo para a esquerda leva aos dias seguintes, encaixando numa coluna.
    const toque = await gestos(page);
    const grade = await centro(page.locator('[data-grade]'));
    await toque.deslizar({ x: grade.x + 100, y: grade.y }, { x: grade.x - 60, y: grade.y });
    await expect.poll(() => diasVisiveis(page)).toHaveLength(3);
    const depois = await diasVisiveis(page);
    expect(depois[0]! > '2026-10-13').toBe(true);
  });

  test('navega entre semanas e volta para hoje', async ({ page }) => {
    await irPara(page, 'Semana');
    await page.getByRole('button', { name: 'Semana seguinte' }).tap();
    await expect(page.getByText('19 – 25 de outubro')).toBeVisible();
    await expect.poll(() => diasVisiveis(page)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    await page.getByRole('button', { name: 'Semana anterior' }).tap();
    await page.getByRole('button', { name: 'Semana anterior' }).tap();
    await expect(page.getByText('5 – 11 de outubro')).toBeVisible();
    await page.getByRole('button', { name: 'Hoje' }).tap();
    await expect(page.getByText('12 – 18 de outubro')).toBeVisible();
  });

  test('respeita o início de semana configurado', async ({ page }) => {
    await irPara(page, 'Ajustes');
    await page.getByRole('radio', { name: 'Domingo' }).tap();
    // O estado marcado vem do IndexedDB: espera a gravação antes de seguir.
    await expect(page.getByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');
    await irPara(page, 'Semana');
    await expect(page.getByText('11 – 17 de outubro')).toBeVisible();
    await expect(page.locator('[data-dia]').first()).toHaveAttribute('data-dia', '2026-10-11');
  });

  test('evento fixo aparece travado e abre para editar', async ({ page }) => {
    await novoEvento(page, { titulo: 'Dentista', data: '2026-10-14', inicio: '15:00', fim: '16:00' });
    const bloco = page.getByRole('button', { name: 'Dentista, 15:00–16:00, fixo' });
    await expect(bloco).toBeVisible();
    await bloco.tap();
    await expect(page.getByRole('dialog', { name: 'Editar evento' })).toBeVisible();
  });

  test('a antiga aba Agenda redireciona para Semana', async ({ page }) => {
    await page.goto('/agenda');
    await expect(page).toHaveURL(/\/semana$/);
    await expect(page.getByRole('heading', { name: 'Semana' })).toBeVisible();
  });
});
