import {
  idAdiamento,
  inicioDoDia,
  inicioDoDiaApos,
  type AlvoAdiamento,
  type Atividade,
  type Pessoa,
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
