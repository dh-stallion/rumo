import {
  comoRegistrada,
  idAdiamento,
  inicioDoDia,
  inicioDoDiaApos,
  planejadaDeHoje,
  type AlvoAdiamento,
  type Atividade,
  type Evento,
  type Intervalo,
  type Pessoa,
  type PlanoImportacao,
  type PlanoSerie,
  type Sessao,
} from '@rumo/core';
import { db } from './db';
import { atualizar, criar, excluir } from './repo';

/**
 * "Fiz hoje": a sessão termina agora e começa `duração` antes, sem cruzar a meia-noite.
 * Com `inicio`, registra numa data/hora específica.
 */
export async function registrarSessao(atividade: Atividade, inicio?: Date): Promise<Sessao> {
  const dur = atividade.duracaoPadraoMin * 60_000;
  const agora = new Date();
  const ini = inicio ?? new Date(Math.max(agora.getTime() - dur, inicioDoDia(agora).getTime()));
  return criar(db.sessoes, {
    atividadeId: atividade.id,
    inicio: ini.toISOString(),
    fim: new Date(ini.getTime() + dur).toISOString(),
    origem: 'registrada',
  });
}

/** "Falei com"; devolve a função que restaura o contato anterior. */
export async function registrarContato(pessoa: Pessoa) {
  const anterior = pessoa.ultimoContato;
  await atualizar(db.pessoas, pessoa.id, { ultimoContato: new Date().toISOString() });
  return () => atualizar(db.pessoas, pessoa.id, { ultimoContato: anterior });
}

/** Esconde o item de "Hoje" até 00:00 de daqui a `dias` dias. */
export async function adiar(alvoTipo: AlvoAdiamento, alvoId: string, dias: number) {
  const id = idAdiamento(alvoTipo, alvoId);
  const t = new Date().toISOString();
  const existente = await db.adiamentos.get(id);
  await db.adiamentos.put({
    id,
    alvoTipo,
    alvoId,
    ate: inicioDoDiaApos(new Date(), dias).toISOString(),
    criadoEm: existente?.criadoEm ?? t,
    atualizadoEm: t,
    excluidoEm: null,
  });
  return () => excluir(db.adiamentos, id);
}

export async function pausar(alvoTipo: AlvoAdiamento, id: string, pausada = true) {
  if (alvoTipo === 'atividade') await atualizar(db.atividades, id, { pausada });
  else await atualizar(db.pessoas, id, { pausada });
  return () => pausar(alvoTipo, id, !pausada);
}

/** Cria uma sessão planejada; devolve a sessão e a função que desfaz. */
export async function planejarSessao(atividade: Atividade, intervalo: Intervalo) {
  const sessao = await criar(db.sessoes, {
    atividadeId: atividade.id,
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    origem: 'planejada',
  });
  return { sessao, desfazer: () => excluir(db.sessoes, sessao.id) };
}

/** Muda horário e/ou duração; devolve a função que restaura o anterior. */
export async function moverSessao(sessao: Sessao, intervalo: Intervalo) {
  const anterior = { inicio: sessao.inicio, fim: sessao.fim };
  await atualizar(db.sessoes, sessao.id, { inicio: intervalo.inicio, fim: intervalo.fim });
  return () => atualizar(db.sessoes, sessao.id, anterior);
}

/** Converte uma sessão planejada em registrada (ver regra em core); devolve a função que desfaz. */
export async function marcarFeita(sessao: Sessao) {
  const anterior = { inicio: sessao.inicio, fim: sessao.fim, origem: sessao.origem };
  await atualizar(db.sessoes, sessao.id, comoRegistrada(sessao, new Date()));
  return () => atualizar(db.sessoes, sessao.id, anterior);
}

/**
 * "Feito"/"Fiz hoje": se há uma sessão planejada para hoje, ela vira registrada
 * (sem duplicar); senão, registra uma sessão nova.
 */
export async function registrarFeito(atividade: Atividade, sessoes: readonly Sessao[]) {
  const planejada = planejadaDeHoje(atividade.id, sessoes, new Date());
  if (planejada) return marcarFeita(planejada);
  const s = await registrarSessao(atividade);
  return () => excluir(db.sessoes, s.id);
}

/**
 * Aplica um plano de edição de série numa transação. O desfazer restaura os
 * registros como estavam e remove os criados.
 */
export async function aplicarPlano(plano: PlanoSerie) {
  const t = new Date().toISOString();
  let antes: Evento[] = [];
  await db.transaction('rw', db.eventos, async () => {
    const ids = [...new Set([...plano.atualizar.map((a) => a.id), ...plano.excluir])];
    antes = (await db.eventos.bulkGet(ids)).filter((e): e is Evento => !!e);
    for (const c of plano.criar) await db.eventos.add({ ...c, criadoEm: t, atualizadoEm: t, excluidoEm: null });
    for (const a of plano.atualizar) await db.eventos.update(a.id, { ...a.mudancas, atualizadoEm: t });
    for (const id of plano.excluir) await db.eventos.update(id, { excluidoEm: t, atualizadoEm: t });
  });
  return () =>
    db.transaction('rw', db.eventos, async () => {
      const agora = new Date().toISOString();
      await db.eventos.bulkPut(antes.map((e) => ({ ...e, atualizadoEm: agora })));
      for (const c of plano.criar) await db.eventos.update(c.id, { excluidoEm: agora, atualizadoEm: agora });
    });
}

/**
 * Importa eventos de um .ics numa transação: cria os novos e atualiza os que já existem
 * (mesmo UID; um excluído volta a valer). O desfazer restaura o estado anterior.
 */
export async function importarEventos(plano: PlanoImportacao) {
  const t = new Date().toISOString();
  let antes: Evento[] = [];
  await db.transaction('rw', db.eventos, async () => {
    antes = (await db.eventos.bulkGet(plano.atualizar.map((e) => e.id))).filter((e): e is Evento => !!e);
    const porId = new Map(antes.map((e) => [e.id, e]));
    await db.eventos.bulkPut([
      ...plano.novos.map((e) => ({ ...e, criadoEm: t, atualizadoEm: t, excluidoEm: null })),
      ...plano.atualizar.map((e) => ({ ...e, criadoEm: porId.get(e.id)?.criadoEm ?? t, atualizadoEm: t, excluidoEm: null })),
    ]);
  });
  return () =>
    db.transaction('rw', db.eventos, async () => {
      const agora = new Date().toISOString();
      await db.eventos.bulkPut(antes.map((e) => ({ ...e, atualizadoEm: agora })));
      for (const e of plano.novos) await db.eventos.update(e.id, { excluidoEm: agora, atualizadoEm: agora });
    });
}
