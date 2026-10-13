import { describe, expect, it } from 'vitest';
import { atividade, sessao, SP } from '../test/fabricas';
import { progressoSemanal } from './metaSemanal';

// Semana de 12/10 (seg) a 18/10 (dom).
const dias = {
  seg: '2026-10-12',
  ter: '2026-10-13',
  qua: '2026-10-14',
  qui: '2026-10-15',
  sex: '2026-10-16',
  sab: '2026-10-17',
  dom: '2026-10-18',
} as const;
const em = (d: keyof typeof dias, h = '12:00') => SP(`${dias[d]}T${h}`);

describe('progressoSemanal', () => {
  it('conta só sessões feitas desde segunda 00:00 em São Paulo', () => {
    const sessoes = [
      sessao(SP('2026-10-11T23:30')), // domingo anterior (já é segunda em UTC)
      sessao(em('seg', '00:00')),
      sessao(em('ter')),
      sessao(em('qua'), { origem: 'planejada' }),
    ];
    const p = progressoSemanal(atividade({ metaSemanal: 3 }), sessoes, em('qua'));
    expect(p.feitas).toBe(2);
    expect(p.meta).toBe(3);
  });

  it('meta 3 sem nada feito: tranquilo até quarta, pede atenção a partir de quinta', () => {
    const a = atividade({ metaSemanal: 3 });
    const atrasada = (d: keyof typeof dias) => progressoSemanal(a, [], em(d)).atrasada;
    expect([atrasada('seg'), atrasada('ter'), atrasada('qua')]).toEqual([false, false, false]);
    expect([atrasada('qui'), atrasada('sex'), atrasada('sab'), atrasada('dom')]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('meta 3 com 2 feitas: só pede atenção no domingo, quando é a última chance', () => {
    const a = atividade({ metaSemanal: 3 });
    const sessoes = [sessao(em('seg')), sessao(em('ter'))];
    expect(progressoSemanal(a, sessoes, em('sab')).atrasada).toBe(false);
    expect(progressoSemanal(a, sessoes, em('dom')).atrasada).toBe(true);
  });

  it('meta 1 só aparece no domingo', () => {
    const a = atividade({ metaSemanal: 1 });
    expect(progressoSemanal(a, [], em('sab')).atrasada).toBe(false);
    expect(progressoSemanal(a, [], em('dom')).atrasada).toBe(true);
  });

  it('meta diária aparece enquanto o dia de hoje não foi feito', () => {
    const a = atividade({ metaSemanal: 7 });
    expect(progressoSemanal(a, [], em('seg', '08:00')).atrasada).toBe(true);
    expect(progressoSemanal(a, [sessao(em('seg', '07:00'))], em('seg', '08:00')).atrasada).toBe(false);
  });

  it('meta cumprida, sem meta ou pausada: nunca atrasada', () => {
    const tres = [sessao(em('seg')), sessao(em('ter')), sessao(em('qua'))];
    expect(progressoSemanal(atividade({ metaSemanal: 3 }), tres, em('dom')).atrasada).toBe(false);
    expect(progressoSemanal(atividade({ metaSemanal: 0 }), [], em('dom')).atrasada).toBe(false);
    expect(progressoSemanal(atividade({ metaSemanal: 3, pausada: true }), [], em('dom')).atrasada).toBe(
      false,
    );
  });
});
