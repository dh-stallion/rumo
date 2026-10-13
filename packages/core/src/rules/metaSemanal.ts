import type { Atividade, Sessao } from '../model';
import { diaDaSemana, FUSO_PADRAO, inicioDaSemana } from '../time';
import { sessoesFeitas } from './atraso';

export interface ProgressoSemanal {
  feitas: number;
  meta: number;
  /** Quanto já deveria ter sido feito pelo ritmo, contando só os dias já encerrados. */
  esperadoPeloRitmo: number;
  /** Dias que ainda restam na semana, incluindo hoje. */
  diasRestantes: number;
  atrasada: boolean;
}

/**
 * A meta pede atenção quando:
 * - o ritmo ficou para trás: feitas < floor(meta × diasEncerrados / 7); ou
 * - não sobra folga: o que falta exige fazer em todos os dias restantes (incluindo hoje).
 *
 * Ex.: meta 3 sem nada feito → aparece na quinta. Meta 1 → só no domingo.
 */
export function progressoSemanal(
  atividade: Atividade,
  sessoes: readonly Sessao[],
  agora: Date,
  fuso = FUSO_PADRAO,
): ProgressoSemanal {
  const inicio = inicioDaSemana(agora, fuso);
  const feitas = sessoesFeitas(atividade.id, sessoes, agora).filter(
    (s) => new Date(s.inicio) >= inicio,
  ).length;
  const meta = atividade.metaSemanal;
  const dia = diaDaSemana(agora, fuso);
  const diasRestantes = 8 - dia;
  const esperadoPeloRitmo = Math.floor((meta * (dia - 1)) / 7);
  const faltam = meta - feitas;
  const atrasada =
    !atividade.pausada &&
    meta > 0 &&
    faltam > 0 &&
    (feitas < esperadoPeloRitmo || faltam >= diasRestantes);
  return { feitas, meta, esperadoPeloRitmo, diasRestantes, atrasada };
}
