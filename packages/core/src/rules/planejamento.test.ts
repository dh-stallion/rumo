import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { sessao, SP } from '../test/fabricas';
import { inicioDaSemana } from '../time';
import {
  agendadasNaSemana,
  comoRegistrada,
  conflitosComFixos,
  duracaoMin,
  encaixar,
  planejadaDeHoje,
  posicionarNoDia,
  redimensionar,
} from './planejamento';

const iso = (s: string) => SP(s).toISOString();
const evento = (id: string, inicio: string, fim: string, fixo = true): Evento => ({
  id,
  criadoEm: '',
  atualizadoEm: '',
  excluidoEm: null,
  titulo: id,
  inicio: iso(inicio),
  fim: iso(fim),
  fixo,
  pessoaId: null,
  rrule: null,
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
});

describe('conflitosComFixos', () => {
  const eventos = [
    evento('Dentista', '2026-10-14T15:00', '2026-10-14T16:00'),
    evento('Livre', '2026-10-14T15:00', '2026-10-14T16:00', false),
    { ...evento('Cancelado', '2026-10-14T15:00', '2026-10-14T16:00'), excluidoEm: '2026-10-13T00:00:00.000Z' },
  ];
  const s = (ini: string, fim: string) => ({ inicio: iso(`2026-10-14T${ini}`), fim: iso(`2026-10-14T${fim}`) });

  it('detecta sobreposição só com eventos fixos e ativos', () => {
    expect(conflitosComFixos(s('15:30', '16:30'), eventos).map((e) => e.id)).toEqual(['Dentista']);
    expect(conflitosComFixos(s('14:00', '17:00'), eventos).map((e) => e.id)).toEqual(['Dentista']);
    expect(conflitosComFixos(s('15:15', '15:45'), eventos).map((e) => e.id)).toEqual(['Dentista']);
  });

  it('blocos que só se encostam não conflitam', () => {
    expect(conflitosComFixos(s('14:00', '15:00'), eventos)).toEqual([]);
    expect(conflitosComFixos(s('16:00', '17:00'), eventos)).toEqual([]);
  });
});

describe('posicionar e redimensionar', () => {
  const quarta = SP('2026-10-14T12:00');

  it('encaixa em 15 minutos', () => {
    expect([encaixar(0), encaixar(7), encaixar(8), encaixar(52), encaixar(53)]).toEqual([0, 0, 15, 45, 60]);
  });

  it('posiciona no dia local, encaixado', () => {
    expect(posicionarNoDia(quarta, 19 * 60 + 8, 30)).toEqual({
      inicio: iso('2026-10-14T19:15'),
      fim: iso('2026-10-14T19:45'),
    });
  });

  it('não deixa passar da meia-noite nem começar antes dela', () => {
    expect(posicionarNoDia(quarta, 23 * 60 + 45, 60)).toEqual({ inicio: iso('2026-10-14T23:00'), fim: iso('2026-10-15T00:00') });
    expect(posicionarNoDia(quarta, -30, 60)).toEqual({ inicio: iso('2026-10-14T00:00'), fim: iso('2026-10-14T01:00') });
  });

  it('redimensiona com encaixe, mínimo de 15 min e limite na meia-noite', () => {
    const s = { inicio: iso('2026-10-14T22:00'), fim: iso('2026-10-14T22:30') };
    expect(duracaoMin(redimensionar(s, 52))).toBe(45);
    expect(duracaoMin(redimensionar(s, 3))).toBe(15);
    expect(redimensionar(s, 300).fim).toBe(iso('2026-10-15T00:00'));
  });
});

describe('agendadasNaSemana ("X de Y agendados")', () => {
  const semana = inicioDaSemana(SP('2026-10-14T12:00')); // seg 12/10 00:00
  const sessoes = [
    sessao(SP('2026-10-12T00:00'), { origem: 'registrada' }),
    sessao(SP('2026-10-14T19:00'), { origem: 'planejada' }),
    sessao(SP('2026-10-18T23:30'), { origem: 'planejada' }), // domingo à noite (segunda em UTC)
    sessao(SP('2026-10-11T23:30'), { origem: 'planejada' }), // semana anterior
    sessao(SP('2026-10-19T00:00'), { origem: 'planejada' }), // semana seguinte
    sessao(SP('2026-10-15T10:00'), { origem: 'planejada', excluidoEm: '2026-10-13T00:00:00.000Z' }),
    sessao(SP('2026-10-15T10:00'), { origem: 'planejada', atividadeId: 'outra' }),
  ];

  it('conta planejadas + feitas da semana, no fuso de São Paulo', () => {
    expect(agendadasNaSemana('a1', sessoes, semana)).toBe(3);
  });

  it('marcar como feita não muda o contador', () => {
    const convertida = sessoes.map((s, i) => (i === 1 ? { ...s, origem: 'registrada' as const } : s));
    expect(agendadasNaSemana('a1', convertida, semana)).toBe(3);
  });
});

describe('comoRegistrada', () => {
  const agora = SP('2026-10-14T20:00');

  it('sessão que já começou mantém o horário', () => {
    const s = sessao(SP('2026-10-14T19:00'), { origem: 'planejada' });
    expect(comoRegistrada(s, agora)).toEqual({ inicio: s.inicio, fim: s.fim, origem: 'registrada' });
  });

  it('sessão futura passa a terminar agora, mantendo a duração', () => {
    const s = sessao(SP('2026-10-16T19:00'), { origem: 'planejada' }); // 30 min
    expect(comoRegistrada(s, agora)).toEqual({ inicio: iso('2026-10-14T19:30'), fim: iso('2026-10-14T20:00'), origem: 'registrada' });
  });

  it('não cruza a meia-noite', () => {
    const s = sessao(SP('2026-10-16T19:00'), { origem: 'planejada' });
    expect(comoRegistrada(s, SP('2026-10-14T00:10')).inicio).toBe(iso('2026-10-14T00:00'));
  });
});

describe('planejadaDeHoje', () => {
  it('acha a primeira planejada do dia local', () => {
    const sessoes = [
      sessao(SP('2026-10-14T19:00'), { id: 'tarde', origem: 'planejada' }),
      sessao(SP('2026-10-14T07:00'), { id: 'cedo', origem: 'planejada' }),
      sessao(SP('2026-10-14T06:00'), { id: 'feita', origem: 'registrada' }),
      sessao(SP('2026-10-13T23:30'), { id: 'ontem', origem: 'planejada' }),
    ];
    expect(planejadaDeHoje('a1', sessoes, SP('2026-10-14T12:00'))?.id).toBe('cedo');
    expect(planejadaDeHoje('a1', sessoes, SP('2026-10-15T12:00'))).toBeUndefined();
  });
});
