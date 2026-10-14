import { describe, expect, it } from 'vitest';
import type { Evento } from '../model';
import { atividade, pessoa, sessao, SP } from '../test/fabricas';
import { gerarICS, lerICS } from './ics';
import { planoImportacao } from './importacao';

const iso = (s: string) => SP(s).toISOString();
const T = '2026-10-01T15:00:00.000Z';
const ev = (p: Partial<Evento> & Pick<Evento, 'id' | 'titulo' | 'inicio' | 'fim'>): Evento => ({
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

const aula = ev({ id: 'aula', titulo: 'Aula', inicio: iso('2026-10-13T19:00'), fim: iso('2026-10-13T21:00'), rrule: 'FREQ=WEEKLY;BYDAY=TU' });
const dentista = ev({ id: 'dentista', titulo: 'Dentista', inicio: iso('2026-10-14T15:00'), fim: iso('2026-10-14T16:00'), pessoaId: 'p1' });
const ana = pessoa({ id: 'p1', nome: 'Ana' });

describe('planoImportacao', () => {
  const ics = gerarICS({
    eventos: [aula, dentista],
    pessoas: [ana],
    sessoes: [sessao(SP('2026-10-16T08:00'), { origem: 'planejada' })],
    atividades: [atividade({ id: 'a1' })],
  });
  const { eventos: lidos } = lerICS(ics);

  it('num aparelho vazio, tudo é novo; sessões de atividades ficam de fora', () => {
    const p = planoImportacao(lidos, [], [ana]);
    expect(p.novos.map((e) => e.id).sort()).toEqual(['aula', 'dentista']);
    expect(p.atualizar).toEqual([]);
    expect(p.sessoesIgnoradas).toBe(1);
    expect(p.series).toBe(1);
  });

  it('"Com Ana" volta a ligar o evento à pessoa de mesmo nome', () => {
    expect(planoImportacao(lidos, [], [ana]).novos.find((e) => e.id === 'dentista')!.pessoaId).toBe('p1');
    expect(planoImportacao(lidos, [], []).novos.find((e) => e.id === 'dentista')!.pessoaId).toBeNull();
  });

  it('reimportar o próprio arquivo atualiza em vez de duplicar (inclusive excluídos)', () => {
    const p = planoImportacao(lidos, [aula, { ...dentista, excluidoEm: T }], [ana]);
    expect(p.novos).toEqual([]);
    expect(p.atualizar.map((e) => e.id).sort()).toEqual(['aula', 'dentista']);
  });

  it('o mesmo UID repetido no arquivo conta uma vez (o último vence)', () => {
    const dobrado = lerICS(gerarICS({ eventos: [dentista] }) + gerarICS({ eventos: [{ ...dentista, titulo: 'Dentista (remarcado)' }] })).eventos;
    const p = planoImportacao(dobrado, []);
    expect(p.novos.map((e) => e.titulo)).toEqual(['Dentista (remarcado)']);
  });
});
