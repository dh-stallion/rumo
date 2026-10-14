import type { Page } from '@playwright/test';
import { expect, irPara, test } from './apoio';

const situacao = (page: Page) => page.locator('[data-progresso-meta]').first().locator('[data-situacao]');

async function registrar(page: Page, valor: string, tipo: 'Aporte' | 'Retirada' = 'Aporte') {
  await page.getByRole('button', { name: 'Registrar aporte' }).tap();
  const f = page.getByRole('dialog', { name: 'Registrar aporte' });
  await f.getByRole('radio', { name: tipo }).tap();
  await f.getByRole('textbox', { name: 'Valor' }).fill(valor);
  await f.getByRole('button', { name: 'Registrar' }).tap();
  await expect(f).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('meta em reais para comprar euros: aporte mensal e semanal, aportes e retiradas', async ({ page }) => {
  await irPara(page, 'Planos');
  await page.getByRole('button', { name: 'Nova meta' }).tap();
  const f = page.getByRole('dialog', { name: 'Nova meta' });
  await f.getByRole('textbox', { name: 'Nome' }).fill('Euros para a viagem');
  await expect(f.getByRole('button', { name: 'Criar meta' })).toBeDisabled(); // sem alvo
  await f.getByRole('textbox', { name: 'Quanto quer juntar' }).fill('18.000');
  await expect(f.getByLabel('Até quando')).toHaveValue('2026-12-31');
  await f.getByRole('button', { name: 'Criar meta' }).tap();

  await expect(page.getByRole('heading', { name: 'Euros para a viagem' })).toBeVisible();
  await expect(situacao(page)).toHaveText('Guarde R$ 6.000,00/mês · R$ 1.500,00/semana');

  await registrar(page, '4.000');
  await expect(page.locator('[data-progresso-meta]')).toContainText('R$ 4.000de R$ 18.000');
  await expect(situacao(page)).toHaveText('Guarde R$ 4.666,67/mês · R$ 1.166,67/semana');
  await expect(page.getByRole('progressbar', { name: 'Progresso da meta' })).toHaveAttribute('aria-valuenow', '22');

  await registrar(page, '500', 'Retirada');
  await expect(page.locator('[data-progresso-meta]')).toContainText('R$ 3.500');
  await page.getByRole('button', { name: 'Remover aporte de R$ 500,00' }).tap();
  await expect(page.locator('[data-progresso-meta]')).toContainText('R$ 4.000');
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(page.locator('[data-progresso-meta]')).toContainText('R$ 3.500');

  // Na lista de metas.
  await page.getByRole('link', { name: 'Planos' }).first().tap();
  await expect(page.getByRole('link', { name: 'Euros para a viagem' })).toContainText('Guarde R$ 4.833,34/mês');
});

test('meta do NAS pela soma dos itens do projeto acompanha os preços', async ({ page }) => {
  await irPara(page, 'Planos');
  await page.getByRole('button', { name: 'Novo projeto' }).tap();
  await page.getByRole('textbox', { name: 'Nome' }).fill('Montar um NAS');
  await page.getByRole('button', { name: 'Criar projeto' }).tap();
  for (const [nome, preco] of [
    ['Gabinete', '1.500'],
    ['2× HD 8 TB', '2.200'],
  ]) {
    await page.getByRole('button', { name: 'Adicionar item' }).tap();
    const f = page.getByRole('dialog', { name: 'Novo item' });
    await f.getByRole('textbox', { name: 'Nome' }).fill(nome!);
    await f.getByRole('textbox', { name: 'Preço' }).fill(preco!);
    await f.getByRole('button', { name: 'Salvar' }).tap();
    await expect(f).toBeHidden();
  }

  await page.getByRole('button', { name: 'Criar meta para este projeto' }).tap();
  const f = page.getByRole('dialog', { name: 'Nova meta' });
  await expect(f.getByLabel('Projeto (opcional)')).toHaveValue(/.+/);
  await expect(f.getByRole('switch', { name: /Alvo = soma dos itens do projeto/ })).toHaveAttribute('aria-checked', 'true');
  await expect(f).toContainText('Hoje: R$ 3.700,00');
  await f.getByRole('textbox', { name: 'Nome' }).fill('NAS');
  await f.getByLabel('Até quando').fill('2027-03-31');
  await f.getByRole('textbox', { name: 'Já tenho guardado' }).fill('500');
  await f.getByRole('button', { name: 'Criar meta' }).tap();

  await expect(page.getByRole('heading', { name: 'NAS' })).toBeVisible();
  await expect(page.locator('[data-progresso-meta]')).toContainText('R$ 500de R$ 3.700');
  await expect(situacao(page)).toHaveText('Guarde R$ 533,34/mês · R$ 128,00/semana');
  await expect(page.getByText('alvo pela soma dos itens')).toBeVisible();

  // Preço muda no projeto → alvo da meta muda.
  await page.getByRole('link', { name: 'Montar um NAS' }).tap();
  await page.getByRole('button', { name: /^2× HD 8 TB/ }).tap();
  const item = page.getByRole('dialog', { name: 'Editar item' });
  await item.getByRole('textbox', { name: 'Preço' }).fill('2.500');
  await item.getByRole('button', { name: 'Salvar' }).tap();
  const cartao = page.getByRole('link', { name: 'NAS', exact: true });
  await expect(cartao).toContainText('de R$ 4.000');
});

test('Planos mostra projetos e metas na mesma página, sem seletor', async ({ page }) => {
  await irPara(page, 'Planos');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Projetos' }).getByRole('button', { name: 'Novo projeto' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Metas' }).getByRole('button', { name: 'Nova meta' })).toBeVisible();
});
