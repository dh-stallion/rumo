import type { Page } from '@playwright/test';
import { card, cards, expect, irPara, novaAtividade, test } from './apoio';

/** Agenda pelo fluxo sem arrastar (banco → folha). */
async function agendar(page: Page, nome: string, dia: string, hora: string) {
  await irPara(page, 'Calendário');
  const botao = page.getByRole('button', { name: 'Banco de afazeres' });
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.tap();
  const banco = page.getByRole('region', { name: 'Banco de afazeres' });
  await expect.poll(() => banco.evaluate((el) => el.getAnimations().length)).toBe(0);
  await banco.getByRole('button', { name: new RegExp(`^${nome},`) }).tap();
  const folha = page.getByRole('dialog', { name: `Agendar ${nome}` });
  await folha.getByRole('radio', { name: dia }).tap();
  await folha.getByLabel('Horário').fill(hora);
  await folha.getByRole('button', { name: 'Agendar' }).tap();
  await expect(folha).toBeHidden();
}

async function contadorDoBanco(page: Page, nome: string) {
  await irPara(page, 'Calendário');
  const botao = page.getByRole('button', { name: 'Banco de afazeres' });
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.tap();
  return page.getByRole('region', { name: 'Banco de afazeres' }).getByRole('button', { name: new RegExp(`^${nome},`) });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  await agendar(page, 'Violão', 'terça-feira, 13 de outubro', '08:00');
  await agendar(page, 'Violão', 'quinta-feira, 15 de outubro', '19:00');
});

test('sessões planejadas aparecem em Hoje (topo e próximos compromissos)', async ({ page }) => {
  await irPara(page, 'Hoje');
  await expect(page.getByRole('button', { name: /08:00\s*Violão\s*planejado/ })).toBeVisible();
  const proximos = page.getByRole('region', { name: 'Próximos compromissos' });
  await expect(proximos.getByRole('heading', { level: 3 })).toHaveText(['Quinta, 15/10']);
  await expect(proximos.getByRole('button', { name: /19:00\s*Violão\s*planejado/ })).toBeVisible();
});

test('"Feito" em Hoje converte a planejada de hoje (sem duplicar) e atualiza contadores', async ({ page }) => {
  await irPara(page, 'Hoje');
  await expect(card(page, 'Violão')).toContainText('Ainda não praticou');
  await card(page, 'Violão').getByRole('button', { name: 'Feito' }).tap();
  await expect(card(page, 'Violão')).toBeHidden();
  await expect(page.getByRole('button', { name: /08:00\s*Violão\s*planejado/ })).toBeHidden();

  // Desfazer: volta a ser planejada e o card reaparece.
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(card(page, 'Violão')).toBeVisible();
  await expect(page.getByRole('button', { name: /08:00\s*Violão\s*planejado/ })).toBeVisible();
  await card(page, 'Violão').getByRole('button', { name: 'Feito' }).tap();
  await expect(card(page, 'Violão')).toBeHidden();

  // Na grade, o bloco das 08:00 de terça virou "feito"; o contador da semana não muda.
  await expect(await contadorDoBanco(page, 'Violão')).toContainText('2 de 3 agendados');
  await expect(page.locator('[data-dia="2026-10-13"]').getByRole('button', { name: 'Violão, 08:00–08:30, feito' })).toBeAttached();
  await expect(page.locator('[data-bloco="sessao"]')).toHaveCount(2);

  // Em Atividades, conta como feita na semana.
  await irPara(page, 'Atividades');
  await expect(page.getByText('1 de 3 esta semana')).toBeVisible();
});

test('"Feito" pela folha da sessão (futura) registra agora e tira o card de Hoje', async ({ page }) => {
  await irPara(page, 'Hoje');
  await expect(cards(page)).toHaveCount(1);
  const proximos = page.getByRole('region', { name: 'Próximos compromissos' });
  await proximos.getByRole('button', { name: /19:00\s*Violão/ }).tap();
  const folha = page.getByRole('dialog', { name: 'Violão' });
  await expect(folha).toContainText('Quinta, 15/10 · 19:00–19:30');
  await folha.getByRole('button', { name: 'Feito' }).tap();
  await expect(page.getByText('Sessão registrada como feita')).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(proximos).toContainText('Nada marcado para os próximos 7 dias.');

  // Sessão futura marcada como feita passa a terminar agora (12:00).
  await irPara(page, 'Calendário');
  await expect(page.locator('[data-dia="2026-10-13"]').getByRole('button', { name: 'Violão, 11:30–12:00, feito' })).toBeAttached();

  // Desfazer devolve para quinta, planejada.
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(page.locator('[data-dia="2026-10-15"]').getByRole('button', { name: 'Violão, 19:00–19:30, planejado' })).toBeAttached();
});

test('"Fiz hoje" em Atividades também converte a planejada de hoje', async ({ page }) => {
  await irPara(page, 'Atividades');
  await page.getByRole('button', { name: 'Fiz Violão hoje' }).tap();
  await expect(page.getByText('1 de 3 esta semana')).toBeVisible();
  await expect(await contadorDoBanco(page, 'Violão')).toContainText('2 de 3 agendados');
  await expect(page.locator('[data-bloco="sessao"]')).toHaveCount(2);
});
