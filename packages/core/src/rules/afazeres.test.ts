import { describe, expect, it } from 'vitest';
import { gerarICS } from '../calendario/ics';
import type { Projeto } from '../model';
import { atividade, sessao, SP } from '../test/fabricas';
import { inicioDaSemana } from '../time';
import { acoesPendentes, afazerDaSessao, afazerDeAcao, agendadasDoAfazer, indiceAfazeres, vinculoDaSessao } from './afazeres';
import { proximosCompromissos } from './compromissos';

const T = '2026-10-01T15:00:00.000Z';
const nas: Projeto = {
  id: 'nas',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  nome: 'NAS',
  descricao: '',
  cor: '#0ea5e9',
  arquivado: false,
  marcos: [],
  acoes: [
    { id: 'ac1', titulo: 'Pesquisar HDs', duracaoMin: 60, concluida: false },
    { id: 'ac2', titulo: 'Comprar gabinete', duracaoMin: 30, concluida: true },
  ],
  itens: [],
};
const violao = atividade({ id: 'a1', nome: 'Violão' });
const indice = indiceAfazeres([violao], [nas]);
const daAcao = (inicio: Date, p = {}) => sessao(inicio, { atividadeId: null, acao: { projetoId: 'nas', acaoId: 'ac1' }, origem: 'planejada', ...p });

describe('afazeres', () => {
  it('a sessão sabe se é de atividade ou de ação de projeto', () => {
    expect(afazerDaSessao(sessao(SP('2026-10-14T10:00')), indice)).toMatchObject({ tipo: 'atividade', nome: 'Violão' });
    expect(afazerDaSessao(daAcao(SP('2026-10-14T10:00')), indice)).toMatchObject({ tipo: 'acao', nome: 'Pesquisar HDs', cor: '#0ea5e9', duracaoMin: 60 });
    expect(afazerDaSessao(daAcao(SP('2026-10-14T10:00'), { acao: { projetoId: 'nas', acaoId: 'sumiu' } }), indice)).toBeNull();
  });

  it('vínculo ao criar a sessão', () => {
    expect(vinculoDaSessao(afazerDeAcao(nas, nas.acoes[0]!))).toEqual({ atividadeId: null, acao: { projetoId: 'nas', acaoId: 'ac1' } });
  });

  it('conta as sessões da ação na semana', () => {
    const f = afazerDeAcao(nas, nas.acoes[0]!);
    const sessoes = [daAcao(SP('2026-10-14T10:00')), daAcao(SP('2026-10-21T10:00')), sessao(SP('2026-10-14T11:00'))];
    expect(agendadasDoAfazer(f, sessoes, inicioDaSemana(SP('2026-10-13T12:00')))).toBe(1);
  });

  it('ações pendentes de projetos ativos e não arquivados', () => {
    expect(acoesPendentes([nas, { ...nas, id: 'velho', arquivado: true }]).map((f) => f.nome)).toEqual(['Pesquisar HDs']);
  });

  it('sessão de ação aparece nos compromissos e no .ics com o nome da ação', () => {
    const dados = { eventos: [], sessoes: [daAcao(SP('2026-10-14T10:00'))], atividades: [violao], projetos: [nas] };
    expect(proximosCompromissos(dados, SP('2026-10-13T12:00'))[0]!.itens[0]).toMatchObject({ tipo: 'sessao', titulo: 'Pesquisar HDs' });
    expect(gerarICS(dados)).toContain('SUMMARY:Pesquisar HDs');
  });
});
