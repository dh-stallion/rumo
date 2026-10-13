import { test as base, expect, type Page } from '@playwright/test';

/** Terça-feira, 13/10/2026, 12:00 em São Paulo. */
export const TERCA = new Date('2026-10-13T12:00:00-03:00');

/**
 * Cada teste começa num navegador limpo (IndexedDB vazio), com o relógio fixo
 * e falhando se houver erro no console.
 */
export const test = base.extend<{ agora: Date }>({
  agora: [TERCA, { option: true }],
  page: async ({ page, agora }, use) => {
    const erros: string[] = [];
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    page.on('pageerror', (e) => erros.push(String(e)));
    await page.clock.setFixedTime(agora);
    await use(page);
    expect(erros, 'erros no console').toEqual([]);
  },
});

export { expect };

export const cards = (page: Page) => page.locator('article');
export const card = (page: Page, nome: string) =>
  cards(page).filter({ has: page.getByRole('heading', { name: nome, exact: true }) });

export async function irPara(page: Page, aba: 'Hoje' | 'Atividades' | 'Pessoas' | 'Agenda' | 'Ajustes') {
  await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: aba }).tap();
}

export async function novaAtividade(
  page: Page,
  { nome, categoria, meta = 0, limite }: { nome: string; categoria?: 'Estudo' | 'Lazer'; meta?: number; limite?: number },
) {
  await irPara(page, 'Atividades');
  await page.getByRole('button', { name: 'Nova atividade' }).tap();
  await page.getByRole('textbox', { name: 'Nome' }).fill(nome);
  if (categoria) await page.getByRole('radio', { name: categoria }).tap();
  const grupo = page.getByRole('group', { name: 'Meta semanal' });
  for (let i = 0; i < meta; i++) await grupo.getByRole('button', { name: 'Aumentar' }).tap();
  if (limite) await page.getByRole('textbox', { name: /Lembrar depois/ }).fill(String(limite));
  await page.getByRole('button', { name: 'Salvar' }).tap();
  await expect(page.getByRole('dialog')).toBeHidden();
}

export async function novaPessoa(page: Page, { nome, ultimoContato }: { nome: string; ultimoContato?: string }) {
  await irPara(page, 'Pessoas');
  await page.getByRole('button', { name: 'Nova pessoa' }).tap();
  await page.getByRole('textbox', { name: 'Nome' }).fill(nome);
  if (ultimoContato) await page.getByLabel('Último contato').fill(ultimoContato);
  await page.getByRole('button', { name: 'Salvar' }).tap();
  await expect(page.getByRole('dialog')).toBeHidden();
}

export async function novoEvento(
  page: Page,
  { titulo, data, inicio, fim, pessoa }: { titulo: string; data: string; inicio: string; fim: string; pessoa?: string },
) {
  await irPara(page, 'Agenda');
  await page.getByRole('button', { name: 'Novo evento' }).tap();
  await page.getByRole('textbox', { name: 'Título' }).fill(titulo);
  await page.getByLabel('Data').fill(data);
  await page.getByLabel('Início').fill(inicio);
  await page.getByLabel('Fim').fill(fim);
  if (pessoa) await page.getByLabel('Com quem (opcional)').selectOption({ label: pessoa });
  await page.getByRole('button', { name: 'Salvar' }).tap();
  await expect(page.getByRole('dialog')).toBeHidden();
}
