import { describe, expect, it } from 'vitest';
import { SP } from '../test/fabricas';
import { descreverRepeticao, ordinalNoMes, repeticaoDe, rruleDe, type Repeticao } from './repeticao';

const terca = SP('2026-10-13T19:00'); // 2ª terça de outubro
const nunca = { tipo: 'nunca' } as const;

describe('opções de repetição ↔ RRULE', () => {
  const casos: [Repeticao, string | null, string][] = [
    [{ tipo: 'nunca', dias: [2], termino: nunca }, null, 'Não repete'],
    [{ tipo: 'diario', dias: [2], termino: nunca }, 'FREQ=DAILY', 'Todo dia'],
    [{ tipo: 'uteis', dias: [2], termino: nunca }, 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', 'Dias úteis (seg–sex)'],
    [{ tipo: 'semanal', dias: [4, 2], termino: nunca }, 'FREQ=WEEKLY;BYDAY=TU,TH', 'Toda semana: ter, qui'],
    [{ tipo: 'quinzenal', dias: [0, 2], termino: nunca }, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,SU', 'A cada 2 semanas: ter, dom'],
    [{ tipo: 'mensal-dia', dias: [2], termino: nunca }, 'FREQ=MONTHLY', 'Todo mês no dia 13'],
    [{ tipo: 'mensal-semana', dias: [2], termino: nunca }, 'FREQ=MONTHLY;BYDAY=2TU', 'Todo mês na 2ª terça'],
    [{ tipo: 'anual', dias: [2], termino: nunca }, 'FREQ=YEARLY', 'Todo ano em 13/10'],
    [
      { tipo: 'semanal', dias: [2], termino: { tipo: 'data', data: '2026-12-20' } },
      'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261221T025959Z',
      'Toda semana: ter · até 20/12/2026',
    ],
    [{ tipo: 'diario', dias: [2], termino: { tipo: 'vezes', vezes: 10 } }, 'FREQ=DAILY;COUNT=10', 'Todo dia · 10 vezes'],
  ];

  it.each(casos)('%o → %s', (rep, rrule, texto) => {
    expect(rruleDe(rep, terca)).toBe(rrule);
    expect(descreverRepeticao(rep, terca)).toBe(texto);
    expect(repeticaoDe(rrule, terca)).toEqual({ ...rep, dias: rep.tipo === 'semanal' || rep.tipo === 'quinzenal' ? [...rep.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [2] });
  });

  it('regra fora das opções vira "personalizada" e é preservada', () => {
    const rep = repeticaoDe('FREQ=MONTHLY;BYMONTHDAY=1,15', terca);
    expect(rep.tipo).toBe('personalizado');
    expect(rruleDe(rep, terca)).toBe('FREQ=MONTHLY;BYMONTHDAY=1,15');
    expect(descreverRepeticao(rep, terca)).toBe('Regra personalizada');
    expect(repeticaoDe('FREQ=MONTHLY;BYSETPOS=1', terca).tipo).toBe('personalizado');
  });

  it('mensal "na Nª" acompanha a data do evento', () => {
    expect(ordinalNoMes(SP('2026-10-30T18:00'))).toBe(-1); // 5ª sexta = última
    expect(rruleDe({ tipo: 'mensal-semana', dias: [], termino: nunca }, SP('2026-10-30T18:00'))).toBe('FREQ=MONTHLY;BYDAY=-1FR');
    expect(descreverRepeticao({ tipo: 'mensal-semana', dias: [], termino: nunca }, SP('2026-10-30T18:00'))).toBe('Todo mês na última sexta');
    expect(descreverRepeticao({ tipo: 'mensal-semana', dias: [], termino: nunca }, SP('2026-10-10T18:00'))).toBe('Todo mês no 2º sábado');
  });
});
