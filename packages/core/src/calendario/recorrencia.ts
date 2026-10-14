import { TZDate, tz } from '@date-fns/tz';
import { format } from 'date-fns';
import type { DiaSemana, ISODateTime } from '../model';
import { FUSO_PADRAO } from '../time';

/**
 * Subconjunto suportado da RRULE (RFC 5545, seção 3.3.10):
 * FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, COUNT, UNTIL, BYDAY (com ordinal em MONTHLY,
 * ex.: 2TU, -1FR; como filtro em DAILY), BYMONTHDAY (MONTHLY) e WKST.
 * Outras partes (BYSETPOS, BYWEEKNO, BYHOUR…) são recusadas com uma mensagem clara.
 */
export type Frequencia = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface DiaDaRegra {
  dia: DiaSemana;
  /** Só em MONTHLY: 1 = primeiro, 2 = segundo… −1 = último do mês. */
  ordinal?: number;
}

export interface RegraRecorrencia {
  freq: Frequencia;
  intervalo: number;
  diasSemana: DiaDaRegra[];
  diasMes: number[];
  contagem: number | null;
  /** Último instante possível (inclusivo), como o UNTIL. */
  ate: ISODateTime | null;
  inicioSemana: DiaSemana;
}

export type ResultadoRegra = { ok: true; regra: RegraRecorrencia } | { ok: false; erro: string };

const CODIGOS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const FREQS: readonly Frequencia[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const SUPORTADAS = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'WKST']);

const codigoParaDia = (c: string) => CODIGOS.indexOf(c as (typeof CODIGOS)[number]) as DiaSemana | -1;

function lerUntil(v: string, fuso: string): ISODateTime | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(v);
  if (!m) return null;
  const [, a, me, d, h, mi, s, z] = m;
  if (h === undefined) {
    // Só data: até o fim desse dia, no fuso (leniência comum em calendários).
    return new Date(new TZDate(+a!, +me! - 1, +d!, 23, 59, 59, fuso).getTime()).toISOString();
  }
  if (z) return new Date(Date.UTC(+a!, +me! - 1, +d!, +h!, +mi!, +s!)).toISOString();
  return new Date(new TZDate(+a!, +me! - 1, +d!, +h!, +mi!, +s!, fuso).getTime()).toISOString();
}

/** Lê uma RRULE ("FREQ=WEEKLY;BYDAY=TU,TH", com ou sem o prefixo "RRULE:"). */
export function lerRRule(texto: string, fuso = FUSO_PADRAO): ResultadoRegra {
  const corpo = texto.trim().replace(/^RRULE:/i, '');
  const partes = new Map<string, string>();
  for (const par of corpo.split(';').filter(Boolean)) {
    const [k, v] = par.split('=');
    if (!k || v === undefined) return { ok: false, erro: `Trecho inválido na regra: "${par}"` };
    partes.set(k.toUpperCase(), v.toUpperCase());
  }
  for (const k of partes.keys()) {
    if (!SUPORTADAS.has(k)) return { ok: false, erro: `Parte da regra não suportada: ${k}` };
  }

  const freq = partes.get('FREQ') as Frequencia | undefined;
  if (!freq || !FREQS.includes(freq)) return { ok: false, erro: 'Frequência ausente ou não suportada' };

  const intervalo = partes.has('INTERVAL') ? Number(partes.get('INTERVAL')) : 1;
  if (!Number.isInteger(intervalo) || intervalo < 1) return { ok: false, erro: 'INTERVAL inválido' };

  const contagem = partes.has('COUNT') ? Number(partes.get('COUNT')) : null;
  if (contagem !== null && (!Number.isInteger(contagem) || contagem < 1)) return { ok: false, erro: 'COUNT inválido' };

  const ate = partes.has('UNTIL') ? lerUntil(partes.get('UNTIL')!, fuso) : null;
  if (partes.has('UNTIL') && !ate) return { ok: false, erro: 'UNTIL inválido' };
  if (contagem !== null && ate) return { ok: false, erro: 'COUNT e UNTIL não podem vir juntos' };

  const diasSemana: DiaDaRegra[] = [];
  for (const item of partes.get('BYDAY')?.split(',') ?? []) {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(item);
    if (!m) return { ok: false, erro: `BYDAY inválido: ${item}` };
    const ordinal = m[1] ? Number(m[1]) : undefined;
    if (ordinal !== undefined) {
      if (freq !== 'MONTHLY') return { ok: false, erro: 'Dia com ordinal (ex.: 2TU) só é suportado em repetição mensal' };
      if (ordinal === 0 || Math.abs(ordinal) > 5) return { ok: false, erro: `BYDAY inválido: ${item}` };
    }
    diasSemana.push(ordinal === undefined ? { dia: codigoParaDia(m[2]!) as DiaSemana } : { dia: codigoParaDia(m[2]!) as DiaSemana, ordinal });
  }
  if (diasSemana.length && freq === 'YEARLY') return { ok: false, erro: 'BYDAY em repetição anual não é suportado' };

  const diasMes: number[] = [];
  for (const item of partes.get('BYMONTHDAY')?.split(',') ?? []) {
    const n = Number(item);
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 31) return { ok: false, erro: `BYMONTHDAY inválido: ${item}` };
    diasMes.push(n);
  }
  if (diasMes.length && freq !== 'MONTHLY') return { ok: false, erro: 'BYMONTHDAY só é suportado em repetição mensal' };

  const wkst = partes.has('WKST') ? codigoParaDia(partes.get('WKST')!) : 1;
  if (wkst === -1) return { ok: false, erro: 'WKST inválido' };

  return { ok: true, regra: { freq, intervalo, diasSemana, diasMes, contagem, ate, inicioSemana: wkst } };
}

