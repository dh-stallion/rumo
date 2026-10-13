import { describe, expect, it } from 'vitest';
import { SP } from '../test/fabricas';
import {
  combinarDataHora,
  diaDaSemana,
  inicioDaSemana,
  inicioDoDiaApos,
  paraDataLocal,
  paraHoraLocal,
} from '.';

describe('tempo em São Paulo', () => {
  it('semana começa na segunda 00:00 local', () => {
    expect(inicioDaSemana(SP('2026-10-18T23:59')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
    expect(inicioDaSemana(SP('2026-10-12T00:00')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('dia da semana segue o fuso, não o UTC', () => {
    expect(diaDaSemana(SP('2026-10-18T22:00'))).toBe(7); // domingo à noite (segunda em UTC)
  });

  it('combina data e hora locais', () => {
    expect(combinarDataHora('2026-10-13', '14:30').toISOString()).toBe('2026-10-13T17:30:00.000Z');
  });

  it('formata no fuso', () => {
    const d = new Date('2026-10-13T01:15:00.000Z');
    expect(paraDataLocal(d)).toBe('2026-10-12');
    expect(paraHoraLocal(d)).toBe('22:15');
  });

  it('início do dia seguinte', () => {
    expect(inicioDoDiaApos(SP('2026-10-12T23:00'), 1).toISOString()).toBe('2026-10-13T03:00:00.000Z');
  });
});
