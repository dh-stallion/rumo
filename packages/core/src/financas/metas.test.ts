import { describe, expect, it } from 'vitest';
import type { MetaFinanceira, Projeto } from '../model';
import { SP } from '../test/fabricas';
import { formatarReais, formatarReaisCurto, lerReais } from './dinheiro';
import { alvoDaMeta, progressoMeta, totalItens } from './metas';

const T = SP('2026-10-01T10:00').toISOString();
const hoje = SP('2026-10-13T12:00');

const meta = (p: Partial<MetaFinanceira> = {}): MetaFinanceira => ({
  id: 'm1',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  nome: 'Euros para a viagem',
  valorAlvoCentavos: 1_800_000,
  prazo: '2026-12-31',
  saldoInicialCentavos: 0,
  aportes: [],
  projetoId: null,
  ...p,
});

const nas: Projeto = {
  id: 'nas',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  nome: 'Montar um NAS',
  descricao: '',
  cor: '#0ea5e9',
  arquivado: false,
  marcos: [],
  acoes: [],
  itens: [
    { id: 'i1', nome: 'Gabinete', precoCentavos: 150_000, comprado: true },
    { id: 'i2', nome: 'Placa-mãe', precoCentavos: 80_000, comprado: false },
    { id: 'i3', nome: '2× HD 8 TB', precoCentavos: 220_000, comprado: false },
  ],
};

describe('dinheiro', () => {
  it('lê valores como se digita no Brasil', () => {
    expect(lerReais('1.234,56')).toBe(123_456);
    expect(lerReais('R$ 1.234')).toBe(123_400);
    expect(lerReais('1234,5')).toBe(123_450);
    expect(lerReais('12.5')).toBe(1_250);
    expect(lerReais('1.234')).toBe(123_400);
    expect(lerReais('-50')).toBe(-5_000);
    expect(lerReais('0,99')).toBe(99);
  });

  it('recusa o que não é valor', () => {
    for (const t of ['', 'abc', '1,2,3', '12,345', 'R$']) expect(lerReais(t)).toBeNull();
  });

  it('formata em reais', () => {
    expect(formatarReais(123_456)).toBe('R$ 1.234,56');
    expect(formatarReaisCurto(600_000)).toBe('R$ 6.000');
    expect(formatarReaisCurto(116_667)).toBe('R$ 1.166,67');
  });
});

describe('progressoMeta', () => {
  it('euros até dezembro: aporte mensal e semanal necessários', () => {
    const p = progressoMeta(meta({ aportes: [{ id: 'a1', data: '2026-10-01', valorCentavos: 400_000, nota: '' }] }), null, hoje);
    expect(p).toMatchObject({ alvo: 1_800_000, atual: 400_000, faltam: 1_400_000, concluida: false, vencida: false });
    expect(p.mesesRestantes).toBe(3); // out, nov, dez
    expect(p.aporteMensal).toBe(466_667); // R$ 4.666,67
    expect(p.semanasRestantes).toBe(12); // 80 dias contando hoje
    expect(p.aporteSemanal).toBe(116_667);
    expect(p.percentual).toBeCloseTo(400 / 1800);
  });

  it('ritmo: compara com uma linha reta da criação até o prazo', () => {
    // 12 de 91 dias decorridos → esperado ≈ R$ 2.373,63
    const p = progressoMeta(meta({ aportes: [{ id: 'a1', data: '2026-10-01', valorCentavos: 100_000, nota: '' }] }), null, hoje);
    expect(p.esperadoHoje).toBe(237_363);
    expect(p.noRitmo).toBe(false);
  });

  it('meta ligada a projeto sem alvo usa a soma dos itens (NAS)', () => {
    expect(totalItens(nas)).toBe(450_000);
    const m = meta({ valorAlvoCentavos: null, projetoId: 'nas', prazo: '2027-03-31', saldoInicialCentavos: 150_000 });
    expect(alvoDaMeta(m, nas)).toBe(450_000);
    const p = progressoMeta(m, nas, hoje);
    expect(p).toMatchObject({ alvo: 450_000, atual: 150_000, faltam: 300_000, mesesRestantes: 6, aporteMensal: 50_000 });
    expect(alvoDaMeta(m, null)).toBe(0);
  });

  it('concluída: nada mais a guardar', () => {
    const p = progressoMeta(meta({ saldoInicialCentavos: 2_000_000 }), null, hoje);
    expect(p).toMatchObject({ concluida: true, faltam: 0, aporteMensal: 0, aporteSemanal: 0, percentual: 1 });
  });

  it('prazo vencido: o que falta vira o aporte', () => {
    const p = progressoMeta(meta({ prazo: '2026-10-10' }), null, hoje);
    expect(p).toMatchObject({ vencida: true, mesesRestantes: 1, semanasRestantes: 0, aporteSemanal: 1_800_000 });
  });

  it('prazo hoje conta como 1 semana e 1 mês', () => {
    const p = progressoMeta(meta({ prazo: '2026-10-13' }), null, hoje);
    expect(p).toMatchObject({ vencida: false, mesesRestantes: 1, semanasRestantes: 1, aporteMensal: 1_800_000 });
  });

  it('retiradas (aporte negativo) reduzem o saldo', () => {
    const p = progressoMeta(
      meta({
        aportes: [
          { id: 'a1', data: '2026-10-01', valorCentavos: 500_000, nota: '' },
          { id: 'a2', data: '2026-10-05', valorCentavos: -100_000, nota: 'emergência' },
        ],
      }),
      null,
      hoje,
    );
    expect(p.atual).toBe(400_000);
  });
});
