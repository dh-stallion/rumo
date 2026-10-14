import { ativo, type AcaoProjeto, type Atividade, type Projeto, type Sessao } from '../model';
import { FUSO_PADRAO, inicioDoDiaApos } from '../time';

/** O que uma sessão faz: praticar uma atividade ou avançar uma ação de projeto. */
export type Afazer =
  | { tipo: 'atividade'; id: string; nome: string; cor: string; duracaoMin: number; atividade: Atividade }
  | { tipo: 'acao'; id: string; nome: string; cor: string; duracaoMin: number; projeto: Projeto; acao: AcaoProjeto };

export const afazerDeAtividade = (a: Atividade): Afazer => ({
  tipo: 'atividade',
  id: a.id,
  nome: a.nome,
  cor: a.cor,
  duracaoMin: a.duracaoPadraoMin,
  atividade: a,
});

export const afazerDeAcao = (projeto: Projeto, acao: AcaoProjeto): Afazer => ({
  tipo: 'acao',
  id: acao.id,
  nome: acao.titulo,
  cor: projeto.cor,
  duracaoMin: acao.duracaoMin,
  projeto,
  acao,
});

export interface IndiceAfazeres {
  atividades: Map<string, Atividade>;
  projetos: Map<string, Projeto>;
}

export function indiceAfazeres(atividades: readonly Atividade[], projetos: readonly Projeto[] = []): IndiceAfazeres {
  return {
    atividades: new Map(atividades.filter(ativo).map((a) => [a.id, a])),
    projetos: new Map(projetos.filter(ativo).map((p) => [p.id, p])),
  };
}

/** O afazer de uma sessão, se a atividade/projeto ainda existir. */
export function afazerDaSessao(s: Sessao, indice: IndiceAfazeres): Afazer | null {
  if (s.atividadeId) {
    const a = indice.atividades.get(s.atividadeId);
    return a ? afazerDeAtividade(a) : null;
  }
  if (s.acao) {
    const p = indice.projetos.get(s.acao.projetoId);
    const acao = p?.acoes.find((x) => x.id === s.acao!.acaoId);
    return p && acao ? afazerDeAcao(p, acao) : null;
  }
  return null;
}

/** Campos de vínculo para criar uma sessão de um afazer. */
export const vinculoDaSessao = (f: Afazer): Pick<Sessao, 'atividadeId' | 'acao'> =>
  f.tipo === 'atividade' ? { atividadeId: f.id, acao: null } : { atividadeId: null, acao: { projetoId: f.projeto.id, acaoId: f.id } };

export const sessaoDoAfazer = (s: Sessao, f: Afazer) =>
  f.tipo === 'atividade' ? s.atividadeId === f.id : s.acao?.acaoId === f.id && s.acao.projetoId === f.projeto.id;

/** Sessões (planejadas + feitas) do afazer na semana que começa em `inicioSemana`. */
export function agendadasDoAfazer(f: Afazer, sessoes: readonly Sessao[], inicioSemana: Date, fuso = FUSO_PADRAO): number {
  const ini = inicioSemana.toISOString();
  const fim = inicioDoDiaApos(inicioSemana, 7, fuso).toISOString();
  return sessoes.filter((s) => ativo(s) && sessaoDoAfazer(s, f) && s.inicio >= ini && s.inicio < fim).length;
}

/** Ações em aberto de projetos ativos, para o banco de afazeres. */
export function acoesPendentes(projetos: readonly Projeto[]): Afazer[] {
  return projetos
    .filter((p) => ativo(p) && !p.arquivado)
    .flatMap((p) => p.acoes.filter((a) => !a.concluida).map((a) => afazerDeAcao(p, a)));
}
