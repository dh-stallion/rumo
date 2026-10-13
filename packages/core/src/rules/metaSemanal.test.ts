import { describe, expect, it } from 'vitest';
import type { Calendario } from '../time';
import { atividade, sessao, SP } from '../test/fabricas';
import { progressoSemanal } from './metaSemanal';

// Semana de 12/10 (seg) a 18/10 (dom); 11/10 é domingo e 17/10 é sábado.
const dias = {
  dom0: '2026-10-11',
  seg: '2026-10-12',
  ter: '2026-10-13',
  qua: '2026-10-14',
  qui: '2026-10-15',
  sex: '2026-10-16',
  sab: '2026-10-17',
  dom: '2026-10-18',
} as const;
type Dia = keyof typeof dias;
const em = (d: Dia, h = '12:00') => SP(`${dias[d]}T${h}`);
const DOMINGO: Calendario = { fuso: 'America/Sao_Paulo', inicioSemana: 0 };
const SABADO: Calendario = { fuso: 'America/Sao_Paulo', inicioSemana: 6 };

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
    const atrasada = (d: Dia) => progressoSemanal(a, [], em(d)).atrasada;
    expect((['seg', 'ter', 'qua'] as const).map(atrasada)).toEqual([false, false, false]);
    expect((['qui', 'sex', 'sab', 'dom'] as const).map(atrasada)).toEqual([true, true, true, true]);
  });

  it('meta 3 com 2 feitas: só pede atenção no domingo, quando é a última chance', () => {
    const a = atividade({ metaSemanal: 3 });
    const sessoes = [sessao(em('seg')), sessao(em('ter'))];
    expect(progressoSemanal(a, sessoes, em('sab')).atrasada).toBe(false);
    expect(progressoSemanal(a, sessoes, em('dom')).atrasada).toBe(true);
  });

  it('meta 1x: avisa a partir de sexta se nada foi feito na semana', () => {
    const a = atividade({ metaSemanal: 1 });
    const atrasada = (d: Dia) => progressoSemanal(a, [], em(d)).atrasada;
    expect((['seg', 'ter', 'qua', 'qui'] as const).map(atrasada)).toEqual([false, false, false, false]);
    expect((['sex', 'sab', 'dom'] as const).map(atrasada)).toEqual([true, true, true]);
    expect(progressoSemanal(a, [], em('sex', '00:00')).atrasada).toBe(true);
    expect(progressoSemanal(a, [], em('qui', '23:59')).atrasada).toBe(false);
  });

  it('meta 1x já cumprida não avisa', () => {
    const a = atividade({ metaSemanal: 1 });
    expect(progressoSemanal(a, [sessao(em('seg'))], em('sex')).atrasada).toBe(false);
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
    expect(progressoSemanal(atividade({ metaSemanal: 3, pausada: true }), [], em('dom')).atrasada).toBe(false);
  });
});

describe('início de semana configurável', () => {
  it('semana começando no domingo: a sessão de domingo conta na semana atual', () => {
    const a = atividade({ metaSemanal: 3 });
    const sessaoDomingo = [sessao(em('dom0', '10:00'))];
    expect(progressoSemanal(a, sessaoDomingo, em('ter')).feitas).toBe(0); // segunda: domingo é da semana anterior
    expect(progressoSemanal(a, sessaoDomingo, em('ter'), DOMINGO).feitas).toBe(1);
  });

  it('semana começando no domingo: a virada é domingo 00:00 em São Paulo', () => {
    const a = atividade({ metaSemanal: 3 });
    const sabadoNoite = [sessao(SP('2026-10-10T23:30'))]; // sábado 23:30 SP = domingo 02:30 UTC
    expect(progressoSemanal(a, sabadoNoite, em('ter'), DOMINGO).feitas).toBe(0);
  });

  it('meta 1x avisa a partir de sexta também com outros inícios de semana', () => {
    const a = atividade({ metaSemanal: 1 });
    // Domingo a sábado: sexta e sábado avisam; domingo já é semana nova.
    expect(progressoSemanal(a, [], em('qui'), DOMINGO).atrasada).toBe(false);
    expect(progressoSemanal(a, [], em('sex'), DOMINGO).atrasada).toBe(true);
    expect(progressoSemanal(a, [], em('sab'), DOMINGO).atrasada).toBe(true);
    expect(progressoSemanal(a, [], em('dom'), DOMINGO).atrasada).toBe(false);
    // Sábado a sexta: sexta é o último dia.
    expect(progressoSemanal(a, [], em('qui'), SABADO).atrasada).toBe(false);
    expect(progressoSemanal(a, [], em('sex'), SABADO).atrasada).toBe(true);
  });

  it('ritmo das outras metas segue a semana configurada', () => {
    const a = atividade({ metaSemanal: 3 });
    // Domingo a sábado: quarta é o 4º dia (3 encerrados) → ritmo 1 → atrasada sem nada feito.
    expect(progressoSemanal(a, [], em('qua'), DOMINGO).atrasada).toBe(true);
    expect(progressoSemanal(a, [], em('qua')).atrasada).toBe(false);
  });
});
