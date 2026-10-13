import { describe, expect, it } from 'vitest';
import { SP } from '../test/fabricas';
import {
  combinarDataHora,
  inicioDaSemana,
  inicioDoDiaApos,
  paraDataLocal,
  paraHoraLocal,
  posicaoDoDia,
  posicaoNaSemana,
  type Calendario,
} from '.';

const DOMINGO: Calendario = { fuso: 'America/Sao_Paulo', inicioSemana: 0 };

describe('tempo em São Paulo', () => {
  it('semana padrão começa na segunda 00:00 local', () => {
    expect(inicioDaSemana(SP('2026-10-18T23:59')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
    expect(inicioDaSemana(SP('2026-10-12T00:00')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('semana pode começar no domingo', () => {
    expect(inicioDaSemana(SP('2026-10-17T23:59'), DOMINGO).toISOString()).toBe('2026-10-11T03:00:00.000Z');
    expect(inicioDaSemana(SP('2026-10-18T00:00'), DOMINGO).toISOString()).toBe('2026-10-18T03:00:00.000Z');
  });

  it('posição na semana segue o fuso, não o UTC', () => {
    expect(posicaoNaSemana(SP('2026-10-18T22:00'))).toBe(6); // domingo à noite (segunda em UTC)
    expect(posicaoNaSemana(SP('2026-10-12T00:00'))).toBe(0);
    expect(posicaoNaSemana(SP('2026-10-18T22:00'), DOMINGO)).toBe(0);
    expect(posicaoDoDia(5)).toBe(4); // sexta é o 5º dia numa semana de segunda
    expect(posicaoDoDia(5, DOMINGO)).toBe(5);
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
