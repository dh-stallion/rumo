import 'fake-indexeddb/auto';
import { ID_PREFERENCIAS } from '@rumo/core';
import Dexie from 'dexie';
import { expect, it } from 'vitest';
import { RumoDB } from './db';

it('migração v3 preenche os campos do convite semanal nas preferências antigas', async () => {
  const nome = 'rumo-teste-migracao';
  const antigo = new Dexie(nome);
  antigo.version(2).stores({
    atividades: 'id, atualizadoEm',
    sessoes: 'id, atividadeId, inicio, atualizadoEm',
    pessoas: 'id, atualizadoEm',
    eventos: 'id, inicio, atualizadoEm',
    adiamentos: 'id, atualizadoEm',
    preferencias: 'id, atualizadoEm',
  });
  const t = '2026-10-01T12:00:00.000Z';
  await antigo.table('preferencias').add({ id: ID_PREFERENCIAS, criadoEm: t, atualizadoEm: t, excluidoEm: null, inicioSemana: 0 });
  antigo.close();

  const db = new RumoDB(nome);
  expect(await db.preferencias.get(ID_PREFERENCIAS)).toMatchObject({
    inicioSemana: 0,
    convitePlanejar: true,
    semanaConviteTratada: null,
  });
  db.close();
  await db.delete();
});

it('migração v4 preenche os campos de recorrência nos eventos antigos', async () => {
  const nome = 'rumo-teste-migracao-v4';
  const antigo = new Dexie(nome);
  antigo.version(3).stores({
    atividades: 'id, atualizadoEm',
    sessoes: 'id, atividadeId, inicio, atualizadoEm',
    pessoas: 'id, atualizadoEm',
    eventos: 'id, inicio, atualizadoEm',
    adiamentos: 'id, atualizadoEm',
    preferencias: 'id, atualizadoEm',
  });
  const t = '2026-10-01T12:00:00.000Z';
  await antigo.table('eventos').add({
    id: 'e1', criadoEm: t, atualizadoEm: t, excluidoEm: null,
    titulo: 'Dentista', inicio: t, fim: t, fixo: true, pessoaId: null, rrule: null,
  });
  antigo.close();

  const db = new RumoDB(nome);
  expect(await db.eventos.get('e1')).toMatchObject({ exdatas: [], serieId: null, ocorrenciaOriginal: null });
  db.close();
  await db.delete();
});
