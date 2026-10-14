import type { Page } from '@playwright/test';
import { expect, irPara, novaAtividade, novaPessoa, novoEvento, test } from './apoio';

async function exportarICS(page: Page): Promise<string> {
  await irPara(page, 'Ajustes');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar calendário (.ics)' }).tap();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toBe('rumo-2026-10-13.ics');
  const partes = await (await arquivo.createReadStream()).toArray();
  return Buffer.concat(partes).toString('utf8').replace(/\r\n /g, '');
}

test.beforeEach(async ({ page }) => {
  // Computador: sem folha de compartilhamento, o arquivo é baixado.
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined }));
  await page.goto('/');
});

test('sem nada cadastrado, a exportação fica desabilitada', async ({ page }) => {
  await irPara(page, 'Ajustes');
  await expect(page.getByRole('button', { name: 'Exportar calendário (.ics)' })).toBeDisabled();
  await expect(page.getByText('Nada para exportar ainda.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Assinatura do calendário')).toContainText('etapa 5');
});

test('exporta série com exceções, evento com pessoa e sessões planejadas', async ({ page }) => {
  await novaPessoa(page, { nome: 'Ana' });
  await novaAtividade(page, { nome: 'Violão' });
  await novoEvento(page, { titulo: 'Dentista', data: '2026-10-14', inicio: '15:00', fim: '16:00', pessoa: 'Ana' });

  // Série: terças e quintas; pula a quinta 15 e renomeia a terça 20.
  await irPara(page, 'Calendário');
  await page.getByRole('button', { name: 'Novo evento' }).tap();
  const f = page.getByRole('dialog', { name: 'Novo evento' });
  await f.getByRole('textbox', { name: 'Título' }).fill('Aula');
  await f.getByLabel('Data').fill('2026-10-13');
  await f.getByLabel('Início').fill('19:00');
  await f.getByLabel('Fim').fill('21:00');
  await f.getByLabel('Repetir').selectOption({ label: 'Toda semana' });
  await f.getByRole('button', { name: 'quinta' }).tap();
  await f.getByRole('button', { name: 'Salvar' }).tap();
  await page.locator('[data-dia="2026-10-15"]').getByRole('button', { name: /^Aula/ }).tap();
  const editar = page.getByRole('dialog', { name: 'Editar evento' });
  await editar.getByRole('button', { name: 'Remover evento' }).tap();
  await editar.getByRole('button', { name: 'Só este evento' }).tap();
  await page.getByRole('button', { name: 'Semana seguinte' }).tap();
  await page.locator('[data-dia="2026-10-20"]').getByRole('button', { name: /^Aula/ }).tap();
  await editar.getByRole('textbox', { name: 'Título' }).fill('Aula extra');
  await editar.getByRole('button', { name: 'Salvar' }).tap();
  await editar.getByRole('button', { name: 'Só este evento' }).tap();

  // Sessão planejada.
  await page.getByRole('button', { name: 'Banco de afazeres' }).tap();
  await page.getByRole('region', { name: 'Banco de afazeres' }).getByRole('button', { name: /^Violão,/ }).tap();
  const agendar = page.getByRole('dialog', { name: 'Agendar Violão' });
  await agendar.getByRole('radio', { name: 'sexta-feira, 23 de outubro' }).tap();
  await agendar.getByLabel('Horário').fill('08:00');
  await agendar.getByRole('button', { name: 'Agendar' }).tap();

  const ics = await exportarICS(page);
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH\r\n');
  expect(ics).toContain('EXDATE;TZID=America/Sao_Paulo:20261015T190000\r\n');
  expect(ics).toContain('RECURRENCE-ID;TZID=America/Sao_Paulo:20261020T190000\r\n');
  expect(ics).toContain('SUMMARY:Aula extra\r\n');
  expect(ics).toContain('DESCRIPTION:Com Ana\r\n');
  expect(ics).toContain('SUMMARY:Violão\r\nTRANSP:OPAQUE\r\nCATEGORIES:Atividade\r\n');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);

  // Sem as sessões planejadas.
  await page.getByRole('switch', { name: /Incluir sessões planejadas/ }).tap();
  const semSessoes = await exportarICS(page);
  expect(semSessoes).not.toContain('CATEGORIES:Atividade');
  expect(semSessoes.match(/BEGIN:VEVENT/g)).toHaveLength(3);
});

