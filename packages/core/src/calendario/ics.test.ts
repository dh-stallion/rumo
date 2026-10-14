import { describe, expect, it } from 'vitest';
import type { Atividade, Evento, Sessao } from '../model';
import { atividade, pessoa, sessao, SP } from '../test/fabricas';
import { recursosCalDAV } from './caldav';
import { expandirEventos } from './eventos';
import { dobrar, escaparTexto, eventosDoICS, gerarICS, lerICS } from './ics';

const iso = (s: string) => SP(s).toISOString();
const AGORA = SP('2026-10-13T12:00');
const T = '2026-10-01T15:00:00.000Z';

const evento = (p: Partial<Evento> & Pick<Evento, 'id' | 'titulo' | 'inicio' | 'fim'>): Evento => ({
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  fixo: true,
  pessoaId: null,
  rrule: null,
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
  ...p,
});

const aula = evento({
  id: 'aula',
  titulo: 'Aula',
  inicio: iso('2026-10-13T19:00'),
  fim: iso('2026-10-13T21:00'),
  rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
  exdatas: [iso('2026-10-20T19:00')],
});
const aulaEditada = evento({
  id: 'x1',
  titulo: 'Aula (sala 2)',
  inicio: iso('2026-10-15T20:00'),
  fim: iso('2026-10-15T22:00'),
  serieId: 'aula',
  ocorrenciaOriginal: iso('2026-10-15T19:00'),
});
const dentista = evento({
  id: 'dentista',
  titulo: 'Dentista; retorno, 2ª consulta',
  inicio: iso('2026-10-14T15:00'),
  fim: iso('2026-10-14T16:00'),
  pessoaId: 'p1',
  fixo: false,
});

const linhas = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n');

describe('gerarICS', () => {
  const ics = gerarICS({ eventos: [aula, aulaEditada, dentista], pessoas: [pessoa({ id: 'p1', nome: 'Ana' })] }, { agora: AGORA });

  it('usa CRLF, cabeçalho e fuso de São Paulo', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(linhas(ics)).toContain('X-WR-TIMEZONE:America/Sao_Paulo');
    expect(linhas(ics)).toContain('TZID:America/Sao_Paulo');
  });

  it('série com RRULE, EXDATE e ocorrência editada com RECURRENCE-ID no mesmo UID', () => {
    const l = linhas(ics);
    expect(l).toContain('DTSTART;TZID=America/Sao_Paulo:20261013T190000');
    expect(l).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH');
    expect(l).toContain('EXDATE;TZID=America/Sao_Paulo:20261020T190000');
    expect(l).toContain('RECURRENCE-ID;TZID=America/Sao_Paulo:20261015T190000');
    expect(l.filter((x) => x === 'UID:aula@rumo')).toHaveLength(2);
  });

  it('escapa texto, inclui a pessoa e marca não fixo como TRANSPARENT', () => {
    const l = linhas(ics);
    expect(l).toContain('SUMMARY:Dentista\\; retorno\\, 2ª consulta');
    expect(l).toContain('DESCRIPTION:Com Ana');
    expect(l).toContain('TRANSP:TRANSPARENT');
  });

  it('feed assinável sugere atualizar a cada hora', () => {
    expect(linhas(gerarICS({ eventos: [] }, { feed: true }))).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
  });

  it('sessões planejadas entram como "Atividade"; feitas e excluídas não', () => {
    const violao: Atividade = atividade({ id: 'a1', nome: 'Violão' });
    const sessoes: Sessao[] = [
      sessao(SP('2026-10-16T08:00'), { id: 's1', origem: 'planejada' }),
      sessao(SP('2026-10-13T07:00'), { id: 's2', origem: 'registrada' }),
      sessao(SP('2026-10-17T08:00'), { id: 's3', origem: 'planejada', excluidoEm: T }),
    ];
    const l = linhas(gerarICS({ eventos: [], sessoes, atividades: [violao] }, { agora: AGORA }));
    expect(l.filter((x) => x.startsWith('UID:'))).toEqual(['UID:sessao-s1@rumo']);
    expect(l).toContain('CATEGORIES:Atividade');
    expect(l).toContain('SUMMARY:Violão');
  });

  it('não exporta excluídos nem ocorrências editadas de série excluída', () => {
    const ics2 = gerarICS({ eventos: [{ ...aula, excluidoEm: T }, aulaEditada] });
    expect(ics2).not.toContain('BEGIN:VEVENT');
  });
});

describe('dobra de linhas', () => {
  it('quebra em até 75 octetos sem partir acentos, e desdobrar devolve o original', () => {
    const longo = `SUMMARY:${'Reunião com a coordenação pedagógica — ação '.repeat(4)}`;
    const dobrada = dobrar(longo);
    for (const l of dobrada.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(dobrada.replace(/\r\n /g, '')).toBe(longo);
  });

  it('escapa barra, ponto e vírgula, vírgula e quebra de linha', () => {
    expect(escaparTexto('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});

describe('lerICS', () => {
  it('ida e volta: a agenda lida do arquivo é a mesma', () => {
    const ics = gerarICS({ eventos: [aula, aulaEditada, dentista] }, { agora: AGORA });
    const { eventos: lidos, avisos } = lerICS(ics);
    expect(avisos).toEqual([]);
    const relidos = eventosDoICS(lidos).map((e) => ({ ...e, criadoEm: T, atualizadoEm: T, excluidoEm: null }));
    const agenda = (lista: Evento[]) =>
      expandirEventos(lista, SP('2026-10-12T00:00'), SP('2026-11-02T00:00')).map((e) => `${e.inicio} ${e.fim} ${e.titulo} ${e.fixo}`);
    expect(agenda(relidos)).toEqual(agenda([aula, aulaEditada, dentista]));
  });

  it('lê arquivos de outros calendários: UTC, DURATION, dia inteiro, alarmes e regras não suportadas', () => {
    const externo = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:abc@google.com',
      'DTSTART:20261014T180000Z',
      'DURATION:PT1H30M',
      'SUMMARY:Call',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'DESCRIPTION:lembrete',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:feriado',
      'DTSTART;VALUE=DATE:20261102',
      'SUMMARY:Finados',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:mensal',
      'DTSTART;TZID=America/Sao_Paulo:20261001T090000',
      'RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1',
      'SUMMARY:Reunião',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const { eventos, avisos } = lerICS(externo);
    expect(eventos.map((e) => [e.titulo, e.inicio, e.fim, e.fixo])).toEqual([
      ['Call', '2026-10-14T18:00:00.000Z', '2026-10-14T19:30:00.000Z', true],
      ['Finados', '2026-11-02T03:00:00.000Z', '2026-11-03T03:00:00.000Z', false],
      ['Reunião', '2026-10-01T12:00:00.000Z', '2026-10-01T13:00:00.000Z', true],
    ]);
    expect(eventos[0]!.descricao).toBe(''); // a descrição do alarme não vaza para o evento
    expect(avisos).toEqual(['"Reunião": Parte da regra não suportada: BYSETPOS; a série aparece só na primeira data']);
  });
});

describe('recursosCalDAV', () => {
  it('um recurso por UID, com a série e suas ocorrências editadas juntas', () => {
    const r = recursosCalDAV([aula, aulaEditada, dentista], { agora: AGORA });
    expect(r.map((x) => x.uid)).toEqual(['aula@rumo', 'dentista@rumo']);
    expect(lerICS(r[0]!.ics).eventos).toHaveLength(2);
    expect(r.every((x) => x.etag === null)).toBe(true);
  });
});
