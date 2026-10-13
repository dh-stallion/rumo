import { describe, expect, it } from 'vitest';
import { atividade, SP } from '../test/fabricas';
import { itensDeAtencao } from './hoje';

/**
 * Relato do teste no iPhone: dois hobbies cadastrados, nenhum card em "Hoje".
 * Cenário: terça-feira, metas 1x e 3x, sem limite de dias, sem nenhuma sessão.
 */
describe('reprodução: hobbies novos não aparecem em Hoje', () => {
  const terca = SP('2026-10-13T12:00');
  const criadoEm = SP('2026-10-13T09:00').toISOString();
  const atividades = [
    atividade({ id: 'h1', nome: 'Desenho', categoria: 'hobby', metaSemanal: 1, limiteDias: null, criadoEm }),
    atividade({ id: 'h3', nome: 'Violão', categoria: 'hobby', metaSemanal: 3, limiteDias: null, criadoEm }),
  ];

  it('mostra um card para cada hobby', () => {
    const itens = itensDeAtencao({ atividades, sessoes: [], pessoas: [], adiamentos: [] }, terca);
    expect(itens.map((i) => (i.tipo === 'atividade' ? i.atividade.nome : i.pessoa.nome))).toEqual([
      'Desenho',
      'Violão',
    ]);
  });
});
