import { describe, expect, it } from 'vitest';
import { SP } from '../test/fabricas';
import type { Calendario } from '../time';
import { chaveDaSemana, mostrarConvitePlanejar } from './convite';

const DOMINGO: Calendario = { fuso: 'America/Sao_Paulo', inicioSemana: 0 };
const ligado = { convitePlanejar: true, semanaConviteTratada: null };

describe('convite "Semana nova: planejar?"', () => {
  it('aparece numa semana ainda não tratada', () => {
    expect(mostrarConvitePlanejar(ligado, SP('2026-10-13T12:00'))).toBe(true);
  });

  it('depois de dispensado, some pelo resto da semana e volta na seguinte', () => {
    const dispensado = { convitePlanejar: true, semanaConviteTratada: chaveDaSemana(SP('2026-10-13T12:00')) };
    expect(dispensado.semanaConviteTratada).toBe('2026-10-12');
    expect(mostrarConvitePlanejar(dispensado, SP('2026-10-13T12:01'))).toBe(false);
    expect(mostrarConvitePlanejar(dispensado, SP('2026-10-18T23:59'))).toBe(false); // domingo
    expect(mostrarConvitePlanejar(dispensado, SP('2026-10-19T00:00'))).toBe(true); // segunda
  });

  it('a semana vira à meia-noite de São Paulo, não de UTC', () => {
    // Domingo 22:00 em SP já é segunda 01:00 em UTC: ainda é a mesma semana.
    expect(chaveDaSemana(SP('2026-10-18T22:00'))).toBe('2026-10-12');
    expect(chaveDaSemana(SP('2026-10-19T00:00'))).toBe('2026-10-19');
    // Segunda 00:30 em SP: semana nova (em UTC seria segunda 03:30 de qualquer forma).
    expect(chaveDaSemana(SP('2026-10-19T00:30'))).toBe('2026-10-19');
  });

  it('respeita o início de semana configurado', () => {
    const dispensado = { convitePlanejar: true, semanaConviteTratada: chaveDaSemana(SP('2026-10-13T12:00'), DOMINGO) };
    expect(dispensado.semanaConviteTratada).toBe('2026-10-11');
    expect(mostrarConvitePlanejar(dispensado, SP('2026-10-17T23:59'), DOMINGO)).toBe(false); // sábado
    expect(mostrarConvitePlanejar(dispensado, SP('2026-10-18T00:00'), DOMINGO)).toBe(true); // domingo
  });

  it('desligado nos Ajustes, nunca aparece', () => {
    expect(mostrarConvitePlanejar({ convitePlanejar: false, semanaConviteTratada: null }, SP('2026-10-13T12:00'))).toBe(false);
  });
});
