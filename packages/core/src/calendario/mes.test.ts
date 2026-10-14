import { describe, expect, it } from 'vitest';
import { SP } from '../test/fabricas';
import type { Calendario } from '../time';
import { gradeDoMes, mesApos } from './mes';

const DOMINGO: Calendario = { fuso: 'America/Sao_Paulo', inicioSemana: 0 };
const pontas = (g: ReturnType<typeof gradeDoMes>) => [g.semanas[0]![0]!.data, g.semanas.at(-1)!.at(-1)!.data, g.semanas.length];

describe('gradeDoMes', () => {
  it('outubro/2026 começando na segunda: 28/09 a 01/11, 5 semanas', () => {
    const g = gradeDoMes(SP('2026-10-13T12:00'));
    expect([g.ano, g.mes]).toEqual([2026, 9]);
    expect(pontas(g)).toEqual(['2026-09-28', '2026-11-01', 5]);
    expect(g.semanas[0]!.map((d) => d.doMes)).toEqual([false, false, false, true, true, true, true]);
  });

  it('respeita o início de semana no domingo', () => {
    expect(pontas(gradeDoMes(SP('2026-10-13T12:00'), DOMINGO))).toEqual(['2026-09-27', '2026-10-31', 5]);
  });

  it('fevereiro/2027 cabe em 4 semanas; agosto/2026 precisa de 6', () => {
    expect(pontas(gradeDoMes(SP('2027-02-10T12:00')))).toEqual(['2027-02-01', '2027-02-28', 4]);
    expect(pontas(gradeDoMes(SP('2026-08-10T12:00')))).toEqual(['2026-07-27', '2026-09-06', 6]);
  });

  it('o mês segue o fuso de São Paulo (31/10 às 22h já é novembro em UTC)', () => {
    expect(gradeDoMes(SP('2026-10-31T22:00')).mes).toBe(9);
  });

  it('mesApos vai para o dia 1 do mês (sem pular meses curtos)', () => {
    expect(gradeDoMes(mesApos(SP('2027-01-31T12:00'), 1)).mes).toBe(1);
    expect(gradeDoMes(mesApos(SP('2026-01-15T12:00'), -1)).ano).toBe(2025);
  });
});
