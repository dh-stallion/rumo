import { TZDate } from '@date-fns/tz';
import type { DiaSemana, ISODate } from '../model';
import { combinarDataHora, formatar, FUSO_PADRAO, paraDataLocal } from '../time';
import { escreverRRule, lerRRule, type RegraRecorrencia } from './recorrencia';

/** As opções de repetição do formulário; regras fora delas ficam como "personalizada". */
export type TipoRepeticao =
  | 'nunca'
  | 'diario'
  | 'uteis'
  | 'semanal'
  | 'quinzenal'
  | 'mensal-dia'
  | 'mensal-semana'
  | 'anual'
  | 'personalizado';

export type Termino = { tipo: 'nunca' } | { tipo: 'data'; data: ISODate } | { tipo: 'vezes'; vezes: number };

export interface Repeticao {
  tipo: TipoRepeticao;
  /** Dias da semana (semanal/quinzenal). */
  dias: DiaSemana[];
  termino: Termino;
  /** Só para "personalizado": a regra original, preservada como veio. */
  rrule?: string;
}

const UTEIS: DiaSemana[] = [1, 2, 3, 4, 5];
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** Ordem de exibição e de escrita: segunda primeiro. */
const ordemSemana = (a: DiaSemana, b: DiaSemana) => ((a + 6) % 7) - ((b + 6) % 7);

const local = (d: Date, fuso: string) => new TZDate(d.getTime(), fuso);
export const diaDaSemanaDe = (d: Date, fuso = FUSO_PADRAO) => local(d, fuso).getDay() as DiaSemana;

/** Qual ocorrência do dia da semana no mês: 1–4; a 5ª vira −1 ("a última"), que existe todo mês. */
export function ordinalNoMes(d: Date, fuso = FUSO_PADRAO): number {
  const n = Math.ceil(local(d, fuso).getDate() / 7);
  return n === 5 ? -1 : n;
}

const mesmaLista = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

function terminoDe(r: RegraRecorrencia, fuso: string): Termino {
  if (r.contagem !== null) return { tipo: 'vezes', vezes: r.contagem };
  if (r.ate) return { tipo: 'data', data: paraDataLocal(r.ate, fuso) };
  return { tipo: 'nunca' };
}

export function repeticaoDe(rrule: string | null, inicio: Date, fuso = FUSO_PADRAO): Repeticao {
  const padrao: Repeticao = { tipo: 'nunca', dias: [diaDaSemanaDe(inicio, fuso)], termino: { tipo: 'nunca' } };
  if (!rrule) return padrao;
  const lida = lerRRule(rrule, fuso);
  if (!lida.ok) return { ...padrao, tipo: 'personalizado', rrule };
  const r = lida.regra;
  const termino = terminoDe(r, fuso);
  const personalizado: Repeticao = { ...padrao, tipo: 'personalizado', termino, rrule };
  const semOrdinal = r.diasSemana.every((d) => d.ordinal === undefined);
  const dias = r.diasSemana.map((d) => d.dia);

  if (r.diasMes.length || r.inicioSemana !== 1) return personalizado;
  if (r.freq === 'DAILY' && r.intervalo === 1) {
    if (!dias.length) return { ...padrao, tipo: 'diario', termino };
    if (semOrdinal && mesmaLista(dias, UTEIS)) return { ...padrao, tipo: 'uteis', termino };
  }
  if (r.freq === 'WEEKLY' && (r.intervalo === 1 || r.intervalo === 2) && semOrdinal) {
    return {
      tipo: r.intervalo === 1 ? 'semanal' : 'quinzenal',
      dias: (dias.length ? dias : padrao.dias).sort(ordemSemana),
      termino,
    };
  }
  if (r.freq === 'MONTHLY' && r.intervalo === 1) {
    if (!dias.length) return { ...padrao, tipo: 'mensal-dia', termino };
    const [unico] = r.diasSemana;
    if (r.diasSemana.length === 1 && unico!.dia === diaDaSemanaDe(inicio, fuso) && unico!.ordinal === ordinalNoMes(inicio, fuso)) {
      return { ...padrao, tipo: 'mensal-semana', termino };
    }
  }
  if (r.freq === 'YEARLY' && r.intervalo === 1) return { ...padrao, tipo: 'anual', termino };
  return personalizado;
}

