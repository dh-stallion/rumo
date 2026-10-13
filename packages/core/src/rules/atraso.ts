import { ativo, type Atividade, type Sessao } from '../model';
import { diasEntre, FUSO_PADRAO } from '../time';

/** Limite usado quando a atividade não tem meta semanal nem limite próprio. */
export const LIMITE_SEM_META = 14;

/** Padrão derivado da meta: ceil(7 / meta) + 2 dias; sem meta, 14. */
export function limitePadrao(metaSemanal: number): number {
  return metaSemanal > 0 ? Math.ceil(7 / metaSemanal) + 2 : LIMITE_SEM_META;
}

/** O limite definido pelo usuário ou, na falta dele, o padrão derivado da meta. */
export function limiteEfetivo(atividade: Atividade): number {
  return atividade.limiteDias != null && atividade.limiteDias > 0
    ? atividade.limiteDias
    : limitePadrao(atividade.metaSemanal);
}

/** Sessões realmente feitas (registradas) da atividade, até `agora`. Planejadas não contam. */
export function sessoesFeitas(atividadeId: string, sessoes: readonly Sessao[], agora: Date): Sessao[] {
  return sessoes.filter(
    (s) =>
      ativo(s) &&
      s.atividadeId === atividadeId &&
      s.origem === 'registrada' &&
      new Date(s.inicio) <= agora,
  );
}

export function ultimaSessao(
  atividadeId: string,
  sessoes: readonly Sessao[],
  agora: Date,
): Sessao | undefined {
  let ultima: Sessao | undefined;
  for (const s of sessoesFeitas(atividadeId, sessoes, agora)) {
    if (!ultima || s.inicio > ultima.inicio) ultima = s;
  }
  return ultima;
}

/** Dias desde a última sessão feita; null se a atividade nunca foi praticada. */
export function diasSemSessao(
  atividade: Atividade,
  sessoes: readonly Sessao[],
  agora: Date,
  fuso = FUSO_PADRAO,
): number | null {
  const ultima = ultimaSessao(atividade.id, sessoes, agora);
  return ultima ? diasEntre(new Date(ultima.inicio), agora, fuso) : null;
}

/**
 * Parada = já foi praticada e passou do limite efetivo de dias sem sessão
 * (limite 3: avisa no 4º dia). Nunca praticada é outro caso ("Ainda não praticou").
 */
export function estaParada(
  atividade: Atividade,
  sessoes: readonly Sessao[],
  agora: Date,
  fuso = FUSO_PADRAO,
): boolean {
  if (atividade.pausada) return false;
  const dias = diasSemSessao(atividade, sessoes, agora, fuso);
  return dias !== null && dias > limiteEfetivo(atividade);
}
