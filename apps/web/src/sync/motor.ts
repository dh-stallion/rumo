import { TABELAS_SYNC, type Registro } from '@rumo/core';
import type { Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import { ErroServidor, estaAplicandoDoServidor, lerServidor, sincronizar } from './cliente';

export interface EstadoSync {
  situacao: 'desligado' | 'sincronizando' | 'ok' | 'erro';
  /** Última sincronização bem-sucedida. */
  ultima: string | null;
  erro: string | null;
}

let estado: EstadoSync = { situacao: lerServidor() ? 'ok' : 'desligado', ultima: null, erro: null };
const ouvintes = new Set<() => void>();
const mudar = (novo: Partial<EstadoSync>) => {
  estado = { ...estado, ...novo };
  ouvintes.forEach((f) => f());
};

export const useEstadoSync = () =>
  useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado,
  );

let emAndamento: Promise<void> | null = null;
let deNovo = false;

/** Sincroniza agora (se configurado). Chamadas durante uma rodada geram uma nova rodada ao fim. */
export function sincronizarAgora(): Promise<void> {
  const servidor = lerServidor();
  if (!servidor) {
    mudar({ situacao: 'desligado', erro: null });
    return Promise.resolve();
  }
  if (emAndamento) {
    deNovo = true;
    return emAndamento;
  }
  mudar({ situacao: 'sincronizando' });
  emAndamento = sincronizar(servidor)
    .then(() => mudar({ situacao: 'ok', ultima: new Date().toISOString(), erro: null }))
    .catch((e) => mudar({ situacao: 'erro', erro: e instanceof ErroServidor ? e.message : 'Erro inesperado ao sincronizar.' }))
    .finally(() => {
      emAndamento = null;
      if (deNovo) {
        deNovo = false;
        void sincronizarAgora();
      }
    });
  return emAndamento;
}

let espera: number | undefined;
/** Depois de uma mudança local, espera um pouco (agrupa várias edições) e sincroniza. */
function agendar() {
  if (estaAplicandoDoServidor() || !lerServidor()) return;
  window.clearTimeout(espera);
  espera = window.setTimeout(() => void sincronizarAgora(), 3000);
}

let iniciado = false;
/** Liga a sincronização automática: ao abrir, ao voltar ao app, após mudanças e a cada 5 min. */
export function iniciarSincronizacao() {
  if (iniciado) return;
  iniciado = true;
  for (const t of TABELAS_SYNC) {
    const tabela = db[t] as unknown as Table<Registro, string>;
    tabela.hook('creating', agendar);
    tabela.hook('updating', agendar);
    tabela.hook('deleting', agendar);
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void sincronizarAgora());
  window.addEventListener('online', () => void sincronizarAgora());
  window.setInterval(() => document.visibilityState === 'visible' && void sincronizarAgora(), 5 * 60_000);
  void sincronizarAgora();
}
