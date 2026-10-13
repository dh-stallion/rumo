import { TZDate, tz } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, endOfDay, format, getDay, startOfDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DiaSemana, ISODate } from '../model';

export const FUSO_PADRAO = 'America/Sao_Paulo';

/** Como o usuário enxerga o calendário: fuso e primeiro dia da semana. */
export interface Calendario {
  fuso: string;
  inicioSemana: DiaSemana;
}

export const CALENDARIO_PADRAO: Calendario = { fuso: FUSO_PADRAO, inicioSemana: 1 };

/** TZDate serializa com offset local; devolvemos Date comum para manter ISO em UTC ("Z"). */
const paraDate = (d: Date) => new Date(d.getTime());

/** 00:00 do primeiro dia da semana de `agora`, no fuso. */
export function inicioDaSemana(agora: Date, cal = CALENDARIO_PADRAO): Date {
  return paraDate(startOfWeek(agora, { weekStartsOn: cal.inicioSemana, in: tz(cal.fuso) }));
}

/** Posição do dia na semana configurada: 0 = primeiro dia … 6 = último. */
export function posicaoNaSemana(data: Date, cal = CALENDARIO_PADRAO): number {
  return (getDay(data, { in: tz(cal.fuso) }) - cal.inicioSemana + 7) % 7;
}

/** Posição que um dia da semana (0 = domingo) ocupa na semana configurada. */
export const posicaoDoDia = (dia: DiaSemana, cal = CALENDARIO_PADRAO) => (dia - cal.inicioSemana + 7) % 7;

export function inicioDoDia(data: Date, fuso = FUSO_PADRAO): Date {
  return paraDate(startOfDay(data, { in: tz(fuso) }));
}

export function fimDoDia(data: Date, fuso = FUSO_PADRAO): Date {
  return paraDate(endOfDay(data, { in: tz(fuso) }));
}

/** 00:00 do dia `n` dias depois de `data`, no fuso. */
export function inicioDoDiaApos(data: Date, n: number, fuso = FUSO_PADRAO): Date {
  return paraDate(startOfDay(addDays(data, n, { in: tz(fuso) }), { in: tz(fuso) }));
}

/** Dias de calendário (no fuso) entre `passado` e `agora`; ontem = 1, mesmo dia = 0. */
export function diasEntre(passado: Date, agora: Date, fuso = FUSO_PADRAO): number {
  return differenceInCalendarDays(agora, passado, { in: tz(fuso) });
}

/** "2026-10-13" + "14:30" interpretados no fuso. */
export function combinarDataHora(data: ISODate, hora: string, fuso = FUSO_PADRAO): Date {
  const [a, m, d] = data.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  return paraDate(new TZDate(a!, m! - 1, d!, h ?? 0, min ?? 0, fuso));
}

export function formatar(data: Date | string, padrao: string, fuso = FUSO_PADRAO): string {
  return format(new Date(data), padrao, { in: tz(fuso), locale: ptBR });
}

export const paraDataLocal = (data: Date | string, fuso = FUSO_PADRAO): ISODate =>
  formatar(data, 'yyyy-MM-dd', fuso);

export const paraHoraLocal = (data: Date | string, fuso = FUSO_PADRAO): string =>
  formatar(data, 'HH:mm', fuso);
