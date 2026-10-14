import { ativo, type Evento, type ISODateTime } from '../model';
import { FUSO_PADRAO } from '../time';
import { lerRRule, ocorrencias } from './recorrencia';

/** Uma ocorrência na agenda: o evento com início/fim desta ocorrência. */
export type EventoNaAgenda = Evento & {
  /** Se veio de uma série (ou é uma ocorrência editada dela): qual série e qual ocorrência. */
  ocorrencia: { serieId: string; inicioOriginal: ISODateTime } | null;
};

/** Chave única de uma ocorrência (o id do evento se repete entre ocorrências da série). */
export const chaveEvento = (e: EventoNaAgenda) =>
  e.ocorrencia ? `${e.ocorrencia.serieId}@${e.ocorrencia.inicioOriginal}` : e.id;

/**
 * Expande eventos e séries nas ocorrências que tocam [de, ate), em ordem de início.
 * Ocorrências puladas (EXDATE) e substituídas por uma edição "só este" saem da série;
 * a edição aparece como evento próprio. Regra que não dá para ler vira evento único.
 */
export function expandirEventos(eventos: readonly Evento[], de: Date, ate: Date, fuso = FUSO_PADRAO): EventoNaAgenda[] {
  const substituidas = new Set(
    eventos.filter((e) => ativo(e) && e.serieId && e.ocorrenciaOriginal).map((e) => `${e.serieId}@${e.ocorrenciaOriginal}`),
  );
  const toca = (ini: number, fim: number) => ini < ate.getTime() && Math.max(fim, ini + 1) > de.getTime();
  const resultado: EventoNaAgenda[] = [];

  for (const e of eventos) {
    if (!ativo(e)) continue;
    const ini = new Date(e.inicio).getTime();
    const fim = new Date(e.fim).getTime();
    const regra = e.rrule ? lerRRule(e.rrule, fuso) : null;

    if (!regra?.ok) {
      if (toca(ini, fim)) {
        const ocorrencia = e.serieId && e.ocorrenciaOriginal ? { serieId: e.serieId, inicioOriginal: e.ocorrenciaOriginal } : null;
        resultado.push({ ...e, ocorrencia });
      }
      continue;
    }

    const duracao = fim - ini;
    const puladas = new Set(e.exdatas.map((x) => new Date(x).getTime()));
    for (const inicio of ocorrencias(new Date(ini), regra.regra, new Date(de.getTime() - duracao), ate, fuso)) {
      const t = inicio.getTime();
      const inicioOriginal = inicio.toISOString();
      if (puladas.has(t) || substituidas.has(`${e.id}@${inicioOriginal}`) || !toca(t, t + duracao)) continue;
      resultado.push({
        ...e,
        inicio: inicioOriginal,
        fim: new Date(t + duracao).toISOString(),
        ocorrencia: { serieId: e.id, inicioOriginal },
      });
    }
  }
  return resultado.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
