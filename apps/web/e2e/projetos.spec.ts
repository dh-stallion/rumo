import type { Page } from '@playwright/test';
import { expect, irPara, test } from './apoio';
import { centro, gestos, pontoNaGrade, rolarGradePara } from './toque';

async function criarProjeto(page: Page, nome: string) {
  await irPara(page, 'Planos');
  await page.getByRole('button', { name: 'Novo projeto' }).tap();
  await page.getByRole('textbox', { name: 'Nome' }).fill(nome);
  await page.getByRole('button', { name: 'Criar projeto' }).tap();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
}

async function adicionarAcao(page: Page, titulo: string) {
  await page.getByRole('textbox', { name: 'Nova ação' }).fill(titulo);
  await page.getByRole('button', { name: 'Adicionar ação' }).tap();
  await expect(page.getByRole('button', { name: new RegExp(`^${titulo}`) })).toBeVisible();
}

async function adicionarMarco(page: Page, titulo: string, data: string) {
  await page.getByRole('button', { name: 'Adicionar marco' }).tap();
  const f = page.getByRole('dialog', { name: 'Novo marco' });
  await f.getByRole('textbox', { name: 'Título' }).fill(titulo);
  await f.getByLabel('Data (opcional)').fill(data);
  await f.getByRole('button', { name: 'Salvar' }).tap();
  await expect(f).toBeHidden();
}

async function adicionarItem(page: Page, nome: string, preco: string) {
  await page.getByRole('button', { name: 'Adicionar item' }).tap();
  const f = page.getByRole('dialog', { name: 'Novo item' });
  await f.getByRole('textbox', { name: 'Nome' }).fill(nome);
  await f.getByRole('textbox', { name: 'Preço' }).fill(preco);
  await f.getByRole('button', { name: 'Salvar' }).tap();
  await expect(f).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await criarProjeto(page, 'Montar um NAS');
});

