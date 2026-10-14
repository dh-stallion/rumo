import { novoId, type Projeto } from '@rumo/core';
import { db } from './db';
import { atualizar, criar } from './repo';

type Listas = Pick<Projeto, 'acoes' | 'marcos' | 'itens'>;
type Campo = keyof Listas;
type ItemDe<C extends Campo> = Listas[C][number];

export const novoProjeto = (dados: Pick<Projeto, 'nome' | 'descricao' | 'cor'>) =>
  criar(db.projetos, { ...dados, arquivado: false, marcos: [], acoes: [], itens: [] });

/**
 * Altera uma das listas do projeto (ações, marcos ou itens) numa transação.
 * Devolve a função que restaura a lista anterior.
 */
export async function mudarLista<C extends Campo>(projetoId: string, campo: C, fn: (lista: ItemDe<C>[]) => ItemDe<C>[]) {
  let anterior: ItemDe<C>[] = [];
  await db.transaction('rw', db.projetos, async () => {
    const p = await db.projetos.get(projetoId);
    if (!p) return;
    anterior = p[campo] as ItemDe<C>[];
    await atualizar(db.projetos, projetoId, { [campo]: fn(anterior) } as Partial<Listas>);
  });
  return () => atualizar(db.projetos, projetoId, { [campo]: anterior } as Partial<Listas>);
}

export const adicionar = <C extends Campo>(projetoId: string, campo: C, item: Omit<ItemDe<C>, 'id'>) =>
  mudarLista(projetoId, campo, (l) => [...l, { ...item, id: novoId() } as ItemDe<C>]);

export const editar = <C extends Campo>(projetoId: string, campo: C, id: string, mudancas: Partial<ItemDe<C>>) =>
  mudarLista(projetoId, campo, (l) => l.map((x) => (x.id === id ? { ...x, ...mudancas } : x)));

export const remover = <C extends Campo>(projetoId: string, campo: C, id: string) =>
  mudarLista(projetoId, campo, (l) => l.filter((x) => x.id !== id));
