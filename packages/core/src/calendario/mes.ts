import { TZDate } from '@date-fns/tz';
import type { ISODate } from '../model';
import { CALENDARIO_PADRAO, inicioDaSemana, inicioDoDiaApos, paraDataLocal, type Calendario } from '../time';

export interface DiaDoMes {
  data: ISODate;
  /** Pertence ao mês exibido (os demais completam a primeira e a última semana). */
  doMes: boolean;
}

export interface GradeDoMes {
  ano: number;
  /** 0 = janeiro. */
  mes: number;
  /** Semanas completas, de 4 a 6, começando no início de semana configurado. */
  semanas: DiaDoMes[][];
}

/** Grade do mês que contém `referencia`, no fuso e com o início de semana do calendário. */
export function gradeDoMes(referencia: Date, cal: Calendario = CALENDARIO_PADRAO): GradeDoMes {
  const r = new TZDate(referencia.getTime(), cal.fuso);
  const ano = r.getFullYear();
  const mes = r.getMonth();
  const primeiro = new Date(new TZDate(ano, mes, 1, 12, 0, 0, cal.fuso).getTime());
  const prefixoMes = `${ano}-${String(mes + 1).padStart(2, '0')}`;

  const semanas: DiaDoMes[][] = [];
  let dia = inicioDaSemana(primeiro, cal);
  do {
    const semana: DiaDoMes[] = [];
    for (let i = 0; i < 7; i++) {
      const data = paraDataLocal(dia, cal.fuso);
      semana.push({ data, doMes: data.startsWith(prefixoMes) });
      dia = inicioDoDiaApos(dia, 1, cal.fuso);
    }
    semanas.push(semana);
  } while (paraDataLocal(dia, cal.fuso).startsWith(prefixoMes));
  return { ano, mes, semanas };
}

/** O mesmo dia `n` meses depois (no dia 1, para não pular meses curtos). */
export function mesApos(referencia: Date, n: number, cal: Calendario = CALENDARIO_PADRAO): Date {
  const r = new TZDate(referencia.getTime(), cal.fuso);
  return new Date(new TZDate(r.getFullYear(), r.getMonth() + n, 1, 12, 0, 0, cal.fuso).getTime());
}
