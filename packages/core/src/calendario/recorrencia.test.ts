import { describe, expect, it } from 'vitest';
import { SP } from '../test/fabricas';
import { escreverRRule, lerRRule, ocorrencias, type RegraRecorrencia } from './recorrencia';

const regra = (texto: string): RegraRecorrencia => {
  const r = lerRRule(texto);
  if (!r.ok) throw new Error(r.erro);
  return r.regra;
};

/** Ocorrências como "AAAA-MM-DD HH:MM" no horário de São Paulo. */
const local = (datas: Date[]) =>
  datas.map((d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d));

const expandir = (texto: string, inicio: string, de: string, ate: string) =>
  local(ocorrencias(SP(inicio), regra(texto), SP(de), SP(ate)));

describe('lerRRule / escreverRRule', () => {
  it('lê as partes suportadas', () => {
    expect(regra('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=10')).toEqual({
      freq: 'WEEKLY',
      intervalo: 2,
      diasSemana: [{ dia: 2 }, { dia: 4 }],
      diasMes: [],
      contagem: 10,
      ate: null,
      inicioSemana: 1,
    });
    expect(regra('FREQ=MONTHLY;BYDAY=2TU,-1FR').diasSemana).toEqual([
      { dia: 2, ordinal: 2 },
      { dia: 5, ordinal: -1 },
    ]);
    expect(regra('FREQ=MONTHLY;BYMONTHDAY=1,-1').diasMes).toEqual([1, -1]);
  });

  it('UNTIL em UTC, em hora local ou só data (fim do dia em São Paulo)', () => {
    expect(regra('FREQ=DAILY;UNTIL=20261031T225959Z').ate).toBe('2026-10-31T22:59:59.000Z');
    expect(regra('FREQ=DAILY;UNTIL=20261031T195959').ate).toBe('2026-10-31T22:59:59.000Z');
    expect(regra('FREQ=DAILY;UNTIL=20261031').ate).toBe('2026-11-01T02:59:59.000Z');
  });

  it('recusa o que não suporta, com mensagem clara', () => {
    expect(lerRRule('FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2')).toEqual({ ok: false, erro: 'Parte da regra não suportada: BYSETPOS' });
    expect(lerRRule('FREQ=HOURLY')).toEqual({ ok: false, erro: 'Frequência ausente ou não suportada' });
    expect(lerRRule('FREQ=DAILY;COUNT=3;UNTIL=20261031')).toEqual({ ok: false, erro: 'COUNT e UNTIL não podem vir juntos' });
    expect(lerRRule('FREQ=WEEKLY;BYDAY=2TU').ok).toBe(false);
    expect(lerRRule('FREQ=WEEKLY;INTERVAL=0').ok).toBe(false);
  });

  it('ida e volta preserva a regra', () => {
    for (const t of [
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=10',
      'FREQ=MONTHLY;BYDAY=2TU',
      'FREQ=MONTHLY;BYMONTHDAY=-1;UNTIL=20271231T025959Z',
      'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
      'FREQ=YEARLY',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU;WKST=SU',
    ]) {
      expect(escreverRRule(regra(t))).toBe(t);
    }
  });
});