async function importarICS(page: Page, conteudo: string, nome = 'agenda.ics') {
  await irPara(page, 'Ajustes');
  await page.getByLabel('Arquivo de calendário').setInputFiles({ name: nome, mimeType: 'text/calendar', buffer: Buffer.from(conteudo) });
}

test('importa um .ics de outro calendário, com aviso de regra não suportada e desfazer', async ({ page }) => {
  const externo = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:abc@google.com',
    'DTSTART:20261014T180000Z',
    'DURATION:PT1H30M',
    'SUMMARY:Call com o time',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:mensal@google.com',
    'DTSTART;TZID=America/Sao_Paulo:20261015T090000',
    'DTEND;TZID=America/Sao_Paulo:20261015T100000',
    'RRULE:FREQ=MONTHLY;BYDAY=TH;BYSETPOS=3',
    'SUMMARY:Reunião mensal',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  await importarICS(page, externo);
  const previa = page.getByRole('dialog', { name: 'Importar eventos?' });
  await expect(previa).toContainText('agenda.ics: 2 eventos novos (1 com repetição).');
  await expect(previa.getByLabel('Avisos')).toContainText('"Reunião mensal": Parte da regra não suportada: BYSETPOS');
  await previa.getByRole('button', { name: 'Importar' }).tap();
  await expect(page.getByText('2 eventos importados')).toBeVisible();

  await irPara(page, 'Calendário');
  await expect(page.locator('[data-dia="2026-10-14"]').getByRole('button', { name: 'Call com o time, 15:00–16:30, fixo' })).toBeAttached();
  await expect(page.locator('[data-dia="2026-10-15"]').getByRole('button', { name: /^Reunião mensal/ })).toBeAttached();

  await irPara(page, 'Ajustes');
  await page.getByRole('button', { name: 'Desfazer' }).tap();
  await irPara(page, 'Calendário');
  await expect(page.locator('[data-bloco="evento"]')).toHaveCount(0);
});

test('exportar, apagar e importar de volta; reimportar não duplica', async ({ page }) => {
  await novaPessoa(page, { nome: 'Ana' });
  await novoEvento(page, { titulo: 'Dentista', data: '2026-10-14', inicio: '15:00', fim: '16:00', pessoa: 'Ana' });
  const ics = await exportarICS(page);

  // Apaga o evento (e só ele) e importa o arquivo.
  await irPara(page, 'Calendário');
  await page.locator('[data-dia="2026-10-14"]').getByRole('button', { name: /^Dentista/ }).tap();
  await page.getByRole('button', { name: 'Remover evento' }).tap();
  await expect(page.locator('[data-bloco="evento"]')).toHaveCount(0);

  await importarICS(page, ics);
  const previa = page.getByRole('dialog', { name: 'Importar eventos?' });
  await expect(previa).toContainText('1 já existe e será atualizado');
  await previa.getByRole('button', { name: 'Importar' }).tap();
  await importarICS(page, ics);
  await expect(previa).toContainText('0 eventos novos, 1 já existe e será atualizado');
  await previa.getByRole('button', { name: 'Importar' }).tap();

  await irPara(page, 'Calendário');
  await expect(page.locator('[data-bloco="evento"]')).toHaveCount(1);
  await page.locator('[data-dia="2026-10-14"]').getByRole('button', { name: /^Dentista/ }).tap();
  await expect(page.getByLabel('Com quem (opcional)')).toHaveValue(/.+/); // voltou ligado à Ana
});

test('arquivo que não é calendário é recusado', async ({ page }) => {
  await importarICS(page, 'isto não é um calendário', 'nota.ics');
  await expect(page.getByRole('dialog', { name: 'Não deu para importar' })).toContainText('Este arquivo não é um calendário (.ics).');
});
