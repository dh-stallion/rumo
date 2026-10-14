import { describe, expect, it } from 'vitest';
import { atividade, sessao, SP } from '../test/fabricas';
import { validarMudancas, venceLWW } from './sync';

describe('venceLWW', () => {
  it('o mais novo vence; empate mantém o atual', () => {
    expect(venceLWW({ atualizadoEm: '2026-10-14T10:00:00.000Z' }, undefined)).toBe(true);
    expect(venceLWW({ atualizadoEm: '2026-10-14T10:00:01.000Z' }, { atualizadoEm: '2026-10-14T10:00:00.000Z' })).toBe(true);
    expect(venceLWW({ atualizadoEm: '2026-10-14T10:00:00.000Z' }, { atualizadoEm: '2026-10-14T10:00:00.000Z' })).toBe(false);
    expect(venceLWW({ atualizadoEm: '2026-10-14T09:00:00.000Z' }, { atualizadoEm: '2026-10-14T10:00:00.000Z' })).toBe(false);
  });
});

describe('validarMudancas', () => {
  it('separa válidos e rejeitados com o motivo', () => {
    const r = validarMudancas({
      atividades: [atividade({ id: 'a1' }), { ...atividade({ id: 'a2' }), categoria: 'trabalho' }],
      sessoes: [sessao(SP('2026-10-14T10:00'))],
      planilhas: [{ id: 'x' }],
    });
    expect(r.validos.atividades!.map((a) => a.id)).toEqual(['a1']);
    expect(r.validos.sessoes).toHaveLength(1);
    expect(r.rejeitados).toEqual([
      { tabela: 'atividades', id: 'a2', erro: 'campo "categoria": valor inválido' },
      { tabela: 'planilhas', id: null, erro: 'tabela desconhecida' },
    ]);
  });
});
