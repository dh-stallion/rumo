import type { Evento } from '../model';
import { eventosExportaveis, gerarICS, uidDe, type OpcoesICS } from './ics';

/**
 * Base para sincronizar com um servidor CalDAV (Radicale, Nextcloud) no futuro.
 *
 * No CalDAV, cada recurso (um arquivo .ics no servidor) guarda UM UID: a série e todas as
 * suas ocorrências editadas (RECURRENCE-ID) vão juntas. O ETag identifica a versão do
 * recurso no servidor e é usado para não sobrescrever mudanças feitas em outro lugar
 * (If-Match ao salvar). A implementação do provedor (HTTP + WebDAV) entra com o backend.
 */
export interface RecursoCalendario {
  uid: string;
  ics: string;
  /** ETag do servidor; null para um recurso ainda não enviado. */
  etag: string | null;
}

export interface ProvedorCalendario {
  /** UIDs e ETags presentes no calendário remoto (REPORT calendar-query). */
  listar(): Promise<{ uid: string; etag: string }[]>;
  /** Conteúdo dos recursos pedidos (REPORT calendar-multiget). */
  baixar(uids: readonly string[]): Promise<RecursoCalendario[]>;
  /** PUT com If-Match (ou If-None-Match: * se novo); devolve o novo ETag. */
  salvar(recurso: RecursoCalendario): Promise<{ etag: string }>;
  /** DELETE com If-Match. */
  remover(uid: string, etag: string): Promise<void>;
}

/** Um recurso por UID: a série com as ocorrências editadas, ou um evento único. */
export function recursosCalDAV(eventos: readonly Evento[], opcoes: OpcoesICS = {}): RecursoCalendario[] {
  const grupos = new Map<string, Evento[]>();
  for (const e of eventosExportaveis(eventos)) {
    const uid = uidDe(e.serieId ?? e.id);
    grupos.set(uid, [...(grupos.get(uid) ?? []), e]);
  }
  return [...grupos].map(([uid, grupo]) => ({ uid, ics: gerarICS({ eventos: grupo }, opcoes), etag: null }));
}
