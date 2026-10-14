import type { Page } from '@playwright/test';
import { expect, irPara, novaAtividade, novoEvento, test } from './apoio';
import { centro, diasVisiveis, gestos, pontoNaGrade, rolarGradePara } from './toque';

const QUA = '2026-10-14';
const QUI = '2026-10-15';

async function abrirBanco(page: Page) {
  const botao = page.getByRole('button', { name: 'Banco de afazeres' });
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.tap();
  const banco = page.getByRole('region', { name: 'Banco de afazeres' });
  await expect(banco).toBeVisible();
  // Espera a gaveta terminar de subir antes de medir posições.
  await expect.poll(() => banco.evaluate((el) => el.getAnimations().length)).toBe(0);
}

const itemBanco = (page: Page, nome: string) =>
  page.getByRole('region', { name: 'Banco de afazeres' }).getByRole('button', { name: new RegExp(`^${nome},`) });

const bloco = (page: Page, nome: string) => page.locator('[data-bloco="sessao"]').filter({ hasText: nome });

/** Arrasta um item do banco até um dia/horário, com toque longo. A prévia fica 10px acima do dedo. */
async function arrastarDoBanco(page: Page, nome: string, dia: string, hora: string) {
  await abrirBanco(page);
  const toque = await gestos(page);
  const de = await centro(itemBanco(page, nome));
  await toque.pressionar(de);
  await toque.esperar(400);
  await toque.moverPara({ x: de.x, y: de.y - 40 }, 4); // começa a mover: a gaveta desce
  const alvo = await pontoNaGrade(page, dia, hora);
  await toque.moverPara({ x: alvo.x, y: alvo.y + 10 });
  await toque.esperar(100);
  await toque.soltar();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  await novaAtividade(page, { nome: 'Inglês', categoria: 'Estudo' });
  await irPara(page, 'Semana');
  await rolarGradePara(page, 7);
});

test('banco agrupado por categoria com "X de Y agendados"', async ({ page }) => {
  await abrirBanco(page);
  const banco = page.getByRole('region', { name: 'Banco de afazeres' });
  await expect(banco.getByRole('heading')).toHaveText(['Hobby', 'Estudo']);
  await expect(itemBanco(page, 'Violão')).toContainText('0 de 3 agendados');
  await expect(itemBanco(page, 'Inglês')).toContainText('nenhum agendado');
});

