import { card, cards, expect, irPara, novaAtividade, novaPessoa, novoEvento, test } from './apoio';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Tudo em dia por aqui.')).toBeVisible();
});

test('reprodução: dois hobbies novos (1x e 3x, sem limite) aparecem numa terça', async ({ page }) => {
  await novaAtividade(page, { nome: 'Desenho', meta: 1 });
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  await irPara(page, 'Hoje');
  await expect(cards(page)).toHaveCount(2);
  await expect(card(page, 'Desenho')).toContainText('Ainda não praticou');
  await expect(card(page, 'Violão')).toContainText('Ainda não praticou');
});

test('feito, adiar, pausar e desfazer', async ({ page }) => {
  await novaAtividade(page, { nome: 'Violão', meta: 3 });
  await novaPessoa(page, { nome: 'Ana', ultimoContato: '2026-09-01' });
  await irPara(page, 'Hoje');
  await expect(cards(page)).toHaveCount(2);
  await expect(card(page, 'Ana')).toContainText(/Último contato há 42 dias/);

  // Feito tira o card; desfazer traz de volta.
  await card(page, 'Violão').getByRole('button', { name: 'Feito' }).tap();
  await expect(page.getByText('Violão: registrado')).toBeVisible();
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(card(page, 'Violão')).toBeVisible();

  // Adiar: as três opções, "semana que vem" = segunda 19/10.
  await card(page, 'Ana').getByRole('button', { name: 'Adiar' }).tap();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByRole('button', { name: /^Amanhã/ })).toContainText('quarta, 14/10');
  await expect(dialogo.getByRole('button', { name: /^Em 3 dias/ })).toContainText('sexta, 16/10');
  await expect(dialogo.getByRole('button', { name: /^Semana que vem/ })).toContainText('segunda, 19/10');
  await dialogo.getByRole('button', { name: /^Amanhã/ }).tap();
  await expect(page.getByText('Volta a aparecer amanhã')).toBeVisible();
  await expect(card(page, 'Ana')).toBeHidden();
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await expect(card(page, 'Ana')).toBeVisible();

  // Pausar: some de Hoje e vai para "Pausadas".
  await card(page, 'Violão').getByRole('button', { name: 'Pausar' }).tap();
  await expect(card(page, 'Violão')).toBeHidden();
  await irPara(page, 'Atividades');
  await expect(page.getByRole('heading', { name: 'Pausadas' })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).tap();

  // "Falei" pela lista de Pessoas.
  await irPara(page, 'Pessoas');
  await page.getByRole('button', { name: 'Falei com Ana' }).tap();
  await irPara(page, 'Hoje');
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, 'Violão')).toBeVisible();
});

test('atividade feita hoje sai de Hoje; histórico registra', async ({ page }) => {
  await novaAtividade(page, { nome: 'Inglês', categoria: 'Estudo' });
  await expect(page.getByRole('heading', { name: 'Estudo' })).toBeVisible();
  await page.getByRole('button', { name: 'Fiz Inglês hoje' }).tap();
  await page.getByRole('button', { name: /^Inglês/ }).tap();
  await expect(page.getByRole('button', { name: 'Remover sessão' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar' }).tap();
  await irPara(page, 'Hoje');
  await expect(page.getByText('Tudo em dia por aqui.')).toBeVisible();
});

test('formulário mostra o limite padrão derivado da meta', async ({ page }) => {
  await irPara(page, 'Atividades');
  await page.getByRole('button', { name: 'Nova atividade' }).tap();
  const limite = page.getByRole('textbox', { name: /Lembrar depois/ });
  await expect(limite).toHaveAttribute('placeholder', 'Padrão: 14 dias');
  const meta = page.getByRole('group', { name: 'Meta semanal' });
  await meta.getByRole('button', { name: 'Aumentar' }).tap();
  await expect(limite).toHaveAttribute('placeholder', 'Padrão: 9 dias');
  await meta.getByRole('button', { name: 'Aumentar' }).tap();
  await meta.getByRole('button', { name: 'Aumentar' }).tap();
  await expect(limite).toHaveAttribute('placeholder', 'Padrão: 5 dias');
  await limite.fill('0');
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await limite.fill('8');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Corrida');
  await page.getByRole('button', { name: 'Salvar' }).tap();
  await page.getByRole('button', { name: /^Corrida/ }).tap();
  await expect(limite).toHaveValue('8');
});

test('início da semana configurável e salvo', async ({ page }) => {
  await irPara(page, 'Ajustes');
  const segunda = page.getByRole('radio', { name: 'Segunda' });
  await expect(segunda).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Domingo' }).tap();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');

  // Com a semana começando no domingo, "semana que vem" passa a ser domingo 18/10.
  await novaAtividade(page, { nome: 'Violão' });
  await irPara(page, 'Hoje');
  await card(page, 'Violão').getByRole('button', { name: 'Adiar' }).tap();
  await expect(page.getByRole('button', { name: /^Semana que vem/ })).toContainText('domingo, 18/10');
});

test('evento de hoje aparece no topo com a pessoa', async ({ page }) => {
  await novaPessoa(page, { nome: 'Ana' });
  await novoEvento(page, { titulo: 'Dentista', data: '2026-10-13', inicio: '15:00', fim: '16:00', pessoa: 'Ana' });
  await irPara(page, 'Hoje');
  await expect(page.getByText('Dentista')).toBeVisible();
  await expect(page.getByText('com Ana')).toBeVisible();
});
