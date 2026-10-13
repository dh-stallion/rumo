import type { Atividade, Sessao } from '../model';
import { CALENDARIO_PADRAO, inicioDaSemana, posicaoDoDia, posicaoNaSemana } from '../time';
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

const SEXTA = 5;

/**
 * A meta pede atenção quando:
 * - meta 1x: nada feito na semana e já é sexta ou depois (na semana configurada);
 * - demais metas: o ritmo ficou para trás (feitas < floor(meta × diasEncerrados / 7))
 *   ou não sobra folga (o que falta exige todos os dias restantes, incluindo hoje).
 *
 * Ex. (semana começando na segunda): meta 3 sem nada feito aparece na quinta.
 */
export function progressoSemanal(
  atividade: Atividade,
  sessoes: readonly Sessao[],
  agora: Date,
  cal = CALENDARIO_PADRAO,
): ProgressoSemanal {
  const inicio = inicioDaSemana(agora, cal);
  const feitas = sessoesFeitas(atividade.id, sessoes, agora).filter(
    (s) => new Date(s.inicio) >= inicio,
  ).length;
  const meta = atividade.metaSemanal;
  const pos = posicaoNaSemana(agora, cal);
  const diasRestantes = 7 - pos;
  const esperadoPeloRitmo = Math.floor((meta * pos) / 7);
  const faltam = meta - feitas;

  let atrasada = false;
  if (!atividade.pausada && meta > 0 && faltam > 0) {
    atrasada =
      meta === 1
        ? pos >= posicaoDoDia(SEXTA, cal)
        : feitas < esperadoPeloRitmo || faltam >= diasRestantes;
  }
  return { feitas, meta, esperadoPeloRitmo, diasRestantes, atrasada };
}
