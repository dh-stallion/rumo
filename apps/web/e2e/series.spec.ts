import type { Page } from '@playwright/test';
import { expect, irPara, test } from './apoio';

const bloco = (page: Page, dia: string, nome: string | RegExp) =>
  page.locator(`[data-dia="${dia}"]`).getByRole('button', { name: nome });

/** Aula toda terça e quinta, 19:00–21:00, a partir de 13/10. */
async function criarAula(page: Page) {
  await irPara(page, 'Semana');
  await page.getByRole('button', { name: 'Novo evento' }).tap();
  const folha = page.getByRole('dialog', { name: 'Novo evento' });
  await folha.getByRole('textbox', { name: 'Título' }).fill('Aula');
  await folha.getByLabel('Data').fill('2026-10-13');
  await folha.getByLabel('Início').fill('19:00');
  await folha.getByLabel('Fim').fill('21:00');
  await folha.getByLabel('Repetir').selectOption({ label: 'Toda semana' });
  await expect(folha.getByRole('button', { name: 'terça' })).toHaveAttribute('aria-pressed', 'true');
  await folha.getByRole('button', { name: 'quinta' }).tap();
  await expect(folha.locator('[data-resumo-repeticao]')).toHaveText('Toda semana: ter, qui');
  await folha.getByRole('button', { name: 'Salvar' }).tap();
  await expect(folha).toBeHidden();
}

async function abrirOcorrencia(page: Page, dia: string) {
  await bloco(page, dia, /^Aula/).first().tap();
  return page.getByRole('dialog', { name: 'Editar evento' });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await criarAula(page);
});

test('a série aparece em todas as semanas e em Próximos compromissos', async ({ page }) => {
  await expect(bloco(page, '2026-10-13', 'Aula, 19:00–21:00, fixo, repete')).toBeAttached();
  await expect(bloco(page, '2026-10-15', 'Aula, 19:00–21:00, fixo, repete')).toBeAttached();
  await page.getByRole('button', { name: 'Semana seguinte' }).tap();
  await expect(bloco(page, '2026-10-20', /^Aula/)).toBeAttached();
  await expect(bloco(page, '2026-10-22', /^Aula/)).toBeAttached();

  await irPara(page, 'Hoje');
  await expect(page.getByRole('button', { name: /19:00\s*Aula/ }).first()).toBeVisible(); // hoje, terça, no topo
  const proximos = page.getByRole('region', { name: 'Próximos compromissos' });
  await expect(proximos.getByRole('heading', { level: 3 })).toHaveText(['Quinta, 15/10', 'Terça, 20/10']);
  await expect(proximos.getByRole('img', { name: 'Repete' })).toHaveCount(2);
});

test('só este: muda uma ocorrência e mantém as outras', async ({ page }) => {
  const folha = await abrirOcorrencia(page, '2026-10-15');
  await expect(folha.getByLabel('Repetir')).toHaveValue('semanal');
  await folha.getByRole('textbox', { name: 'Título' }).fill('Aula (sala 2)');
  await folha.getByRole('button', { name: 'Salvar' }).tap();
  await folha.getByRole('button', { name: 'Só este evento' }).tap();
  await expect(bloco(page, '2026-10-15', /^Aula \(sala 2\)/)).toBeAttached();
  await expect(bloco(page, '2026-10-13', /^Aula, /)).toBeAttached();
  await page.getByRole('button', { name: 'Semana seguinte' }).tap();
  await expect(bloco(page, '2026-10-22', /^Aula, /)).toBeAttached();
});

test('este e os seguintes: a partir da próxima semana, outro horário', async ({ page }) => {
  await page.getByRole('button', { name: 'Semana seguinte' }).tap();
  const folha = await abrirOcorrencia(page, '2026-10-20');
  await folha.getByLabel('Início').fill('18:00');
  await folha.getByLabel('Fim').fill('20:00');
  await folha.getByRole('button', { name: 'Salvar' }).tap();
  await folha.getByRole('button', { name: 'Este e os seguintes' }).tap();
  await expect(bloco(page, '2026-10-20', 'Aula, 18:00–20:00, fixo, repete')).toBeAttached();
  await expect(bloco(page, '2026-10-22', 'Aula, 18:00–20:00, fixo, repete')).toBeAttached();
  await page.getByRole('button', { name: 'Semana anterior' }).tap();
  await expect(bloco(page, '2026-10-15', 'Aula, 19:00–21:00, fixo, repete')).toBeAttached();
});

test('todos: muda a série inteira; desfazer volta', async ({ page }) => {
  const folha = await abrirOcorrencia(page, '2026-10-15');
  await folha.getByRole('textbox', { name: 'Título' }).fill('Inglês');
  await folha.getByRole('button', { name: 'Salvar' }).tap();
  await folha.getByRole('button', { name: 'Todos os eventos' }).tap();
  await expect(bloco(page, '2026-10-13', /^Inglês/)).toBeAttached();
  await expect(bloco(page, '2026-10-15', /^Inglês/)).toBeAttached();
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(bloco(page, '2026-10-13', /^Aula/)).toBeAttached();
});

test('remover só este pula a ocorrência; desfazer devolve', async ({ page }) => {
  const folha = await abrirOcorrencia(page, '2026-10-15');
  await folha.getByRole('button', { name: 'Remover evento' }).tap();
  await folha.getByRole('button', { name: 'Só este evento' }).tap();
  await expect(bloco(page, '2026-10-15', /^Aula/)).toHaveCount(0);
  await expect(bloco(page, '2026-10-13', /^Aula/)).toBeAttached();
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(bloco(page, '2026-10-15', /^Aula/)).toBeAttached();
});

test('mudar a repetição tira a opção "só este"', async ({ page }) => {
  const folha = await abrirOcorrencia(page, '2026-10-15');
  await folha.getByLabel('Repetir').selectOption('mensal-semana');
  await expect(folha.locator('[data-resumo-repeticao]')).toHaveText('Todo mês na 3ª quinta');
  await folha.getByRole('button', { name: 'Salvar' }).tap();
  await expect(folha.getByRole('button', { name: 'Só este evento' })).toHaveCount(0);
  await expect(folha.getByText('Como a repetição mudou, a mudança vale para a série.')).toBeVisible();
  await folha.getByRole('button', { name: 'Voltar' }).tap();
  await expect(folha.getByRole('textbox', { name: 'Título' })).toBeVisible();
});
