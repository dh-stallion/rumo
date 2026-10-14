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
