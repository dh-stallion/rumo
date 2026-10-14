import { novoId, type Aporte, type MetaFinanceira } from '@rumo/core';
import { db } from './db';
import { atualizar, criar, type Dados } from './repo';

export const novaMeta = (dados: Omit<Dados<MetaFinanceira>, 'aportes'>) => criar(db.metas, { ...dados, aportes: [] });

/** Altera os aportes numa transação; devolve a função que restaura a lista anterior. */
async function mudarAportes(metaId: string, fn: (l: Aporte[]) => Aporte[]) {
  let anterior: Aporte[] = [];
  await db.transaction('rw', db.metas, async () => {
    const m = await db.metas.get(metaId);
    if (!m) return;
    anterior = m.aportes;
    await atualizar(db.metas, metaId, { aportes: fn(anterior) });
  });
  return () => atualizar(db.metas, metaId, { aportes: anterior });
}

export const registrarAporte = (metaId: string, aporte: Omit<Aporte, 'id'>) =>
  mudarAportes(metaId, (l) => [...l, { ...aporte, id: novoId() }]);

export const removerAporte = (metaId: string, aporteId: string) => mudarAportes(metaId, (l) => l.filter((a) => a.id !== aporteId));
