import { criarBackup, paraDataLocal, type Backup, type TabelasBackup } from '@rumo/core';
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
  });
}

export const nomeArquivoBackup = (agora = new Date()) => `rumo-backup-${paraDataLocal(agora)}.json`;

/**
 * Entrega o arquivo ao usuário. No celular usa a folha de compartilhamento (no iPhone:
 * "Salvar em Arquivos"); no computador, ou se o compartilhamento falhar, baixa o arquivo.
 * Precisa ser chamado direto do toque, por isso recebe o backup já pronto.
 */
export async function entregarBackup(backup: Backup): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const nome = nomeArquivoBackup(new Date(backup.exportadoEm));
  const arquivo = new File([JSON.stringify(backup, null, 2)], nome, { type: 'application/json' });
  const toque = matchMedia('(pointer: coarse)').matches;
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome });
      return 'compartilhado';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}
