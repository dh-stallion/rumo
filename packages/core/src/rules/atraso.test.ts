import { describe, expect, it } from 'vitest';
import { atividade, sessao, SP } from '../test/fabricas';
import { diasSemSessao, estaParada, limiteEfetivo, limitePadrao } from './atraso';

describe('diasSemSessao', () => {
  it('conta dias de calendário no fuso de São Paulo', () => {
    // 23:00 de segunda em SP já é terça em UTC; tem que contar como segunda.
    const s = sessao(SP('2026-10-12T23:00'));
    expect(diasSemSessao(atividade(), [s], SP('2026-10-13T08:00'))).toBe(1);
    expect(diasSemSessao(atividade(), [s], SP('2026-10-12T23:59'))).toBe(0);
  });

  it('usa a sessão mais recente e ignora planejadas, excluídas e futuras', () => {
    const sessoes = [
      sessao(SP('2026-10-05T10:00')),
      sessao(SP('2026-10-08T10:00')),
      sessao(SP('2026-10-14T10:00'), { origem: 'planejada' }),
      sessao(SP('2026-10-13T10:00'), { excluidoEm: '2026-10-13T14:00:00.000Z' }),
      sessao(SP('2026-10-20T10:00')),
      sessao(SP('2026-10-13T10:00'), { atividadeId: 'outra' }),
    ];
    expect(diasSemSessao(atividade(), sessoes, SP('2026-10-15T12:00'))).toBe(7);
  });

  it('sem nenhuma sessão registrada, devolve null', () => {
    const planejada = sessao(SP('2026-10-14T10:00'), { origem: 'planejada' });
    expect(diasSemSessao(atividade(), [planejada], SP('2026-10-15T12:00'))).toBeNull();
  });
});

describe('limite padrão derivado da meta', () => {
  it('é ceil(7 / meta) + 2; sem meta, 14', () => {
    expect(limitePadrao(1)).toBe(9);
    expect(limitePadrao(2)).toBe(6);
    expect(limitePadrao(3)).toBe(5);
    expect(limitePadrao(7)).toBe(3);
    expect(limitePadrao(14)).toBe(3);
    expect(limitePadrao(0)).toBe(14);
  });

  it('o limite da atividade sobrescreve o padrão', () => {
    expect(limiteEfetivo(atividade({ metaSemanal: 3, limiteDias: null }))).toBe(5);
    expect(limiteEfetivo(atividade({ metaSemanal: 3, limiteDias: 10 }))).toBe(10);
    expect(limiteEfetivo(atividade({ metaSemanal: 0, limiteDias: null }))).toBe(14);
  });
});

describe('estaParada', () => {
  const sabado = [sessao(SP('2026-10-10T18:00'))];

  it('com limite próprio, só avisa depois de passar do limite', () => {
    const a = atividade({ limiteDias: 3 });
    expect(estaParada(a, sabado, SP('2026-10-13T12:00'))).toBe(false); // 3 dias
    expect(estaParada(a, sabado, SP('2026-10-14T00:01'))).toBe(true); // 4 dias
  });

  it('sem limite próprio, usa o padrão da meta (meta 3 → 5 dias)', () => {
    const a = atividade({ metaSemanal: 3, limiteDias: null });
    expect(estaParada(a, sabado, SP('2026-10-15T23:59'))).toBe(false); // 5 dias
    expect(estaParada(a, sabado, SP('2026-10-16T00:00'))).toBe(true); // 6 dias
  });

  it('sem meta nem limite, usa 14 dias', () => {
    const a = atividade({ metaSemanal: 0, limiteDias: null });
    expect(estaParada(a, sabado, SP('2026-10-24T12:00'))).toBe(false); // 14 dias
    expect(estaParada(a, sabado, SP('2026-10-25T12:00'))).toBe(true); // 15 dias
  });

  it('nunca praticada não é "parada" (é outro card)', () => {
    expect(estaParada(atividade({ limiteDias: 1 }), [], SP('2026-12-01T12:00'))).toBe(false);
  });

  it('só deixa de alertar se estiver pausada', () => {
    expect(estaParada(atividade({ limiteDias: 1, pausada: true }), sabado, SP('2026-12-01T12:00'))).toBe(false);
  });
});