export function rruleDe(rep: Repeticao, inicio: Date, fuso = FUSO_PADRAO): string | null {
  if (rep.tipo === 'nunca') return null;
  if (rep.tipo === 'personalizado') return rep.rrule ?? null;
  const base: RegraRecorrencia = { freq: 'DAILY', intervalo: 1, diasSemana: [], diasMes: [], contagem: null, ate: null, inicioSemana: 1 };
  const r: RegraRecorrencia = (() => {
    switch (rep.tipo) {
      case 'diario':
        return base;
      case 'uteis':
        return { ...base, diasSemana: UTEIS.map((dia) => ({ dia })) };
      case 'semanal':
      case 'quinzenal': {
        const dias = rep.dias.length ? [...new Set(rep.dias)].sort(ordemSemana) : [diaDaSemanaDe(inicio, fuso)];
        return { ...base, freq: 'WEEKLY', intervalo: rep.tipo === 'semanal' ? 1 : 2, diasSemana: dias.map((dia) => ({ dia })) };
      }
      case 'mensal-dia':
        return { ...base, freq: 'MONTHLY' };
      case 'mensal-semana':
        return { ...base, freq: 'MONTHLY', diasSemana: [{ dia: diaDaSemanaDe(inicio, fuso), ordinal: ordinalNoMes(inicio, fuso) }] };
      case 'anual':
        return { ...base, freq: 'YEARLY' };
    }
  })();
  if (rep.termino.tipo === 'vezes') r.contagem = Math.max(1, Math.floor(rep.termino.vezes));
  // Termina "em" uma data: inclui o dia inteiro (até 23:59:59 local).
  if (rep.termino.tipo === 'data') r.ate = new Date(combinarDataHora(rep.termino.data, '23:59', fuso).getTime() + 59_000).toISOString();
  return escreverRRule(r);
}

function noDiaDaSemana(dia: DiaSemana, ordinal: number): string {
  // Sábado e domingo são masculinos: "no 2º sábado", "no último domingo".
  const masc = dia === 0 || dia === 6;
  const ord = ordinal === -1 ? (masc ? 'último' : 'última') : `${ordinal}${masc ? 'º' : 'ª'}`;
  return `${masc ? 'no' : 'na'} ${ord} ${NOMES[dia]}`;
}

/** "Toda semana: ter, qui · até 20/12/2026" */
export function descreverRepeticao(rep: Repeticao, inicio: Date, fuso = FUSO_PADRAO): string {
  const base = (() => {
    switch (rep.tipo) {
      case 'nunca':
        return 'Não repete';
      case 'diario':
        return 'Todo dia';
      case 'uteis':
        return 'Dias úteis (seg–sex)';
      case 'semanal':
        return `Toda semana: ${[...rep.dias].sort(ordemSemana).map((d) => CURTOS[d]).join(', ')}`;
      case 'quinzenal':
        return `A cada 2 semanas: ${[...rep.dias].sort(ordemSemana).map((d) => CURTOS[d]).join(', ')}`;
      case 'mensal-dia':
        return `Todo mês no dia ${formatar(inicio, 'd', fuso)}`;
      case 'mensal-semana':
        return `Todo mês ${noDiaDaSemana(diaDaSemanaDe(inicio, fuso), ordinalNoMes(inicio, fuso))}`;
      case 'anual':
        return `Todo ano em ${formatar(inicio, 'dd/MM', fuso)}`;
      case 'personalizado':
        return 'Regra personalizada';
    }
  })();
  if (rep.tipo === 'nunca') return base;
  if (rep.termino.tipo === 'data') return `${base} · até ${formatar(combinarDataHora(rep.termino.data, '12:00', fuso), 'dd/MM/yyyy', fuso)}`;
  if (rep.termino.tipo === 'vezes') return `${base} · ${rep.termino.vezes} ${rep.termino.vezes === 1 ? 'vez' : 'vezes'}`;
  return base;
}
