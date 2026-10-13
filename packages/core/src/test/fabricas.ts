import type { Adiamento, Atividade, Pessoa, Sessao } from '../model';

/** Semana de referência: segunda 12/10/2026 a domingo 18/10/2026 (São Paulo, UTC−3). */
export const SP = (diaHora: string) => new Date(`${diaHora}-03:00`);

const base = { criadoEm: '2026-01-01T12:00:00.000Z', atualizadoEm: '2026-01-01T12:00:00.000Z', excluidoEm: null };

export const atividade = (p: Partial<Atividade> = {}): Atividade => ({
  ...base,
  id: 'a1',
  nome: 'Violão',
  categoria: 'hobby',
  duracaoPadraoMin: 30,
  metaSemanal: 0,
  cor: '#6366f1',
  pausada: false,
  limiteDias: null,
  ...p,
});

let seq = 0;
export const sessao = (inicio: Date, p: Partial<Sessao> = {}): Sessao => ({
  ...base,
  id: `s${++seq}`,
  atividadeId: 'a1',
  inicio: inicio.toISOString(),
  fim: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
  origem: 'registrada',
  ...p,
});

export const pessoa = (p: Partial<Pessoa> = {}): Pessoa => ({
  ...base,
  id: 'p1',
  nome: 'Ana',
  frequenciaDias: 7,
  ultimoContato: null,
  notas: '',
  pausada: false,
  ...p,
});

export const adiamento = (p: Partial<Adiamento> & Pick<Adiamento, 'alvoId' | 'ate'>): Adiamento => ({
  ...base,
  id: `adi-${p.alvoId}`,
  alvoTipo: 'atividade',
  ...p,
});
