import { ativo, type Atividade, type Sessao } from '../model';
import { diasEntre, FUSO_PADRAO } from '../time';

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

/**
 * Dias desde a última sessão feita. Sem nenhuma sessão, conta a partir da criação
 * da atividade, para que uma atividade nova não apareça como "parada" de imediato.
 */
export function diasSemSessao(
  atividade: Atividade,
  sessoes: readonly Sessao[],
  agora: Date,
  fuso = FUSO_PADRAO,
): number {
  const ultima = ultimaSessao(atividade.id, sessoes, agora);
  return diasEntre(new Date(ultima?.inicio ?? atividade.criadoEm), agora, fuso);
}

/** Parada = passou do limite de dias sem sessão (limite 3: avisa no 4º dia). */
export function estaParada(
  atividade: Atividade,
  sessoes: readonly Sessao[],
  agora: Date,
  fuso = FUSO_PADRAO,
): boolean {
  if (atividade.pausada || atividade.limiteDias == null || atividade.limiteDias <= 0) return false;
  return diasSemSessao(atividade, sessoes, agora, fuso) > atividade.limiteDias;
}
