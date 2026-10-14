import { describe, expect, it } from 'vitest';
import { blocosDoDia, minParaPx, pxParaMin } from './geometria';

const SP = (s: string) => new Date(`${s}-03:00`).toISOString();
const it_ = (id: string, ini: string, fim: string) => ({ id, inicio: SP(`2026-10-14T${ini}`), fim: SP(`2026-10-14T${fim}`) });
const quarta = new Date(SP('2026-10-14T12:00'));
const resumo = (itens: ReturnType<typeof it_>[]) =>
  blocosDoDia(itens, quarta).map((b) => `${b.item.id} ${b.inicioMin}-${b.fimMin} ${b.faixa}/${b.faixas}`);

describe('geometria da grade', () => {
  it('converte minutos e pixels (1h = 56px)', () => {
    expect(minParaPx(60)).toBe(56);
    expect(minParaPx(15)).toBe(14);
    expect(pxParaMin(28)).toBe(30);
  });

  it('posiciona em minutos desde 00:00 local', () => {
    expect(resumo([it_('a', '19:00', '19:30')])).toEqual(['a 1140-1170 0/1']);
  });

  it('sobrepostos dividem a largura; os que só se encostam não', () => {
    expect(resumo([it_('a', '10:00', '11:00'), it_('b', '10:30', '11:30'), it_('c', '11:30', '12:00')])).toEqual([
      'a 600-660 0/2',
      'b 630-690 1/2',
      'c 690-720 0/1',
    ]);
  });

  it('reaproveita a faixa livre dentro do mesmo grupo', () => {
    expect(resumo([it_('longo', '09:00', '12:00'), it_('b', '09:00', '10:00'), it_('c', '10:00', '11:00')])).toEqual([
      'longo 540-720 0/2',
      'b 540-600 1/2',
      'c 600-660 1/2',
    ]);
  });

  it('recorta itens que atravessam a meia-noite', () => {
    const virada = { id: 'v', inicio: SP('2026-10-13T23:00'), fim: SP('2026-10-14T01:00') };
    const fora = { id: 'f', inicio: SP('2026-10-15T00:00'), fim: SP('2026-10-15T01:00') };
    expect(resumo([virada, fora])).toEqual(['v 0-60 0/1']);
  });
});
