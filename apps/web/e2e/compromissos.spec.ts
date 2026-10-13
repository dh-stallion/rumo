import { expect, irPara, novaPessoa, novoEvento, test } from './apoio';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('estado vazio com atalho para adicionar compromisso', async ({ page }) => {
  const secao = page.getByRole('region', { name: 'Próximos compromissos' });
  await expect(secao).toContainText('Nada marcado para os próximos 7 dias.');
  await secao.getByRole('button', { name: 'Adicionar compromisso' }).tap();
  const dialogo = page.getByRole('dialog', { name: 'Novo compromisso' });
  await dialogo.getByRole('textbox', { name: 'Título' }).fill('Mercado');
  await dialogo.getByLabel('Data').fill('2026-10-15');
  await dialogo.getByLabel('Início').fill('18:00');
  await dialogo.getByLabel('Fim').fill('19:00');
  await dialogo.getByRole('button', { name: 'Salvar' }).tap();
  await expect(secao.getByRole('heading', { name: 'Quinta, 15/10' })).toBeVisible();
  await expect(secao.getByRole('button', { name: /Mercado/ })).toBeVisible();
});

test('agrupa por dia, ordena por horário e não repete os de hoje', async ({ page }) => {
  await novaPessoa(page, { nome: 'Ana' });
  await novoEvento(page, { titulo: 'Dentista', data: '2026-10-13', inicio: '15:00', fim: '16:00' });
  await novoEvento(page, { titulo: 'Almoço', data: '2026-10-14', inicio: '12:00', fim: '13:00', pessoa: 'Ana' });
  await novoEvento(page, { titulo: 'Café', data: '2026-10-14', inicio: '08:00', fim: '09:00' });
  await novoEvento(page, { titulo: 'Aula', data: '2026-10-15', inicio: '19:00', fim: '21:00' });
  await novoEvento(page, { titulo: 'Longe', data: '2026-10-21', inicio: '10:00', fim: '11:00' });
  await irPara(page, 'Hoje');

  const secao = page.getByRole('region', { name: 'Próximos compromissos' });
  await expect(secao.getByRole('heading', { level: 3 })).toHaveText(['Amanhã', 'Quinta, 15/10']);
  await expect(secao.getByRole('button')).toHaveText([/08:00Café/, /12:00Almoçocom Ana/, /19:00Aula/]);
  await expect(secao.getByRole('img', { name: 'Fixo' })).toHaveCount(3);
  await expect(secao).not.toContainText('Dentista');
  await expect(secao).not.toContainText('Longe');
  // O de hoje continua no topo.
  await expect(page.getByRole('button', { name: /15:00\s*Dentista/ })).toBeVisible();

  // Tocar abre o evento para editar.
  await secao.getByRole('button', { name: /Almoço/ }).tap();
  const dialogo = page.getByRole('dialog', { name: 'Editar evento' });
  await expect(dialogo.getByRole('textbox', { name: 'Título' })).toHaveValue('Almoço');
  await dialogo.getByRole('textbox', { name: 'Título' }).fill('Almoço com a Ana');
  await dialogo.getByRole('button', { name: 'Salvar' }).tap();
  await expect(secao.getByRole('button', { name: /Almoço com a Ana/ })).toBeVisible();
});
