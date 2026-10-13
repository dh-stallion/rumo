import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { atividade, sessao, SP } from '../test/fabricas';
import { proximosCompromissos, rotuloDia } from './compromissos';

const terca = SP('2026-10-13T12:00');

const evento = (id: string, inicio: string, p: Partial<Evento> = {}): Evento => ({
  id,
  criadoEm: '',
  atualizadoEm: '',
  excluidoEm: null,
  titulo: id,
  inicio: SP(inicio).toISOString(),
  fim: new Date(SP(inicio).getTime() + 3_600_000).toISOString(),
  fixo: true,
  pessoaId: null,
  rrule: null,
  ...p,
});

const violao = atividade({ id: 'a1', nome: 'Violão' });
const planejada = (inicio: string, p = {}) => sessao(SP(inicio), { atividadeId: 'a1', origem: 'planejada', ...p });
const resumo = (agora: Date, dados: Parameters<typeof proximosCompromissos>[0]) =>
  proximosCompromissos(dados, agora).map((d) => `${d.data}: ${d.itens.map((i) => i.titulo).join(', ')}`);

describe('proximosCompromissos', () => {
  it('junta eventos e sessões planejadas, em ordem de horário dentro de cada dia', () => {
    const dados = {
      eventos: [evento('Dentista', '2026-10-14T15:00'), evento('Café', '2026-10-14T08:00'), evento('Aula', '2026-10-16T19:00')],
      sessoes: [planejada('2026-10-14T10:00'), planejada('2026-10-16T07:00')],
      atividades: [violao],
    };
    expect(resumo(terca, dados)).toEqual([
      '2026-10-14: Café, Violão, Dentista',
      '2026-10-16: Violão, Aula',
    ]);
  });

  it('no mesmo horário, desempata pelo título', () => {
    const dados = { eventos: [evento('Zumba', '2026-10-14T08:00'), evento('Almoço', '2026-10-14T08:00')], sessoes: [], atividades: [] };
    expect(resumo(terca, dados)).toEqual(['2026-10-14: Almoço, Zumba']);
  });

  it('cobre de amanhã até 7 dias à frente, sem repetir os de hoje', () => {
    const dados = {
      eventos: [
        evento('hoje-noite', '2026-10-13T22:00'),
        evento('amanha-cedo', '2026-10-14T00:00'),
        evento('dia-7', '2026-10-20T23:59'),
        evento('dia-8', '2026-10-21T00:00'),
      ],
      sessoes: [],
      atividades: [],
    };
    expect(resumo(terca, dados)).toEqual(['2026-10-14: amanha-cedo', '2026-10-20: dia-7']);
  });

  it('agrupa pelo dia em São Paulo, não pelo dia em UTC', () => {
    // 23:30 de quarta em SP é 02:30 de quinta em UTC.
    const dados = { eventos: [evento('quarta-noite', '2026-10-14T23:30'), evento('quinta-madrugada', '2026-10-15T00:30')], sessoes: [], atividades: [] };
    expect(resumo(terca, dados)).toEqual(['2026-10-14: quarta-noite', '2026-10-15: quinta-madrugada']);
  });

  it('a virada do dia segue São Paulo: às 23:30 de terça, "amanhã" já é quarta', () => {
    const tercaNoite = SP('2026-10-13T23:30'); // já é quarta em UTC
    const dados = { eventos: [evento('quarta', '2026-10-14T09:00'), evento('terca-tarde', '2026-10-13T23:45')], sessoes: [], atividades: [] };
    expect(resumo(tercaNoite, dados)).toEqual(['2026-10-14: quarta']);
  });

  it('ignora sessões registradas, excluídos e sessões de atividades excluídas', () => {
    const excluida = atividade({ id: 'x', nome: 'Antiga', excluidoEm: '2026-10-01T00:00:00.000Z' });
    const dados = {
      eventos: [evento('cancelado', '2026-10-14T09:00', { excluidoEm: '2026-10-13T10:00:00.000Z' })],
      sessoes: [
        sessao(SP('2026-10-14T10:00'), { atividadeId: 'a1', origem: 'registrada' }),
        planejada('2026-10-14T11:00', { excluidoEm: '2026-10-13T10:00:00.000Z' }),
        sessao(SP('2026-10-14T12:00'), { atividadeId: 'x', origem: 'planejada' }),
      ],
      atividades: [violao, excluida],
    };
    expect(resumo(terca, dados)).toEqual([]);
  });
});

describe('rotuloDia', () => {
  it('usa Hoje, Amanhã e "Quinta, 16/10"', () => {
    expect(rotuloDia('2026-10-13', terca)).toBe('Hoje');
    expect(rotuloDia('2026-10-14', terca)).toBe('Amanhã');
    expect(rotuloDia('2026-10-15', terca)).toBe('Quinta, 15/10');
    expect(rotuloDia('2026-10-16', terca)).toBe('Sexta, 16/10');
    expect(rotuloDia('2026-10-18', terca)).toBe('Domingo, 18/10');
    expect(rotuloDia('2026-10-19', terca)).toBe('Segunda, 19/10');
  });

  it('a virada de dia segue São Paulo', () => {
    const tercaNoite = SP('2026-10-13T23:30'); // quarta em UTC
    expect(rotuloDia('2026-10-13', tercaNoite)).toBe('Hoje');
    expect(rotuloDia('2026-10-14', tercaNoite)).toBe('Amanhã');
  });
});