test('arrastar do banco com toque longo cria sessões planejadas, várias vezes', async ({ page }) => {
  await arrastarDoBanco(page, 'Violão', QUA, '09:00');
  await expect(page.getByText(/Violão: qua 09:00/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Violão, 09:00–09:30, planejado' })).toBeVisible();
  await abrirBanco(page);
  await expect(itemBanco(page, 'Violão')).toContainText('1 de 3 agendados');

  await arrastarDoBanco(page, 'Violão', QUI, '10:30');
  await expect(page.getByRole('button', { name: 'Violão, 10:30–11:00, planejado' })).toBeVisible();
  await abrirBanco(page);
  await expect(itemBanco(page, 'Violão')).toContainText('2 de 3 agendados');

  // Desfazer remove a última.
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(page.getByRole('button', { name: 'Violão, 10:30–11:00, planejado' })).toBeHidden();
  await expect(itemBanco(page, 'Violão')).toContainText('1 de 3 agendados');
});

test('fluxo sem arrastar: tocar no item e escolher dia e hora', async ({ page }) => {
  await abrirBanco(page);
  await itemBanco(page, 'Inglês').tap();
  const dialogo = page.getByRole('dialog', { name: 'Agendar Inglês' });
  await dialogo.getByRole('radio', { name: 'quinta-feira, 15 de outubro' }).tap();
  await dialogo.getByLabel('Horário').fill('08:00');
  await dialogo.getByRole('group', { name: 'Duração' }).getByRole('button', { name: 'Aumentar' }).tap();
  await dialogo.getByRole('button', { name: 'Agendar' }).tap();
  await expect(page.getByRole('button', { name: 'Inglês, 08:00–08:45, planejado' })).toBeVisible();
  await expect(itemBanco(page, 'Inglês')).toContainText('1 agendados');
});

test('avisa conflito com evento fixo (no arraste e no seletor)', async ({ page }) => {
  await novoEvento(page, { titulo: 'Dentista', data: QUA, inicio: '09:00', fim: '10:00' });
  await rolarGradePara(page, 7);
  await arrastarDoBanco(page, 'Violão', QUA, '09:30');
  await expect(page.getByText('Violão: qua 09:30 · conflito com Dentista')).toBeVisible();
  await expect(page.getByRole('button', { name: /Violão, 09:30–10:00, planejado, em conflito com Dentista/ })).toBeVisible();

  // Encostar não é conflito: o seletor só avisa quando sobrepõe.
  await abrirBanco(page);
  await itemBanco(page, 'Inglês').tap();
  const dialogo = page.getByRole('dialog', { name: 'Agendar Inglês' });
  await dialogo.getByRole('radio', { name: 'quarta-feira, 14 de outubro' }).tap();
  await dialogo.getByLabel('Horário').fill('10:00');
  await expect(dialogo.getByRole('alert')).toBeHidden();
  await dialogo.getByLabel('Horário').fill('09:45');
  await expect(dialogo.getByRole('alert')).toContainText('Conflita com Dentista');
});

test('mover um bloco com toque longo, inclusive para um dia fora da tela', async ({ page }) => {
  await arrastarDoBanco(page, 'Violão', QUA, '09:00');
  await expect.poll(() => diasVisiveis(page)).toEqual(['2026-10-13', QUA, QUI]);

  // Dentro da tela: quarta 09:00 → quinta 11:00.
  const toque = await gestos(page);
  let de = await centro(bloco(page, 'Violão'));
  await toque.pressionar(de);
  await toque.esperar(400);
  const ate = await pontoNaGrade(page, QUI, '11:00');
  await toque.moverPara({ x: ate.x, y: ate.y + (de.y - (await pontoNaGrade(page, QUA, '09:00')).y) });
  await toque.soltar();
  await expect(page.getByRole('button', { name: 'Violão, 11:00–11:30, planejado' })).toBeVisible();
  await expect(page.locator(`[data-dia="${QUI}"]`).getByRole('button', { name: /^Violão/ })).toBeVisible();

  // Para sábado (fora da tela): segura na borda direita até a grade rolar.
  de = await centro(bloco(page, 'Violão'));
  await toque.pressionar(de);
  await toque.esperar(400);
  const grade = (await page.locator('[data-grade]').boundingBox())!;
  await toque.moverPara({ x: grade.x + grade.width - 10, y: de.y });
  await expect.poll(() => diasVisiveis(page), { timeout: 5000 }).toContain('2026-10-17');
  // Afasta o dedo da borda (a rolagem para) e então vai até o sábado.
  await toque.moverPara({ x: grade.x + grade.width / 2, y: de.y }, 4);
  const sabado = await pontoNaGrade(page, '2026-10-17', '11:00');
  await toque.moverPara({ x: sabado.x, y: de.y }, 4);
  await expect(page.locator('[data-previa-horario]')).toHaveText('sáb 11:00');
  await toque.soltar();
  await expect(page.locator('[data-dia="2026-10-17"]').getByRole('button', { name: 'Violão, 11:00–11:30, planejado' })).toBeVisible();
});

test('redimensionar pela alça e ajustar/remover pela folha da sessão', async ({ page }) => {
  await arrastarDoBanco(page, 'Violão', QUA, '09:00');
  const toque = await gestos(page);

  // Alça: arrasta o fim de 09:30 para 10:30.
  const alca = await centro(page.getByRole('button', { name: 'Mudar duração de Violão' }));
  const dez30 = await pontoNaGrade(page, QUA, '10:30');
  await toque.pressionar(alca);
  await toque.esperar(400);
  await toque.moverPara({ x: alca.x, y: dez30.y });
  await toque.soltar();
  await expect(page.getByText('Violão: 90 min')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Violão, 09:00–10:30, planejado' })).toBeVisible();

  // Folha: toque abre; duração −15 e mudar para quinta.
  await page.getByRole('button', { name: 'Violão, 09:00–10:30, planejado' }).tap();
  const folha = page.getByRole('dialog', { name: 'Violão' });
  await folha.getByRole('group', { name: 'Duração' }).getByRole('button', { name: 'Diminuir' }).tap();
  await folha.getByRole('radio', { name: 'quinta-feira, 15 de outubro' }).tap();
  await folha.getByRole('button', { name: 'Salvar alterações' }).tap();
  await expect(page.locator(`[data-dia="${QUI}"]`).getByRole('button', { name: 'Violão, 09:00–10:15, planejado' })).toBeVisible();

  // Remover e desfazer.
  await page.getByRole('button', { name: 'Violão, 09:00–10:15, planejado' }).tap();
  await folha.getByRole('button', { name: 'Remover sessão' }).tap();
  await expect(bloco(page, 'Violão')).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(bloco(page, 'Violão')).toHaveCount(1);
});

test('deslizar rápido sobre um bloco rola a grade em vez de arrastar', async ({ page }) => {
  await arrastarDoBanco(page, 'Violão', QUA, '09:00');
  const toque = await gestos(page);
  const de = await centro(bloco(page, 'Violão'));
  await toque.deslizar(de, { x: de.x - 150, y: de.y });
  await expect.poll(() => diasVisiveis(page)).not.toContain('2026-10-13');
  await expect(page.getByRole('button', { name: 'Violão, 09:00–09:30, planejado' })).toBeVisible();
});