test('ações, marcos e itens com totais', async ({ page }) => {
  await adicionarAcao(page, 'Pesquisar HDs');
  await adicionarAcao(page, 'Comparar gabinetes');
  await adicionarMarco(page, 'Comprar peças', '2026-11-30');
  await adicionarMarco(page, 'Definir orçamento', '2026-10-10');
  await adicionarItem(page, 'Gabinete', '1.500');
  await adicionarItem(page, '2× HD 8 TB', '2200,00');

  // Marco atrasado aparece primeiro e avisa.
  await expect(page.getByRole('button', { name: /^Definir orçamento/ })).toContainText('era para 10/10/2026');
  await expect(page.getByRole('heading', { name: 'Marcos · 0 de 2' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Marco Definir orçamento concluído' }).tap();
  await expect(page.getByRole('heading', { name: 'Marcos · 1 de 2' })).toBeVisible();

  const totais = page.getByLabel('Totais dos itens');
  await expect(totais).toContainText('TotalR$ 3.700,00');
  await page.getByRole('checkbox', { name: 'Gabinete comprado' }).tap();
  await expect(totais).toContainText('Falta comprarR$ 2.200,00');

  // Concluir uma ação; a lista mostra a próxima.
  await page.getByRole('checkbox', { name: 'Concluir Pesquisar HDs' }).tap();
  await expect(page.getByText('Pesquisar HDs: concluída')).toBeVisible();
  await page.getByRole('link', { name: 'Planos' }).first().tap();
  const cartao = page.getByRole('link', { name: /Montar um NAS/ });
  await expect(cartao).toContainText('Próxima: Comparar gabinetes');
  await expect(cartao).toContainText('1 de 2 marcos · R$ 2.200,00 a comprar');
});

test('editar e remover item, com desfazer; preço inválido não salva', async ({ page }) => {
  await adicionarItem(page, 'Fonte', '300');
  await page.getByRole('button', { name: /^Fonte/ }).tap();
  const f = page.getByRole('dialog', { name: 'Editar item' });
  await f.getByRole('textbox', { name: 'Preço' }).fill('abc');
  await expect(f.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await f.getByRole('textbox', { name: 'Preço' }).fill('350,90');
  await f.getByRole('button', { name: 'Salvar' }).tap();
  await expect(page.getByRole('button', { name: /^Fonte/ })).toContainText('R$ 350,90');

  await page.getByRole('button', { name: /^Fonte/ }).tap();
  await f.getByRole('button', { name: 'Remover' }).tap();
  await expect(page.getByRole('button', { name: /^Fonte/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(page.getByRole('button', { name: /^Fonte/ })).toBeVisible();
});

test('ação vira sessão: agendar pela página e arrastar do banco de afazeres', async ({ page }) => {
  await adicionarAcao(page, 'Pesquisar HDs');
  await page.getByRole('button', { name: 'Agendar Pesquisar HDs' }).tap();
  const folha = page.getByRole('dialog', { name: 'Agendar Pesquisar HDs' });
  await folha.getByRole('radio', { name: 'quinta-feira, 15 de outubro' }).tap();
  await folha.getByLabel('Horário').fill('19:00');
  await folha.getByRole('button', { name: 'Agendar' }).tap();
  await expect(page.getByRole('button', { name: /^Pesquisar HDs/ })).toContainText('60 min · 1 agendada');

  await irPara(page, 'Calendário');
  await expect(page.locator('[data-dia="2026-10-15"]').getByRole('button', { name: 'Pesquisar HDs, 19:00–20:00, planejado' })).toBeAttached();

  // No banco, o grupo Projetos; arrastar por toque longo cria outra sessão.
  await rolarGradePara(page, 7);
  await page.getByRole('button', { name: 'Banco de afazeres' }).tap();
  const banco = page.getByRole('region', { name: 'Banco de afazeres' });
  await expect.poll(() => banco.evaluate((el) => el.getAnimations().length)).toBe(0);
  await expect(banco.getByRole('heading', { name: 'Projetos' })).toBeVisible();
  const item = banco.getByRole('button', { name: /^Pesquisar HDs,/ });
  await expect(item).toContainText('Montar um NAS · 60 min');
  await expect(item).toContainText('1 agendados');
  const toque = await gestos(page);
  const de = await centro(item);
  await toque.pressionar(de);
  await toque.esperar(400);
  await toque.moverPara({ x: de.x, y: de.y - 40 }, 4);
  const alvo = await pontoNaGrade(page, '2026-10-14', '09:00');
  await toque.moverPara({ x: alvo.x, y: alvo.y + 10 });
  await toque.soltar();
  await expect(page.locator('[data-dia="2026-10-14"]').getByRole('button', { name: 'Pesquisar HDs, 09:00–10:00, planejado' })).toBeVisible();

  // Aparece em Próximos compromissos de Hoje.
  await irPara(page, 'Hoje');
  await expect(page.getByRole('region', { name: 'Próximos compromissos' })).toContainText('Pesquisar HDs');
});

test('arquivar tira o projeto da lista e as ações do banco', async ({ page }) => {
  await adicionarAcao(page, 'Pesquisar HDs');
  await page.getByRole('button', { name: 'Editar projeto' }).tap();
  await page.getByRole('switch', { name: /Arquivado/ }).tap();
  await page.getByRole('button', { name: 'Salvar' }).tap();
  await page.getByRole('link', { name: 'Planos' }).first().tap();
  await expect(page.getByRole('heading', { name: 'Arquivados' })).toBeVisible();
  await expect(page.getByText('Nenhum projeto ainda.')).toBeVisible();

  await irPara(page, 'Calendário');
  await page.getByRole('button', { name: 'Banco de afazeres' }).tap();
  await expect(page.getByRole('region', { name: 'Banco de afazeres' }).getByRole('heading', { name: 'Projetos' })).toHaveCount(0);
});
