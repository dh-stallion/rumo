import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { SP } from '../test/fabricas';
import { expandirEventos, type EventoNaAgenda } from './eventos';
import { escoposPermitidos, planoEditar, planoExcluir, type ContextoSerie, type MudancasOcorrencia, type PlanoSerie } from './series';

const iso = (s: string) => SP(s).toISOString();
const T = '2026-10-01T00:00:00.000Z';

// Aula toda terça e quinta, 19:00–21:00, a partir de 13/10.
const aula = (p: Partial<Evento> = {}): Evento => ({
  id: 'aula',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  titulo: 'Aula',
  inicio: iso('2026-10-13T19:00'),
  fim: iso('2026-10-13T21:00'),
  fixo: true,
  pessoaId: null,
  rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
  ...p,
});

/** Aplica o plano numa lista em memória, como faria o banco. */
function aplicar(eventos: Evento[], plano: PlanoSerie): Evento[] {
  let r = eventos.map((e) => {
    const m = plano.atualizar.find((a) => a.id === e.id);
    return m ? { ...e, ...m.mudancas } : e;
  });
  r = r.map((e) => (plano.excluir.includes(e.id) ? { ...e, excluidoEm: T } : e));
  return [...r, ...plano.criar.map((c) => ({ ...c, criadoEm: T, atualizadoEm: T, excluidoEm: null }))];
}

/** A agenda como o usuário vê: "dd HH:MM Título". */
const agenda = (eventos: Evento[]) =>
  expandirEventos(eventos, SP('2026-10-12T00:00'), SP('2026-11-02T00:00')).map((e) => {
    const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(e.inicio)).map((x) => [x.type, x.value]));
    return `${p.day} ${p.hour}:${p.minute} ${e.titulo}`;
  });

const ocorrenciaEm = (eventos: Evento[], dia: string): EventoNaAgenda =>
  expandirEventos(eventos, SP(`${dia}T00:00`), SP(`${dia}T23:59`))[0]!;

const ctx = (eventos: Evento[], dia: string): ContextoSerie => ({
  serie: eventos.find((e) => e.id === 'aula')!,
  ocorrencia: ocorrenciaEm(eventos, dia),
  eventos,
});

const mudar = (o: EventoNaAgenda, m: Partial<MudancasOcorrencia> = {}): MudancasOcorrencia => ({
  titulo: o.titulo,
  inicio: o.inicio,
  fim: o.fim,
  fixo: o.fixo,
  pessoaId: o.pessoaId,
  rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
  ...m,
});

const TODAS = ['13 19:00 Aula', '15 19:00 Aula', '20 19:00 Aula', '22 19:00 Aula', '27 19:00 Aula', '29 19:00 Aula'];

describe('só este', () => {
  it('editar cria uma ocorrência própria; editar de novo atualiza a mesma', () => {
    let ev = [aula()];
    let c = ctx(ev, '2026-10-15');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { inicio: iso('2026-10-15T20:00'), fim: iso('2026-10-15T22:00'), titulo: 'Aula (sala 2)' })));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '15 20:00 Aula (sala 2)', '20 19:00 Aula', '22 19:00 Aula', '27 19:00 Aula', '29 19:00 Aula']);

    c = ctx(ev, '2026-10-15');
    const plano = planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Aula (sala 3)' }));
    expect(plano.criar).toEqual([]);
    ev = aplicar(ev, plano);
    expect(agenda(ev)[1]).toBe('15 20:00 Aula (sala 3)');
  });

  it('excluir pula a ocorrência (EXDATE), inclusive se ela já tinha sido editada', () => {
    let ev = [aula()];
    ev = aplicar(ev, planoExcluir(ctx(ev, '2026-10-20'), 'este'));
    expect(ev[0]!.exdatas).toEqual([iso('2026-10-20T19:00')]);
    expect(agenda(ev)).toEqual(TODAS.filter((x) => !x.startsWith('20')));

    const c = ctx(ev, '2026-10-15');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Editada' })));
    ev = aplicar(ev, planoExcluir(ctx(ev, '2026-10-15'), 'este'));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '22 19:00 Aula', '27 19:00 Aula', '29 19:00 Aula']);
  });
});

