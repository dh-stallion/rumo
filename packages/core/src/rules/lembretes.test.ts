import { describe, expect, it } from 'vitest';
import type { Evento, PreferenciasNotificacao } from '../model';
import { adiamento, atividade, pessoa, SP } from '../test/fabricas';
import { lembretesDevidos, type DadosLembretes } from './lembretes';

const T = '2026-10-01T15:00:00.000Z';
const iso = (s: string) => SP(s).toISOString();
const evento = (p: Partial<Evento> & Pick<Evento, 'id' | 'titulo' | 'inicio' | 'fim'>): Evento => ({
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  fixo: true,
  pessoaId: null,
  rrule: null,
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
  ...p,
});

const prefs: PreferenciasNotificacao = { resumo: true, horaResumo: '08:00', eventos: true, minutosAntes: 15, contatos: true };
const dentista = evento({ id: 'd', titulo: 'Dentista', inicio: iso('2026-10-13T15:00'), fim: iso('2026-10-13T16:00') });
const aula = evento({ id: 'aula', titulo: 'Aula', inicio: iso('2026-10-06T19:00'), fim: iso('2026-10-06T21:00'), rrule: 'FREQ=WEEKLY;BYDAY=TU' });
const ana = pessoa({ id: 'p1', nome: 'Ana', frequenciaDias: 7, ultimoContato: iso('2026-10-01T10:00') });
const dados: DadosLembretes = {
  atividades: [atividade({ id: 'a1', nome: 'Violão', metaSemanal: 3, criadoEm: iso('2026-10-13T07:00') })],
  sessoes: [],
  pessoas: [ana],
  adiamentos: [],
  eventos: [dentista, aula],
};
const chaves = (agora: string, enviados: string[] = [], p = prefs, d = dados) =>
  lembretesDevidos(d, p, SP(agora), new Set(enviados)).map((l) => l.chave);

describe('resumo diário', () => {
  it('sai a partir do horário escolhido, uma vez por dia', () => {
    expect(chaves('2026-10-13T07:59')).toEqual([]);
    const [resumo] = lembretesDevidos(dados, prefs, SP('2026-10-13T08:00'), new Set());
    expect(resumo).toEqual({
      chave: 'resumo:2026-10-13',
      titulo: 'Seu dia',
      corpo: '2 coisas pedem atenção · 2 compromissos (Dentista às 15:00, Aula às 19:00)', // Violão (nova) e Ana (contato)
      url: '/',
    });
    expect(chaves('2026-10-13T09:00', ['resumo:2026-10-13', 'contato:p1:' + ana.ultimoContato])).toEqual([]);
  });

  it('não sai quando o dia está livre', () => {
    const livre = { ...dados, atividades: [], pessoas: [], eventos: [] };
    expect(chaves('2026-10-13T08:00', [], prefs, livre)).toEqual([]);
  });
});

describe('antes de compromissos fixos', () => {
  it('avisa dentro da antecedência, só fixos, uma vez por ocorrência (inclusive de séries)', () => {
    expect(chaves('2026-10-13T14:44', ['resumo:2026-10-13'], { ...prefs, contatos: false })).toEqual([]);
    const [l] = lembretesDevidos(dados, { ...prefs, resumo: false, contatos: false }, SP('2026-10-13T14:50'), new Set());
    expect(l).toEqual({ chave: `evento:d:${iso('2026-10-13T15:00')}`, titulo: 'Dentista', corpo: 'Às 15:00 (em 10 minutos)', url: '/semana' });
    expect(chaves('2026-10-13T14:55', [l!.chave], { ...prefs, resumo: false, contatos: false })).toEqual([]);
    // Série semanal: a ocorrência de hoje às 19:00 tem chave própria.
    expect(chaves('2026-10-13T18:50', [], { ...prefs, resumo: false, contatos: false })).toEqual([`evento:aula@${iso('2026-10-13T19:00')}:${iso('2026-10-13T19:00')}`]);
    // Não fixo não avisa.
    const solto = { ...dados, eventos: [{ ...dentista, fixo: false }] };
    expect(chaves('2026-10-13T14:50', [], { ...prefs, resumo: false, contatos: false }, solto)).toEqual([]);
  });
});

describe('contato com pessoas', () => {
  const soContato = { ...prefs, resumo: false, eventos: false };

  it('uma vez por vencimento, só depois do horário do resumo', () => {
    expect(chaves('2026-10-13T07:00', [], soContato)).toEqual([]);
    const [l] = lembretesDevidos(dados, soContato, SP('2026-10-13T08:30'), new Set());
    expect(l).toMatchObject({ titulo: 'Que tal falar com Ana?', corpo: 'Último contato há 12 dias.', url: '/semana?visao=pessoas' });
    expect(chaves('2026-10-14T08:30', [l!.chave], soContato)).toEqual([]);
    // Registrou um contato e venceu de novo: novo lembrete.
    const depois = { ...dados, pessoas: [{ ...ana, ultimoContato: iso('2026-10-14T10:00') }] };
    expect(chaves('2026-10-21T09:00', [l!.chave], soContato, depois)).toEqual([`contato:p1:${iso('2026-10-14T10:00')}`]);
  });

  it('adiada ou pausada no app não gera lembrete', () => {
    const adiada = { ...dados, adiamentos: [adiamento({ alvoTipo: 'pessoa', alvoId: 'p1', ate: iso('2026-10-15T00:00') })] };
    expect(chaves('2026-10-13T09:00', [], soContato, adiada)).toEqual([]);
    expect(chaves('2026-10-13T09:00', [], soContato, { ...dados, pessoas: [{ ...ana, pausada: true }] })).toEqual([]);
  });
});

describe('preferências', () => {
  it('cada tipo pode ser desligado', () => {
    expect(chaves('2026-10-13T14:50', [], { ...prefs, resumo: false, eventos: false, contatos: false })).toEqual([]);
  });
});
