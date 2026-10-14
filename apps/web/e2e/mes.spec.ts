import type { Page } from '@playwright/test';
import { expect, irPara, novaAtividade, test } from './apoio';
import { diasVisiveis } from './toque';

const celula = (page: Page, data: string) => page.locator(`[role="gridcell"][data-data="${data}"]`);

async function abrirMes(page: Page) {
  await irPara(page, 'Calendário');
  await page.getByRole('radio', { name: 'Mês' }).tap();
  await expect(page.getByRole('heading', { name: 'Outubro' })).toBeVisible();
}

async function criarAulaSemanal(page: Page) {
  await page.getByRole('button', { name: 'Novo evento' }).tap();
  const folha = page.getByRole('dialog', { name: 'Novo evento' });
  await folha.getByRole('textbox', { name: 'Título' }).fill('Aula');
  await folha.getByLabel('Data').fill('2026-10-13');
  await folha.getByLabel('Início').fill('19:00');
  await folha.getByLabel('Fim').fill('21:00');
  await folha.getByLabel('Repetir').selectOption({ label: 'Toda semana' });
  await folha.getByRole('button', { name: 'quinta' }).tap();
  await folha.getByRole('button', { name: 'Salvar' }).tap();
  await expect(folha).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('mostra o mês com semanas completas e hoje selecionado', async ({ page }) => {
  await abrirMes(page);
  await expect(page.getByText('2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell')).toHaveCount(35); // 28/09 a 01/11
  await expect(page.getByRole('columnheader').first()).toHaveText('seg');
  await expect(celula(page, '2026-10-13')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByText('Nada marcado neste dia.')).toBeVisible();
});

test('marca eventos recorrentes e sessões; tocar no dia lista e abre', async ({ page }) => {
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  await irPara(page, 'Calendário');
  await criarAulaSemanal(page);
  // Sessão planejada na sexta pelo fluxo sem arrastar.
  await page.getByRole('button', { name: 'Banco de afazeres' }).tap();
  await page.getByRole('region', { name: 'Banco de afazeres' }).getByRole('button', { name: /^Violão,/ }).tap();
  const agendar = page.getByRole('dialog', { name: 'Agendar Violão' });
  await agendar.getByRole('radio', { name: 'sexta-feira, 16 de outubro' }).tap();
  await agendar.getByLabel('Horário').fill('08:00');
  await agendar.getByRole('button', { name: 'Agendar' }).tap();

  await page.getByRole('radio', { name: 'Mês' }).tap();
  for (const d of ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29']) {
    await expect(celula(page, d)).toHaveAttribute('aria-label', /1 item$/);
  }
  await expect(celula(page, '2026-10-16')).toHaveAttribute('aria-label', /1 item$/);
  await expect(celula(page, '2026-10-14')).not.toHaveAttribute('aria-label', /item/);
  await expect(celula(page, '2026-10-08')).not.toHaveAttribute('aria-label', /item/); // antes do início da série

  await celula(page, '2026-10-22').tap();
  const dia = page.getByRole('region', { name: 'Dia selecionado: Quinta, 22/10' });
  await expect(dia.getByRole('button', { name: /19:00\s*Aula/ })).toBeVisible();
  await dia.getByRole('button', { name: /19:00\s*Aula/ }).tap();
  await expect(page.getByRole('dialog', { name: 'Editar evento' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).tap();

  await celula(page, '2026-10-16').tap();
  await page.getByRole('button', { name: /08:00\s*Violão\s*planejado/ }).tap();
  await expect(page.getByRole('dialog', { name: 'Violão' })).toBeVisible();
});

test('navega entre meses e volta para hoje', async ({ page }) => {
  await abrirMes(page);
  await page.getByRole('button', { name: 'Mês seguinte' }).tap();
  await expect(page.getByRole('heading', { name: 'Novembro' })).toBeVisible();
  await page.getByRole('button', { name: 'Mês seguinte' }).tap();
  await page.getByRole('button', { name: 'Mês seguinte' }).tap();
  await expect(page.getByRole('heading', { name: 'Janeiro' })).toBeVisible();
  await expect(page.getByText('2027', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoje' }).tap();
  await expect(page.getByRole('heading', { name: 'Outubro' })).toBeVisible();
});

test('"Ver na semana" abre a semana do dia, com ele à vista', async ({ page }) => {
  await abrirMes(page);
  await celula(page, '2026-10-29').tap();
  await page.getByRole('button', { name: 'Ver na semana' }).tap();
  await expect(page.getByRole('heading', { name: 'Semana' })).toBeVisible();
  await expect(page.getByText('26 de outubro – 1 de novembro')).toBeVisible();
  await expect.poll(() => diasVisiveis(page)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
});

test('respeita o início de semana no domingo', async ({ page }) => {
  await irPara(page, 'Ajustes');
  await page.getByRole('radio', { name: 'Domingo' }).tap();
  await expect(page.getByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');
  await abrirMes(page);
  await expect(page.getByRole('columnheader').first()).toHaveText('dom');
  await expect(page.getByRole('gridcell').first()).toHaveAttribute('data-data', '2026-09-27');
});
