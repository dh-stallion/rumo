import type { Page } from '@playwright/test';
import { expect, irPara, novaAtividade, novaPessoa, novoEvento, test } from './apoio';

type Janela = { __backup?: string };

/** Simula a folha de compartilhamento do iPhone, guardando o arquivo entregue. */
async function capturarCompartilhamento(page: Page) {
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async (dados?: ShareData) => {
      (window as unknown as Janela).__backup = await dados!.files![0]!.text();
    };
  });
}

async function exportar(page: Page): Promise<string> {
  await irPara(page, 'Ajustes');
  await page.evaluate(() => delete (window as unknown as Janela).__backup);
  await page.getByRole('button', { name: 'Exportar dados (JSON)' }).tap();
  await expect(page.getByText('Backup pronto')).toBeVisible();
  return (await page.evaluate(() => (window as unknown as Janela).__backup))!;
}

async function apagarTudo(page: Page) {
  await page.evaluate(
    () =>
      new Promise((ok, erro) => {
        const req = indexedDB.deleteDatabase('rumo');
        req.onsuccess = ok;
        req.onerror = erro;
      }),
  );
  await page.reload();
}

async function importar(page: Page, conteudo: string) {
  await irPara(page, 'Ajustes');
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'rumo-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(conteudo),
  });
}

const tabelas = (json: string) => (JSON.parse(json) as { tabelas: unknown }).tabelas;

test('exportar, apagar tudo, importar: os dados voltam idênticos', async ({ page }) => {
  await capturarCompartilhamento(page);
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão', meta: 3, limite: 4 });
  await page.getByRole('button', { name: 'Fiz Violão hoje' }).tap();
  await novaAtividade(page, { nome: 'Inglês', categoria: 'Estudo' });
  await novaPessoa(page, { nome: 'Ana', ultimoContato: '2026-10-01' });
  await novoEvento(page, { titulo: 'Dentista', data: '2026-10-14', inicio: '15:00', fim: '16:00', pessoa: 'Ana' });
  await irPara(page, 'Ajustes');
  await page.getByRole('radio', { name: 'Domingo' }).tap();
  // O estado marcado vem do IndexedDB: espera a gravação antes de seguir.
  await expect(page.getByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');

  const original = await exportar(page);
  expect(JSON.parse(original)).toMatchObject({ formato: 'rumo-backup', versao: 1 });
  await expect(page.getByText('Último backup hoje.')).toBeVisible();

  await apagarTudo(page);
  await irPara(page, 'Atividades');
  await expect(page.getByText('Nenhuma atividade ainda.')).toBeVisible();

  await importar(page, original);
  const dialogo = page.getByRole('dialog', { name: 'Substituir os dados?' });
  await expect(dialogo).toContainText('exportado em 13/10/2026 às 12:00');
  await expect(dialogo).toContainText('2 atividades, 1 sessão, 1 pessoa, 1 compromisso');
  await expect(dialogo).toContainText('(0 atividades, 0 sessões, 0 pessoas, 0 compromissos)');
  await dialogo.getByRole('button', { name: 'Substituir dados' }).tap();
  await expect(page.getByText('Dados importados')).toBeVisible();

  expect(tabelas(await exportar(page))).toEqual(tabelas(original));
  await expect(page.getByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');
  await irPara(page, 'Atividades');
  await expect(page.getByText('Violão')).toBeVisible();
  await expect(page.getByText('1 de 3 esta semana')).toBeVisible();
});

test('cancelar a importação não altera nada', async ({ page }) => {
  await capturarCompartilhamento(page);
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão' });
  const backup = await exportar(page);
  await novaAtividade(page, { nome: 'Corrida' });
  await importar(page, backup);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).tap();
  await irPara(page, 'Atividades');
  await expect(page.getByText('Corrida')).toBeVisible();
});

test('arquivo inválido é recusado com explicação e sem mexer nos dados', async ({ page }) => {
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão' });

  await importar(page, 'isto não é json');
  const erro = page.getByRole('dialog', { name: 'Não deu para importar' });
  await expect(erro).toContainText('O arquivo não é um JSON válido.');
  await erro.getByRole('button', { name: 'Entendi' }).tap();

  await importar(page, JSON.stringify({ qualquer: 'coisa' }));
  await expect(erro).toContainText('Este arquivo não é um backup do Rumo.');
  await erro.getByRole('button', { name: 'Entendi' }).tap();

  const quebrado = {
    formato: 'rumo-backup',
    versao: 1,
    exportadoEm: '2026-10-13T15:00:00.000Z',
    tabelas: { atividades: [{ id: 'x', nome: 'Sem campos' }], sessoes: [], pessoas: [], eventos: [], adiamentos: [], preferencias: [] },
  };
  await importar(page, JSON.stringify(quebrado));
  await expect(erro).toContainText('atividade nº 1, campo "categoria": ausente');
  await erro.getByRole('button', { name: 'Entendi' }).tap();

  await irPara(page, 'Atividades');
  await expect(page.getByText('Violão')).toBeVisible();
});

test('sem compartilhamento (computador), exporta como download', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
  await page.goto('/');
  await novaAtividade(page, { nome: 'Violão' });
  await irPara(page, 'Ajustes');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar dados (JSON)' }).tap();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toBe('rumo-backup-2026-10-13.json');
  const conteudo = await (await arquivo.createReadStream()).toArray();
  expect(JSON.parse(Buffer.concat(conteudo).toString())).toMatchObject({ formato: 'rumo-backup' });
});

test('mostra o resultado do pedido de armazenamento persistente', async ({ page }) => {
  await page.goto('/');
  await irPara(page, 'Ajustes');
  await expect(page.getByTestId('persistencia')).toHaveText(/^(Concedido|Não concedido|Indisponível)$/);
});