describe('ocorrencias', () => {
  it('semanal em terça e quinta, mantendo 19:00 em São Paulo', () => {
    expect(expandir('FREQ=WEEKLY;BYDAY=TU,TH', '2026-10-13T19:00', '2026-10-12T00:00', '2026-10-26T00:00')).toEqual([
      '2026-10-13 19:00',
      '2026-10-15 19:00',
      '2026-10-20 19:00',
      '2026-10-22 19:00',
    ]);
  });

  it('quinzenal respeita a semana do início (WKST)', () => {
    expect(expandir('FREQ=WEEKLY;INTERVAL=2', '2026-10-13T08:00', '2026-10-01T00:00', '2026-11-20T00:00')).toEqual([
      '2026-10-13 08:00',
      '2026-10-27 08:00',
      '2026-11-10 08:00',
    ]);
  });

  it('COUNT conta desde o início, mesmo fora da janela', () => {
    expect(expandir('FREQ=DAILY;COUNT=3', '2026-10-13T07:00', '2026-10-01T00:00', '2026-12-01T00:00')).toHaveLength(3);
    expect(expandir('FREQ=DAILY;COUNT=3', '2026-10-13T07:00', '2026-10-14T00:00', '2026-12-01T00:00')).toEqual([
      '2026-10-14 07:00',
      '2026-10-15 07:00',
    ]);
  });

  it('UNTIL é inclusivo', () => {
    expect(expandir('FREQ=DAILY;UNTIL=20261015T100000Z', '2026-10-13T07:00', '2026-10-01T00:00', '2026-12-01T00:00')).toEqual([
      '2026-10-13 07:00',
      '2026-10-14 07:00',
      '2026-10-15 07:00',
    ]);
  });

  it('dias úteis (DAILY com BYDAY)', () => {
    expect(expandir('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', '2026-10-15T09:00', '2026-10-15T00:00', '2026-10-21T00:00')).toEqual([
      '2026-10-15 09:00',
      '2026-10-16 09:00',
      '2026-10-19 09:00',
      '2026-10-20 09:00',
    ]);
  });

  it('mensal no dia 31 pula meses sem dia 31', () => {
    expect(expandir('FREQ=MONTHLY', '2026-10-31T10:00', '2026-10-01T00:00', '2027-04-01T00:00')).toEqual([
      '2026-10-31 10:00',
      '2026-12-31 10:00',
      '2027-01-31 10:00',
      '2027-03-31 10:00',
    ]);
  });

  it('mensal na segunda terça e na última sexta', () => {
    expect(expandir('FREQ=MONTHLY;BYDAY=2TU', '2026-10-13T19:00', '2026-10-01T00:00', '2027-01-01T00:00')).toEqual([
      '2026-10-13 19:00',
      '2026-11-10 19:00',
      '2026-12-08 19:00',
    ]);
    expect(expandir('FREQ=MONTHLY;BYDAY=-1FR', '2026-10-30T18:00', '2026-10-01T00:00', '2027-01-01T00:00')).toEqual([
      '2026-10-30 18:00',
      '2026-11-27 18:00',
      '2026-12-25 18:00',
    ]);
  });

  it('último dia do mês (BYMONTHDAY=-1)', () => {
    expect(expandir('FREQ=MONTHLY;BYMONTHDAY=-1', '2027-01-31T12:00', '2027-01-01T00:00', '2027-05-01T00:00')).toEqual([
      '2027-01-31 12:00',
      '2027-02-28 12:00',
      '2027-03-31 12:00',
      '2027-04-30 12:00',
    ]);
  });

  it('anual em 29/02 só nos anos bissextos', () => {
    expect(expandir('FREQ=YEARLY', '2028-02-29T09:00', '2028-01-01T00:00', '2037-01-01T00:00')).toEqual([
      '2028-02-29 09:00',
      '2032-02-29 09:00',
      '2036-02-29 09:00',
    ]);
  });

  it('23:30 em São Paulo continua 23:30 local (dia seguinte em UTC)', () => {
    const datas = ocorrencias(SP('2026-10-13T23:30'), regra('FREQ=WEEKLY;BYDAY=TU'), SP('2026-10-12T00:00'), SP('2026-10-28T00:00'));
    expect(datas.map((d) => d.toISOString())).toEqual(['2026-10-14T02:30:00.000Z', '2026-10-21T02:30:00.000Z', '2026-10-28T02:30:00.000Z']);
    expect(local(datas)).toEqual(['2026-10-13 23:30', '2026-10-20 23:30', '2026-10-27 23:30']);
  });

  it('série diária antiga, sem fim, expande rápido na janela atual', () => {
    const t0 = performance.now();
    expect(expandir('FREQ=DAILY', '2020-01-01T06:00', '2026-10-13T00:00', '2026-10-15T00:00')).toEqual(['2026-10-13 06:00', '2026-10-14 06:00']);
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it('mantém a hora local mesmo com o horário de verão histórico de São Paulo', () => {
    // 06:00 de janeiro de 2019 era horário de verão (UTC−2); em 2026 não há (UTC−3).
    const inicio = new Date('2019-01-01T06:00:00-02:00');
    const datas = ocorrencias(inicio, regra('FREQ=DAILY'), SP('2026-10-13T00:00'), SP('2026-10-14T00:00'));
    expect(local(datas)).toEqual(['2026-10-13 06:00']);
    expect(datas[0]!.toISOString()).toBe('2026-10-13T09:00:00.000Z');
  });

  it('regra que nunca casa termina pela janela', () => {
    expect(expandir('FREQ=MONTHLY;INTERVAL=12;BYMONTHDAY=30', '2027-02-01T10:00', '2027-01-01T00:00', '2030-01-01T00:00')).toEqual([]);
  });
});
