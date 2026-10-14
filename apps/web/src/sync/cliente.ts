import { TABELAS_SYNC, venceLWW, type Mudancas, type Registro, type RespostaSync, type TabelaSync } from '@rumo/core';
import type { Table } from 'dexie';
import { db } from '../db/db';

/** Endereço e token do servidor: só deste aparelho (o token é segredo, não vai no backup). */
export interface Servidor {
  url: string;
  token: string;
}

interface EstadoLocal {
  /** Último cursor recebido do servidor. */
  cursor: number;
  /** Mudanças locais até este instante já foram enviadas. */
  enviadoAte: string;
}

const CHAVE_SERVIDOR = 'rumo:servidor';
const CHAVE_ESTADO = 'rumo:sync';

function ler<T>(chave: string): T | null {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem storage, a configuração vale só até fechar o app.
  }
}

export const lerServidor = () => ler<Servidor>(CHAVE_SERVIDOR);
export const lerEstado = (): EstadoLocal => ler<EstadoLocal>(CHAVE_ESTADO) ?? { cursor: 0, enviadoAte: '' };

export function salvarServidor(s: Servidor | null) {
  gravar(CHAVE_SERVIDOR, s);
  // Trocar de servidor recomeça do zero: envia tudo e recebe tudo (é seguro repetir).
  gravar(CHAVE_ESTADO, null);
}

/** "https://nas.exemplo.ts.net/" → "https://nas.exemplo.ts.net" */
export const normalizarUrl = (url: string) => url.trim().replace(/\/+$/, '');

export class ErroServidor extends Error {}

/** Chamada à API com o token, com tempo limite e mensagens em português. */
export async function chamar<T>(servidor: Servidor, caminho: string, init: RequestInit = {}, tempoMs = 20_000): Promise<T> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), tempoMs);
  let resposta: Response;
  try {
    resposta = await fetch(`${normalizarUrl(servidor.url)}${caminho}`, {
      ...init,
      signal: controle.signal,
      headers: { Authorization: `Bearer ${servidor.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ErroServidor('Não foi possível falar com o servidor. Confira o endereço e a conexão.');
  } finally {
    clearTimeout(timer);
  }
  if (resposta.status === 401) throw new ErroServidor('O servidor recusou o token.');
  if (!resposta.ok) throw new ErroServidor(`O servidor respondeu com erro (${resposta.status}).`);
  return (await resposta.json()) as T;
}

/** Confere se o endereço é um servidor do Rumo e se o token é aceito. */
export async function testarServidor(servidor: Servidor): Promise<void> {
  const saude = await chamar<{ servico?: string }>(servidor, '/api/saude').catch((e) => {
    throw e instanceof ErroServidor ? e : new ErroServidor('Resposta inesperada do servidor.');
  });
  if (saude.servico !== 'rumo') throw new ErroServidor('Este endereço não é um servidor do Rumo.');
  await chamar(servidor, '/api/feed');
}

const tabela = (t: TabelaSync) => db[t] as unknown as Table<Registro, string>;

/** Uma rodada: envia o que mudou aqui e aplica o que veio do servidor (last-write-wins). */
export async function sincronizar(servidor: Servidor): Promise<{ enviados: number; recebidos: number; rejeitados: number }> {
  const estado = lerEstado();
  const inicio = new Date().toISOString();

  const mudancas: Mudancas = {};
  let enviados = 0;
  for (const t of TABELAS_SYNC) {
    // ">=": uma mudança no mesmo milissegundo do início da última rodada não pode ficar para trás.
    // Reenviar um registro igual é inofensivo (o servidor ignora empates).
    const lista = await tabela(t)
      .filter((r) => r.atualizadoEm >= estado.enviadoAte)
      .toArray();
    if (lista.length) {
      (mudancas as Record<string, Registro[]>)[t] = lista;
      enviados += lista.length;
    }
  }

  const resposta = await chamar<RespostaSync>(servidor, '/api/sync', {
    method: 'POST',
    body: JSON.stringify({ cursor: estado.cursor, mudancas }),
  });

  let recebidos = 0;
  await aplicandoDoServidor(() =>
    db.transaction('rw', TABELAS_SYNC.map(tabela), async () => {
      for (const [t, lista] of Object.entries(resposta.mudancas) as [TabelaSync, Registro[]][]) {
        const atuais = await tabela(t).bulkGet(lista.map((r) => r.id));
        const vencem = lista.filter((r, i) => venceLWW(r, atuais[i]));
        if (vencem.length) await tabela(t).bulkPut(vencem);
        recebidos += vencem.length;
      }
    }),
  );

  gravar(CHAVE_ESTADO, { cursor: resposta.cursor, enviadoAte: inicio } satisfies EstadoLocal);
  return { enviados, recebidos, rejeitados: resposta.rejeitados.length };
}

// Mudanças aplicadas pela própria sincronização não devem disparar outra sincronização.
let aplicando = false;
export const estaAplicandoDoServidor = () => aplicando;
async function aplicandoDoServidor<T>(fn: () => Promise<T>): Promise<T> {
  aplicando = true;
  try {
    return await fn();
  } finally {
    aplicando = false;
  }
}