/** Escreve a regra no formato RRULE (sem o prefixo), com UNTIL em UTC. */
export function escreverRRule(r: RegraRecorrencia): string {
  const partes = [`FREQ=${r.freq}`];
  if (r.intervalo > 1) partes.push(`INTERVAL=${r.intervalo}`);
  if (r.diasSemana.length) partes.push(`BYDAY=${r.diasSemana.map((d) => `${d.ordinal ?? ''}${CODIGOS[d.dia]}`).join(',')}`);
  if (r.diasMes.length) partes.push(`BYMONTHDAY=${r.diasMes.join(',')}`);
  if (r.contagem !== null) partes.push(`COUNT=${r.contagem}`);
  if (r.ate) partes.push(`UNTIL=${format(new Date(r.ate), "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') })}`);
  if (r.inicioSemana !== 1) partes.push(`WKST=${CODIGOS[r.inicioSemana]}`);
  return partes.join(';');
}

// ——— Expansão ———

/** Datas de calendário como número de dias desde 1970-01-01 (aritmética sem fuso). */
const diaNum = (a: number, m: number, d: number) => Math.round(Date.UTC(a, m, d) / 86_400_000);
const deDiaNum = (n: number) => {
  const d = new Date(n * 86_400_000);
  return { a: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), sem: d.getUTCDay() as DiaSemana };
};
const diasNoMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();

/** Até onde procurar quando nada casa (ex.: BYMONTHDAY=31 com INTERVAL=2 começando em fevereiro). */
const MAX_PERIODOS = 50_000;

/**
 * Inícios das ocorrências com início em [desde, ate), em ordem. O COUNT é contado desde o
 * DTSTART, mesmo para ocorrências antes da janela. A hora local do DTSTART se mantém em
 * todas as ocorrências (no fuso), como manda a RFC para DTSTART com TZID.
 */
export function ocorrencias(dtstart: Date, regra: RegraRecorrencia, desde: Date, ate: Date, fuso = FUSO_PADRAO): Date[] {
  const local = new TZDate(dtstart.getTime(), fuso);
  const [a0, m0, d0] = [local.getFullYear(), local.getMonth(), local.getDate()];
  const [h, mi, s] = [local.getHours(), local.getMinutes(), local.getSeconds()];
  const base = { a0, m0, d0, dia0: diaNum(a0, m0, d0), sem0: local.getDay() as DiaSemana };
  const fimJanela = ate.getTime();
  const until = regra.ate ? new Date(regra.ate).getTime() : Infinity;
  const instante = (n: number) => {
    const { a, m, d } = deDiaNum(n);
    return new TZDate(a, m, d, h, mi, s, fuso).getTime();
  };

  // Sem COUNT, DAILY/WEEKLY pulam direto para perto da janela (séries antigas não custam caro).
  let p0 = 0;
  if (regra.contagem === null && (regra.freq === 'DAILY' || regra.freq === 'WEEKLY')) {
    const l = new TZDate(desde.getTime(), fuso);
    const alvo = diaNum(l.getFullYear(), l.getMonth(), l.getDate());
    const diasPorPeriodo = (regra.freq === 'DAILY' ? 1 : 7) * regra.intervalo;
    p0 = Math.max(0, Math.floor((alvo - base.dia0) / diasPorPeriodo) - 1);
  }

  const resultado: Date[] = [];
  let contados = 0;
  for (let p = p0; p < p0 + MAX_PERIODOS; p++) {
    if (instante(primeiroDiaDoPeriodo(regra, p, base)) >= Math.min(fimJanela, until + 1)) break;
    for (const n of candidatosDoPeriodo(regra, p, base)) {
      if (n < base.dia0) continue;
      const t = instante(n);
      if (t >= fimJanela || t > until) return resultado;
      if (regra.contagem !== null && contados >= regra.contagem) return resultado;
      contados++;
      if (t >= desde.getTime()) resultado.push(new Date(t));
    }
  }
  return resultado;
}

