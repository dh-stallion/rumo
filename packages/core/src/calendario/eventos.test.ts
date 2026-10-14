import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { conflitosComFixos } from '../rules/planejamento';
import { eventosDoDia } from '../rules/hoje';
import { proximosCompromissos } from '../rules/compromissos';
import { SP } from '../test/fabricas';
import { chaveEvento, expandirEventos } from './eventos';

const iso = (s: string) => SP(s).toISOString();
const evento = (p: Partial<Evento> & Pick<Evento, 'id' | 'inicio' | 'fim'>): Evento => ({
  criadoEm: '',
  atualizadoEm: '',
  excluidoEm: null,
  titulo: p.id,
  fixo: true,
  pessoaId: null,
  rrule: null,
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
  ...p,
});

// Aula toda terça e quinta, 19:00–21:00.
const aula = evento({ id: 'aula', inicio: iso('2026-10-13T19:00'), fim: iso('2026-10-13T21:00'), rrule: 'FREQ=WEEKLY;BYDAY=TU,TH' });
const semana = [SP('2026-10-12T00:00'), SP('2026-10-19T00:00')] as const;
const resumo = (lista: ReturnType<typeof expandirEventos>) =>
  lista.map((e) => `${e.titulo} ${new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(e.inicio))}`);

describe('expandirEventos', () => {
  it('expande a série na janela, com fim calculado pela duração', () => {
    const r = expandirEventos([aula], ...semana);
    expect(resumo(r)).toEqual(['aula 2026-10-13 19:00', 'aula 2026-10-15 19:00']);
    expect(r[1]).toMatchObject({ fim: iso('2026-10-15T21:00'), ocorrencia: { serieId: 'aula', inicioOriginal: iso('2026-10-15T19:00') } });
  });

  it('pula ocorrências com EXDATE', () => {
    const r = expandirEventos([{ ...aula, exdatas: [iso('2026-10-15T19:00')] }], ...semana);
    expect(resumo(r)).toEqual(['aula 2026-10-13 19:00']);
  });

  it('ocorrência editada ("só este") substitui a original', () => {
    const editada = evento({
      id: 'aula-15',
      titulo: 'aula (sala 2)',
      inicio: iso('2026-10-15T20:00'),
      fim: iso('2026-10-15T22:00'),
      serieId: 'aula',
      ocorrenciaOriginal: iso('2026-10-15T19:00'),
    });
    const r = expandirEventos([aula, editada], ...semana);
    expect(resumo(r)).toEqual(['aula 2026-10-13 19:00', 'aula (sala 2) 2026-10-15 20:00']);
    expect(r.map(chaveEvento)).toEqual([`aula@${iso('2026-10-13T19:00')}`, `aula@${iso('2026-10-15T19:00')}`]);
  });

  it('inclui ocorrência que começou antes da janela e ainda não acabou', () => {
    const r = expandirEventos([aula], SP('2026-10-13T20:00'), SP('2026-10-13T20:30'));
    expect(resumo(r)).toEqual(['aula 2026-10-13 19:00']);
  });

  it('regra ilegível vira evento único (não some da agenda)', () => {
    const r = expandirEventos([{ ...aula, rrule: 'FREQ=MONTHLY;BYSETPOS=2' }], ...semana);
    expect(resumo(r)).toEqual(['aula 2026-10-13 19:00']);
  });
});

describe('séries nas regras existentes', () => {
  it('eventosDoDia mostra a ocorrência do dia', () => {
    expect(resumo(eventosDoDia([aula], SP('2026-10-22T08:00')))).toEqual(['aula 2026-10-22 19:00']);
  });

  it('conflito com evento fixo recorrente', () => {
    const sessaoQuinta = { inicio: iso('2026-10-29T20:00'), fim: iso('2026-10-29T20:30') };
    expect(conflitosComFixos(sessaoQuinta, [aula]).map((e) => e.inicio)).toEqual([iso('2026-10-29T19:00')]);
  });

  it('próximos compromissos: uma entrada por ocorrência, com ids únicos', () => {
    const dias = proximosCompromissos({ eventos: [aula], sessoes: [], atividades: [] }, SP('2026-10-13T12:00'));
    expect(dias.map((d) => d.data)).toEqual(['2026-10-15', '2026-10-20']);
    const ids = dias.flatMap((d) => d.itens.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
