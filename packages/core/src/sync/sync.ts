import { TABELAS_BACKUP, validarRegistro, type TabelaBackup } from '../backup';
import type { Registro } from '../model';

/**
 * Sincronização simples (uso pessoal): last-write-wins por registro, decidido pelo
 * `atualizadoEm`. Excluir é só marcar `excluidoEm`, então a exclusão também sincroniza.
 *
 * Protocolo: o app envia o que mudou desde o último envio e o cursor que recebeu da última
 * vez; o servidor aplica o que vence, e devolve tudo o que mudou depois desse cursor e o
 * cursor novo. Repetir um envio é seguro (idempotente).
 */
export const TABELAS_SYNC = TABELAS_BACKUP;
export type TabelaSync = TabelaBackup;

export type Mudancas = Partial<Record<TabelaSync, Registro[]>>;

export interface PedidoSync {
  /** Último cursor recebido do servidor (0 na primeira vez). */
  cursor: number;
  mudancas: Partial<Record<string, unknown[]>>;
}

export interface Rejeitado {
  tabela: string;
  id: string | null;
  erro: string;
}

export interface RespostaSync {
  cursor: number;
  mudancas: Mudancas;
  /** Registros recusados (tabela desconhecida ou dados inválidos). */
  rejeitados: Rejeitado[];
}

/** O recebido vence se for mais novo. Empate mantém o atual: reaplicar não muda nada. */
export const venceLWW = (recebido: Pick<Registro, 'atualizadoEm'>, atual: Pick<Registro, 'atualizadoEm'> | undefined) =>
  !atual || recebido.atualizadoEm > atual.atualizadoEm;

export const ehTabelaSync = (t: string): t is TabelaSync => (TABELAS_SYNC as readonly string[]).includes(t);

/** Separa o que veio no pedido em registros válidos por tabela e rejeitados, com o motivo. */
export function validarMudancas(mudancas: PedidoSync['mudancas']): { validos: Mudancas; rejeitados: Rejeitado[] } {
  const validos: Mudancas = {};
  const rejeitados: Rejeitado[] = [];
  for (const [tabela, lista] of Object.entries(mudancas ?? {})) {
    if (!ehTabelaSync(tabela)) {
      rejeitados.push({ tabela, id: null, erro: 'tabela desconhecida' });
      continue;
    }
    for (const dado of Array.isArray(lista) ? lista : []) {
      const id = typeof (dado as { id?: unknown })?.id === 'string' ? (dado as { id: string }).id : null;
      const r = validarRegistro(tabela, dado);
      if (r.ok) (validos[tabela] ??= []).push(r.registro as Registro);
      else rejeitados.push({ tabela, id, erro: r.erro });
    }
  }
  return { validos, rejeitados };
}
