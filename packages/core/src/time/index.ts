import { TZDate, tz } from '@date-fns/tz';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  getISODay,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ISODate } from '../model';

export const FUSO_PADRAO = 'America/Sao_Paulo';

/** TZDate serializa com offset local; devolvemos Date comum para manter ISO em UTC ("Z"). */
const paraDate = (d: Date) => new Date(d.getTime());

/** Segunda-feira 00:00 da semana de `agora`, no fuso. */
export function inicioDaSemana(agora: Date, fuso = FUSO_PADRAO): Date {
  return paraDate(startOfWeek(agora, { weekStartsOn: 1, in: tz(fuso) }));
}

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

/** 1 = segunda ... 7 = domingo. */
export function diaDaSemana(data: Date, fuso = FUSO_PADRAO): number {
  return getISODay(data, { in: tz(fuso) });
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
