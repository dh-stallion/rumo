import { describe, expect, it } from 'vitest';
import { atividade, sessao, SP } from '../test/fabricas';
import { diasSemSessao, estaParada } from './atraso';

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

  it('sem sessões, conta desde a criação da atividade', () => {
    const a = atividade({ criadoEm: SP('2026-10-14T09:00').toISOString() });
    expect(diasSemSessao(a, [], SP('2026-10-15T12:00'))).toBe(1);
  });
});

describe('estaParada', () => {
  const s = [sessao(SP('2026-10-10T18:00'))]; // sábado

  it('só avisa depois de passar do limite', () => {
    const a = atividade({ limiteDias: 3 });
    expect(estaParada(a, s, SP('2026-10-13T12:00'))).toBe(false); // 3 dias
    expect(estaParada(a, s, SP('2026-10-14T00:01'))).toBe(true); // 4 dias
  });

  it('sem limite definido, nunca avisa', () => {
    expect(estaParada(atividade({ limiteDias: null }), s, SP('2026-12-01T12:00'))).toBe(false);
    expect(estaParada(atividade({ limiteDias: 0 }), s, SP('2026-12-01T12:00'))).toBe(false);
  });

  it('atividade pausada nunca avisa', () => {
    expect(estaParada(atividade({ limiteDias: 1, pausada: true }), s, SP('2026-12-01T12:00'))).toBe(false);
  });
});
