import { criarBackup, paraDataLocal, type Backup, type TabelasBackup } from '@rumo/core';
import { entregarArquivo } from '../app/arquivo';
import { db as dbPadrao, type RumoDB } from './db';

/** Tudo o que está no aparelho, inclusive registros excluídos (tombstones). */
export async function exportarBackup(db: RumoDB = dbPadrao, agora = new Date()): Promise<Backup> {
  return db.transaction('r', db.tables, async () => {
    const tabelas: TabelasBackup = {
      atividades: await db.atividades.toArray(),
      sessoes: await db.sessoes.toArray(),
      pessoas: await db.pessoas.toArray(),
      eventos: await db.eventos.toArray(),
      adiamentos: await db.adiamentos.toArray(),
      preferencias: await db.preferencias.toArray(),
      projetos: await db.projetos.toArray(),
      metas: await db.metas.toArray(),
    };
    return criarBackup(tabelas, agora);
  });
}

/** Substitui todos os dados pelos do backup, numa única transação (ou tudo, ou nada). */
export async function importarBackup(backup: Backup, db: RumoDB = dbPadrao): Promise<void> {
  const t = backup.tabelas;
  await db.transaction('rw', db.tables, async () => {
    for (const tabela of db.tables) await tabela.clear();
    await db.atividades.bulkAdd(t.atividades);
    await db.sessoes.bulkAdd(t.sessoes);
    await db.pessoas.bulkAdd(t.pessoas);
    await db.eventos.bulkAdd(t.eventos);
    await db.adiamentos.bulkAdd(t.adiamentos);
    await db.preferencias.bulkAdd(t.preferencias);
    await db.projetos.bulkAdd(t.projetos);
    await db.metas.bulkAdd(t.metas);
  });
}

export const nomeArquivoBackup = (agora = new Date()) => `rumo-backup-${paraDataLocal(agora)}.json`;

/** Entrega o backup (compartilhar no celular, baixar no computador). */
export const entregarBackup = (backup: Backup) =>
  entregarArquivo(JSON.stringify(backup, null, 2), nomeArquivoBackup(new Date(backup.exportadoEm)), 'application/json');
