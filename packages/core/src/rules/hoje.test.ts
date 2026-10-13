import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { adiamento, atividade, pessoa, sessao, SP } from '../test/fabricas';
import { contatoPendente } from './contato';
import { eventosDoDia, itensDeAtencao, type ItemHoje } from './hoje';

const agora = SP('2026-10-15T12:00'); // quinta
const ids = (itens: ItemHoje[]) => itens.map((i) => (i.tipo === 'atividade' ? i.atividade.id : i.pessoa.id));
const vazio = { atividades: [], sessoes: [], pessoas: [], adiamentos: [] };

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

describe('itensDeAtencao: atividade nova', () => {
  it('sem nenhuma sessão, aparece como "ainda não praticou" mesmo sem meta e sem limite', () => {
    const nova = atividade({ id: 'n', metaSemanal: 0, limiteDias: null, criadoEm: agora.toISOString() });
    const [item] = itensDeAtencao({ ...vazio, atividades: [nova] }, agora);
    expect(item).toMatchObject({ tipo: 'atividade', nuncaPraticada: true, diasSemSessao: null, progresso: null });
  });

  it('sessão planejada não conta como praticada', () => {
    const nova = atividade({ id: 'n' });
    const planejada = sessao(SP('2026-10-14T10:00'), { atividadeId: 'n', origem: 'planejada' });
    const [item] = itensDeAtencao({ ...vazio, atividades: [nova], sessoes: [planejada] }, agora);
    expect(item).toMatchObject({ nuncaPraticada: true });
  });

  it('nunca praticada e com a meta atrasada mostra os dois motivos', () => {
    const nova = atividade({ id: 'n', metaSemanal: 3 });
    const [item] = itensDeAtencao({ ...vazio, atividades: [nova] }, agora);
    expect(item).toMatchObject({ nuncaPraticada: true, progresso: { feitas: 0, meta: 3 } });
  });

  it('depois da primeira sessão, deixa de ser "nova"', () => {
    const a = atividade({ id: 'n' });
    const s = sessao(SP('2026-10-14T10:00'), { atividadeId: 'n' });
    expect(itensDeAtencao({ ...vazio, atividades: [a], sessoes: [s] }, agora)).toEqual([]);
  });
});

describe('itensDeAtencao: limite padrão derivado da meta', () => {
  it('meta 3 sem limite próprio → avisa depois de 5 dias', () => {
    const a = atividade({ id: 'a', metaSemanal: 3, limiteDias: null });
    // 3 sessões na semana anterior; esta semana o ritmo não pesa até quarta.
    const ultima = sessao(SP('2026-10-07T10:00'), { atividadeId: 'a' }); // quarta passada
    const terca = SP('2026-10-13T12:00'); // 6 dias depois
    const segunda = SP('2026-10-12T12:00'); // 5 dias depois
    expect(itensDeAtencao({ ...vazio, atividades: [a], sessoes: [ultima] }, segunda)).toEqual([]);
    expect(itensDeAtencao({ ...vazio, atividades: [a], sessoes: [ultima] }, terca)[0]).toMatchObject({
      nuncaPraticada: false,
      diasSemSessao: 6,
    });
  });

  it('limite próprio sobrescreve o padrão', () => {
    const a = atividade({ id: 'a', metaSemanal: 0, limiteDias: 2 });
    const s = sessao(SP('2026-10-12T10:00'), { atividadeId: 'a' }); // 3 dias antes
    expect(itensDeAtencao({ ...vazio, atividades: [a], sessoes: [s] }, agora)[0]).toMatchObject({ diasSemSessao: 3 });
  });
});

describe('itensDeAtencao', () => {
  const parada = atividade({ id: 'a1', limiteDias: 2 });
  const metaAtrasada = atividade({ id: 'a2', metaSemanal: 3 });
  const emDia = atividade({ id: 'a3', limiteDias: 5 });
  const sessoes = [
    sessao(SP('2026-10-10T10:00'), { atividadeId: 'a1' }),
    sessao(SP('2026-10-05T10:00'), { atividadeId: 'a2' }),
    sessao(SP('2026-10-14T10:00'), { atividadeId: 'a3' }),
  ];
  const ana = pessoa({ ultimoContato: SP('2026-09-01T10:00').toISOString() });
  const dados = { atividades: [parada, metaAtrasada, emDia], sessoes, pessoas: [ana], adiamentos: [] };

  it('lista só o que pede atenção, com os motivos', () => {
    const itens = itensDeAtencao(dados, agora);
    expect(ids(itens).sort()).toEqual(['a1', 'a2', 'p1']);
    expect(itens.find((i) => ids([i])[0] === 'a1')).toMatchObject({ diasSemSessao: 5, progresso: null });
    expect(itens.find((i) => ids([i])[0] === 'a2')).toMatchObject({
      nuncaPraticada: false,
      diasSemSessao: 10, // passou do padrão da meta 3 (5 dias)
      progresso: { feitas: 0, meta: 3 },
    });
  });

  it('ordena pelo mais urgente primeiro', () => {
    expect(itensDeAtencao(dados, agora)[0]).toMatchObject({ tipo: 'pessoa' }); // 44 dias / 7
  });

  it('empate de urgência desempata por nome', () => {
    const b = atividade({ id: 'b', nome: 'Bordado' });
    const a = atividade({ id: 'a', nome: 'Aquarela' });
    expect(ids(itensDeAtencao({ ...vazio, atividades: [b, a] }, agora))).toEqual(['a', 'b']);
  });

  it('esconde itens adiados até o fim do adiamento', () => {
    const adiamentos = [
      adiamento({ alvoId: 'a1', ate: SP('2026-10-16T00:00').toISOString() }),
      adiamento({ alvoTipo: 'pessoa', alvoId: 'p1', ate: SP('2026-10-15T11:00').toISOString() }),
    ];
    const itens = itensDeAtencao({ ...dados, adiamentos }, agora);
    expect(ids(itens)).not.toContain('a1');
    expect(ids(itens)).toContain('p1'); // adiamento já venceu
    expect(itensDeAtencao({ ...dados, adiamentos }, SP('2026-10-16T00:00'))).toHaveLength(3);
  });

  it('some de Hoje depois de feita no dia, mesmo com a meta apertada', () => {
    const diaria = atividade({ id: 'd', metaSemanal: 7 });
    const ontem = sessao(SP('2026-10-14T07:00'), { atividadeId: 'd' });
    const hoje = sessao(SP('2026-10-15T07:00'), { atividadeId: 'd' });
    expect(itensDeAtencao({ ...vazio, atividades: [diaria], sessoes: [ontem] }, agora)).toHaveLength(1);
    expect(itensDeAtencao({ ...vazio, atividades: [diaria], sessoes: [ontem, hoje] }, agora)).toEqual([]);
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