describe('todos', () => {
  it('mudar o horário a partir de qualquer ocorrência move a série inteira, com exceções junto', () => {
    let ev = [aula({ exdatas: [iso('2026-10-20T19:00')] })];
    let c = ctx(ev, '2026-10-15');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Especial' })));

    c = ctx(ev, '2026-10-22');
    ev = aplicar(ev, planoEditar(c, 'todos', mudar(c.ocorrencia, { inicio: iso('2026-10-22T20:00'), fim: iso('2026-10-22T21:30') })));
    expect(agenda(ev)).toEqual(['13 20:00 Aula', '15 19:00 Especial', '22 20:00 Aula', '27 20:00 Aula', '29 20:00 Aula']);
    expect(ev.find((e) => e.id === 'aula')).toMatchObject({ inicio: iso('2026-10-13T20:00'), fim: iso('2026-10-13T21:30') });
  });

  it('mudar a regra descarta exceções e ocorrências editadas', () => {
    let ev = [aula({ exdatas: [iso('2026-10-20T19:00')] })];
    let c = ctx(ev, '2026-10-15');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Especial' })));
    c = ctx(ev, '2026-10-13');
    ev = aplicar(ev, planoEditar(c, 'todos', mudar(c.ocorrencia, { rrule: 'FREQ=WEEKLY;BYDAY=TU' })));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '20 19:00 Aula', '27 19:00 Aula']);
  });

  it('deixar de repetir vira evento único no horário editado', () => {
    let ev = [aula()];
    const c = ctx(ev, '2026-10-22');
    ev = aplicar(ev, planoEditar(c, 'todos', mudar(c.ocorrencia, { rrule: null })));
    expect(agenda(ev)).toEqual(['22 19:00 Aula']);
  });

  it('excluir todos remove a série e as ocorrências editadas', () => {
    let ev = [aula()];
    const c = ctx(ev, '2026-10-15');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Especial' })));
    ev = aplicar(ev, planoExcluir(ctx(ev, '2026-10-20'), 'todos'));
    expect(agenda(ev)).toEqual([]);
  });
});

describe('este e os seguintes', () => {
  it('divide a série: antes fica como estava, a partir daqui muda', () => {
    let ev = [aula()];
    const c = ctx(ev, '2026-10-22');
    ev = aplicar(ev, planoEditar(c, 'seguintes', mudar(c.ocorrencia, { titulo: 'Aula nova', inicio: iso('2026-10-22T18:00'), fim: iso('2026-10-22T20:00') })));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '15 19:00 Aula', '20 19:00 Aula', '22 18:00 Aula nova', '27 18:00 Aula nova', '29 18:00 Aula nova']);
    expect(ev.find((e) => e.id === 'aula')!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261022T215959Z');
  });

  it('divide o COUNT entre as duas séries', () => {
    let ev = [aula({ rrule: 'FREQ=WEEKLY;BYDAY=TU,TH;COUNT=6' })];
    const c = ctx(ev, '2026-10-22');
    ev = aplicar(ev, planoEditar(c, 'seguintes', mudar(c.ocorrencia, { rrule: 'FREQ=WEEKLY;BYDAY=TU,TH;COUNT=6', titulo: 'Nova' })));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '15 19:00 Aula', '20 19:00 Aula', '22 19:00 Nova', '27 19:00 Nova', '29 19:00 Nova']);
    expect(ev.find((e) => e.titulo === 'Nova')!.rrule).toBe('FREQ=WEEKLY;BYDAY=TU,TH;COUNT=3');
  });

  it('leva exceções futuras para a série nova; descarta a ocorrência editada no ponto da divisão', () => {
    let ev = [aula({ exdatas: [iso('2026-10-15T19:00'), iso('2026-10-29T19:00')] })];
    let c = ctx(ev, '2026-10-27');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Especial' })));
    c = ctx(ev, '2026-10-22');
    ev = aplicar(ev, planoEditar(c, 'seguintes', mudar(c.ocorrencia, { titulo: 'Nova' })));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '20 19:00 Aula', '22 19:00 Nova', '27 19:00 Especial']);
  });

  it('na primeira ocorrência equivale a "todos"', () => {
    let ev = [aula()];
    const c = ctx(ev, '2026-10-13');
    const plano = planoEditar(c, 'seguintes', mudar(c.ocorrencia, { titulo: 'Tudo' }));
    expect(plano.criar).toEqual([]);
    ev = aplicar(ev, plano);
    expect(agenda(ev)).toEqual(TODAS.map((x) => x.replace('Aula', 'Tudo')));
  });

  it('excluir a partir daqui encerra a série antes desta ocorrência', () => {
    let ev = [aula()];
    let c = ctx(ev, '2026-10-29');
    ev = aplicar(ev, planoEditar(c, 'este', mudar(c.ocorrencia, { titulo: 'Especial' })));
    ev = aplicar(ev, planoExcluir(ctx(ev, '2026-10-22'), 'seguintes'));
    expect(agenda(ev)).toEqual(['13 19:00 Aula', '15 19:00 Aula', '20 19:00 Aula']);
  });
});

describe('escoposPermitidos', () => {
  it('"só este" some quando a regra muda', () => {
    const ev = [aula()];
    expect(escoposPermitidos(ctx(ev, '2026-10-15'), 'FREQ=WEEKLY;BYDAY=TU,TH')).toEqual(['este', 'seguintes', 'todos']);
    expect(escoposPermitidos(ctx(ev, '2026-10-15'), 'FREQ=DAILY')).toEqual(['seguintes', 'todos']);
  });
});
