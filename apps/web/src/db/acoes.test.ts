import 'fake-indexeddb/auto';
import { expandirEventos, planoEditar, planoExcluir, type Evento } from '@rumo/core';
import { beforeEach, expect, it } from 'vitest';
import { aplicarPlano } from './acoes';
import { db } from './db';

const T = '2026-10-01T00:00:00.000Z';
const aula: Evento = {
  id: 'aula',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  titulo: 'Aula',
  inicio: '2026-10-13T22:00:00.000Z',
  fim: '2026-10-14T00:00:00.000Z',
  fixo: true,
  pessoaId: null,
  rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
};
const semAtualizadoEm = (lista: Evento[]) => lista.map(({ atualizadoEm: _, ...e }) => e).sort((a, b) => a.id.localeCompare(b.id));

beforeEach(async () => {
  await db.eventos.clear();
  await db.eventos.add(aula);
});

async function contexto(dia: string) {
  const eventos = await db.eventos.toArray();
  const [ocorrencia] = expandirEventos(eventos, new Date(`${dia}T00:00:00-03:00`), new Date(`${dia}T23:59:00-03:00`));
  return { serie: eventos.find((e) => e.id === 'aula')!, ocorrencia: ocorrencia!, eventos };
}

it('aplica "este e os seguintes" numa transação e desfaz tudo', async () => {
  const antes = semAtualizadoEm(await db.eventos.toArray());
  const ctx = await contexto('2026-10-22');
  const desfazer = await aplicarPlano(
    planoEditar(ctx, 'seguintes', {
      titulo: 'Nova',
      inicio: ctx.ocorrencia.inicio,
      fim: ctx.ocorrencia.fim,
      fixo: true,
      pessoaId: null,
      rrule: aula.rrule,
    }),
  );
  const depois = await db.eventos.toArray();
  expect(depois.filter((e) => !e.excluidoEm)).toHaveLength(2);
  expect(depois.find((e) => e.id === 'aula')!.rrule).toContain('UNTIL=');

  await desfazer();
  const restaurado = (await db.eventos.toArray()).filter((e) => !e.excluidoEm);
  expect(semAtualizadoEm(restaurado)).toEqual(antes);
});

it('excluir "só este" grava o EXDATE; desfazer remove', async () => {
  const ctx = await contexto('2026-10-15');
  const desfazer = await aplicarPlano(planoExcluir(ctx, 'este'));
  expect((await db.eventos.get('aula'))!.exdatas).toEqual([ctx.ocorrencia.inicio]);
  await desfazer();
  expect((await db.eventos.get('aula'))!.exdatas).toEqual([]);
});
