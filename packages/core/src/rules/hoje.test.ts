import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { adiamento, atividade, pessoa, sessao, SP } from '../test/fabricas';
import { contatoPendente } from './contato';
import { eventosDoDia, itensDeAtencao } from './hoje';

const agora = SP('2026-10-15T12:00'); // quinta

describe('contatoPendente', () => {
  it('aparece quando completa a frequência', () => {
    const p = pessoa({ frequenciaDias: 7, ultimoContato: SP('2026-10-08T20:00').toISOString() });
    expect(contatoPendente(p, SP('2026-10-14T23:00'))).toBe(false); // 6 dias
    expect(contatoPendente(p, SP('2026-10-15T00:30'))).toBe(true); // 7 dias
  });

  it('pausada ou sem frequência não aparece', () => {
    const antigo = SP('2026-01-01T12:00').toISOString();
    expect(contatoPendente(pessoa({ ultimoContato: antigo, pausada: true }), agora)).toBe(false);
    expect(contatoPendente(pessoa({ ultimoContato: antigo, frequenciaDias: 0 }), agora)).toBe(false);
  });
});

describe('itensDeAtencao', () => {
  const parada = atividade({ id: 'a1', limiteDias: 2 });
  const metaAtrasada = atividade({ id: 'a2', metaSemanal: 3, limiteDias: null });
  const emDia = atividade({ id: 'a3', limiteDias: 5 });
  const sessoes = [
    sessao(SP('2026-10-10T10:00'), { atividadeId: 'a1' }),
    sessao(SP('2026-10-14T10:00'), { atividadeId: 'a3' }),
  ];
  const ana = pessoa({ ultimoContato: SP('2026-09-01T10:00').toISOString() });
  const dados = { atividades: [parada, metaAtrasada, emDia], sessoes, pessoas: [ana], adiamentos: [] };

  it('lista só o que pede atenção, com os motivos', () => {
    const itens = itensDeAtencao(dados, agora);
    expect(itens.map((i) => (i.tipo === 'atividade' ? i.atividade.id : i.pessoa.id)).sort()).toEqual([
      'a1',
      'a2',
      'p1',
    ]);
    const a1 = itens.find((i) => i.tipo === 'atividade' && i.atividade.id === 'a1');
    expect(a1).toMatchObject({ diasSemSessao: 5, progresso: null });
    const a2 = itens.find((i) => i.tipo === 'atividade' && i.atividade.id === 'a2');
    expect(a2).toMatchObject({ diasSemSessao: null, progresso: { feitas: 0, meta: 3 } });
  });

  it('ordena pelo mais urgente primeiro', () => {
    const itens = itensDeAtencao(dados, agora);
    expect(itens[0]).toMatchObject({ tipo: 'pessoa' }); // 44 dias / 7
  });

  it('esconde itens adiados até o fim do adiamento', () => {
    const adiamentos = [
      adiamento({ alvoId: 'a1', ate: SP('2026-10-16T00:00').toISOString() }),
      adiamento({ alvoTipo: 'pessoa', alvoId: 'p1', ate: SP('2026-10-15T11:00').toISOString() }),
    ];
    const itens = itensDeAtencao({ ...dados, adiamentos }, agora);
    expect(itens.some((i) => i.tipo === 'atividade' && i.atividade.id === 'a1')).toBe(false);
    expect(itens.some((i) => i.tipo === 'pessoa')).toBe(true); // adiamento já venceu
    expect(itensDeAtencao({ ...dados, adiamentos }, SP('2026-10-16T00:00')).length).toBe(3);
  });

  it('some de Hoje depois de feita no dia, mesmo com a meta apertada', () => {
    const diaria = atividade({ id: 'd', metaSemanal: 7 });
    const comSessaoHoje = [sessao(SP('2026-10-15T07:00'), { atividadeId: 'd' })];
    expect(itensDeAtencao({ ...dados, atividades: [diaria], pessoas: [] }, agora)).toHaveLength(1);
    expect(
      itensDeAtencao({ ...dados, atividades: [diaria], sessoes: comSessaoHoje, pessoas: [] }, agora),
    ).toEqual([]);
  });

  it('ignora pausados e excluídos', () => {
    const itens = itensDeAtencao(
      {
        ...dados,
        atividades: [{ ...parada, pausada: true }, { ...metaAtrasada, excluidoEm: agora.toISOString() }],
        pessoas: [{ ...ana, pausada: true }],
      },
      agora,
    );
    expect(itens).toEqual([]);
  });
});

describe('eventosDoDia', () => {
  const ev = (id: string, inicio: string, fim: string): Evento => ({
    id,
    criadoEm: '',
    atualizadoEm: '',
    excluidoEm: null,
    titulo: id,
    inicio: SP(inicio).toISOString(),
    fim: SP(fim).toISOString(),
    fixo: true,
    pessoaId: null,
    rrule: null,
  });

  it('inclui eventos que tocam o dia em São Paulo, em ordem', () => {
    const eventos = [
      ev('tarde', '2026-10-15T15:00', '2026-10-15T16:00'),
      ev('cedo', '2026-10-15T07:00', '2026-10-15T08:00'),
      ev('virada', '2026-10-14T23:00', '2026-10-15T01:00'),
      ev('ontem', '2026-10-14T21:00', '2026-10-14T22:00'),
      ev('noite-amanha', '2026-10-16T00:30', '2026-10-16T01:00'),
    ];
    expect(eventosDoDia(eventos, agora).map((e) => e.id)).toEqual(['virada', 'cedo', 'tarde']);
  });
});
