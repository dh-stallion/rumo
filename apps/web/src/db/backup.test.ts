import 'fake-indexeddb/auto';
import { ID_PREFERENCIAS, TABELAS_BACKUP, validarBackup } from '@rumo/core';
import { afterEach, describe, expect, it } from 'vitest';
import { exportarBackup, importarBackup } from './backup';
import { RumoDB } from './db';

const t = (iso: string) => new Date(iso).toISOString();
const base = (id: string) => ({ id, criadoEm: t('2026-10-01T12:00Z'), atualizadoEm: t('2026-10-02T12:00Z'), excluidoEm: null });

async function popular(db: RumoDB) {
  await db.atividades.bulkAdd([
    { ...base('a1'), nome: 'Violão', categoria: 'hobby', duracaoPadraoMin: 30, metaSemanal: 3, cor: '#6366f1', pausada: false, limiteDias: null },
    { ...base('a2'), nome: 'Inglês', categoria: 'estudo', duracaoPadraoMin: 45, metaSemanal: 0, cor: '#0ea5e9', pausada: true, limiteDias: 10, excluidoEm: t('2026-10-05T12:00Z') },
  ]);
  await db.sessoes.bulkAdd([
    { ...base('s1'), atividadeId: 'a1', inicio: t('2026-10-12T13:00Z'), fim: t('2026-10-12T13:30Z'), origem: 'registrada' },
    { ...base('s2'), atividadeId: 'a1', inicio: t('2026-10-16T22:00Z'), fim: t('2026-10-16T22:30Z'), origem: 'planejada' },
  ]);
  await db.pessoas.add({ ...base('p1'), nome: 'Ana', frequenciaDias: 7, ultimoContato: t('2026-10-01T20:00Z'), notas: 'aniversário 3/11 — "café"', pausada: false });
  await db.eventos.add({ ...base('e1'), titulo: 'Dentista', inicio: t('2026-10-14T18:00Z'), fim: t('2026-10-14T19:00Z'), fixo: true, pessoaId: 'p1', rrule: 'FREQ=WEEKLY;BYDAY=TU', exdatas: [t('2026-10-20T21:00Z')], serieId: null, ocorrenciaOriginal: null });
  await db.adiamentos.add({ ...base('atividade:a1'), alvoTipo: 'atividade', alvoId: 'a1', ate: t('2026-10-14T03:00Z') });
  await db.preferencias.add({ ...base(ID_PREFERENCIAS), inicioSemana: 0, convitePlanejar: false, semanaConviteTratada: '2026-10-12' });
}

let db: RumoDB;
afterEach(async () => {
  db?.close();
  if (db) await db.delete();
});

describe('backup', () => {
  it('inclui todas as tabelas do banco', () => {
    db = new RumoDB('rumo-teste-tabelas');
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABELAS_BACKUP].sort());
  });

  it('exportar, apagar tudo, importar: os dados voltam idênticos', async () => {
    db = new RumoDB('rumo-teste-ida-e-volta');
    await popular(db);
    const antes = await exportarBackup(db, new Date('2026-10-13T15:00:00Z'));

    // Passa por texto, como no arquivo de verdade.
    const arquivo = JSON.stringify(antes, null, 2);

    await Promise.all(db.tables.map((tabela) => tabela.clear()));
    expect((await exportarBackup(db)).tabelas.atividades).toEqual([]);

    const lido = validarBackup(JSON.parse(arquivo));
    if (!lido.ok) throw new Error(lido.erros.join('\n'));
    await importarBackup(lido.backup, db);

    const depois = await exportarBackup(db, new Date('2026-10-13T15:00:00Z'));
    expect(depois).toEqual(antes);
    expect(depois.tabelas.atividades).toHaveLength(2); // inclusive a excluída
  });

  it('importar substitui os dados atuais (não mistura)', async () => {
    db = new RumoDB('rumo-teste-substitui');
    await popular(db);
    const backup = await exportarBackup(db);
    await db.pessoas.add({ ...base('p2'), nome: 'Bruno', frequenciaDias: 0, ultimoContato: null, notas: '', pausada: false });
    await importarBackup(backup, db);
    expect((await db.pessoas.toArray()).map((p) => p.nome)).toEqual(['Ana']);
  });

  it('se a importação falhar no meio, nada muda', async () => {
    db = new RumoDB('rumo-teste-atomico');
    await popular(db);
    const backup = await exportarBackup(db);
    const quebrado = structuredClone(backup);
    quebrado.tabelas.eventos.push(quebrado.tabelas.eventos[0]!); // id repetido → bulkAdd falha
    await expect(importarBackup(quebrado, db)).rejects.toThrow();
    expect(await exportarBackup(db, new Date(backup.exportadoEm))).toEqual(backup);
  });
});