function primeiroDiaDoPeriodo(regra: RegraRecorrencia, p: number, base: { a0: number; m0: number; dia0: number; sem0: DiaSemana }) {
  if (regra.freq === 'DAILY') return base.dia0 + p * regra.intervalo;
  if (regra.freq === 'WEEKLY') return base.dia0 - ((base.sem0 - regra.inicioSemana + 7) % 7) + p * 7 * regra.intervalo;
  const { a, m } = inicioDoPeriodoMensal(regra, p, base.a0, base.m0);
  return diaNum(a, m, 1);
}

function inicioDoPeriodoMensal(regra: RegraRecorrencia, p: number, a0: number, m0: number) {
  const meses = regra.freq === 'YEARLY' ? p * 12 * regra.intervalo : p * regra.intervalo;
  const total = m0 + meses;
  return { a: a0 + Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

function candidatosDoPeriodo(
  regra: RegraRecorrencia,
  p: number,
  base: { a0: number; m0: number; dia0: number; d0: number; sem0: DiaSemana },
): number[] {
  const { freq, intervalo, diasSemana, diasMes } = regra;
  if (freq === 'DAILY') {
    const n = base.dia0 + p * intervalo;
    if (diasSemana.length && !diasSemana.some((d) => d.dia === deDiaNum(n).sem)) return [];
    return [n];
  }
  if (freq === 'WEEKLY') {
    const inicioSemana0 = base.dia0 - ((base.sem0 - regra.inicioSemana + 7) % 7);
    const inicio = inicioSemana0 + p * 7 * intervalo;
    const dias = diasSemana.length ? diasSemana.map((d) => d.dia) : [base.sem0];
    return [...new Set(dias.map((dia) => inicio + ((dia - regra.inicioSemana + 7) % 7)))].sort((x, y) => x - y);
  }
  const { a, m } = inicioDoPeriodoMensal(regra, p, base.a0, base.m0);
  const total = diasNoMes(a, m);
  if (freq === 'YEARLY') {
    return base.d0 <= diasNoMes(a, base.m0) ? [diaNum(a, base.m0, base.d0)] : [];
  }
  // MONTHLY
  const primeiro = diaNum(a, m, 1);
  let dias: number[];
  if (!diasSemana.length && !diasMes.length) {
    dias = base.d0 <= total ? [base.d0] : [];
  } else {
    let porMes: number[] | null = null;
    if (diasMes.length) porMes = diasMes.map((d) => (d > 0 ? d : total + d + 1)).filter((d) => d >= 1 && d <= total);
    let porSemana: number[] | null = null;
    if (diasSemana.length) {
      porSemana = [];
      for (const { dia, ordinal } of diasSemana) {
        const doDia: number[] = [];
        for (let d = 1; d <= total; d++) if (deDiaNum(primeiro + d - 1).sem === dia) doDia.push(d);
        if (ordinal === undefined) porSemana.push(...doDia);
        else {
          const escolhido = ordinal > 0 ? doDia[ordinal - 1] : doDia[doDia.length + ordinal];
          if (escolhido !== undefined) porSemana.push(escolhido);
        }
      }
    }
    // BYMONTHDAY e BYDAY juntos: interseção (RFC 5545).
    dias = porMes && porSemana ? porMes.filter((d) => porSemana!.includes(d)) : (porMes ?? porSemana ?? []);
  }
  return [...new Set(dias)].sort((x, y) => x - y).map((d) => primeiro + d - 1);
}
