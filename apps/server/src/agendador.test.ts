import { describe, expect, it } from 'vitest';
import { executarLembretes } from './agendador';
import { Banco } from './banco';
import { atividade, evento, inscricao, pushFalso } from './teste/apoio';

const FUSO = 'America/Sao_Paulo';
const SP = (s: string) => new Date(`${s}-03:00`);
const T = '2026-10-14T12:00:00.000Z';

function banco() {
  const b = new Banco();
  b.aplicar({
    atividades: [atividade({ criadoEm: T, atualizadoEm: T })],
    eventos: [evento({ inicio: SP('2026-10-14T15:00').toISOString(), fim: SP('2026-10-14T16:00').toISOString() })],
    pessoas: [{ id: 'p1', criadoEm: T, atualizadoEm: T, excluidoEm: null, nome: 'Ana', frequenciaDias: 7, ultimoContato: SP('2026-10-01T10:00').toISOString(), notas: '', pausada: false }],
  });
  return b;
}

describe('agendador de lembretes', () => {
  it('sem aparelhos inscritos, não envia nem marca nada', async () => {
    const b = banco();
    const { push, enviados } = pushFalso();
    expect(await executarLembretes(b, push, SP('2026-10-14T08:00'), FUSO)).toEqual([]);
    expect(enviados).toEqual([]);
    expect(b.enviados(SP('2026-10-14T08:00')).size).toBe(0);
  });

  it('envia para todos os aparelhos, uma vez só', async () => {
    const b = banco();
    b.salvarInscricao(inscricao(1));
    b.salvarInscricao(inscricao(2));
    const { push, enviados } = pushFalso();
    const primeira = await executarLembretes(b, push, SP('2026-10-14T08:00'), FUSO);
    expect(primeira.map((l) => l.chave)).toEqual(['resumo:2026-10-14', `contato:p1:${SP('2026-10-01T10:00').toISOString()}`]);
    expect(enviados).toHaveLength(4);
    expect(enviados[0]!.mensagem).toMatchObject({ titulo: 'Seu dia', url: '/', tag: 'resumo:2026-10-14' });
    expect(await executarLembretes(b, push, SP('2026-10-14T08:01'), FUSO)).toEqual([]);
  });

  it('aviso antes do compromisso fixo, na antecedência das preferências sincronizadas', async () => {
    const b = banco();
    b.salvarInscricao(inscricao());
    b.aplicar({
      preferencias: [
        {
          id: 'preferencias',
          criadoEm: T,
          atualizadoEm: T,
          excluidoEm: null,
          inicioSemana: 1,
          convitePlanejar: true,
          semanaConviteTratada: null,
          notificacoes: { resumo: false, horaResumo: '08:00', eventos: true, minutosAntes: 30, contatos: false },
        },
      ],
    });
    const { push, enviados } = pushFalso();
    expect(await executarLembretes(b, push, SP('2026-10-14T14:20'), FUSO)).toEqual([]);
    const l = await executarLembretes(b, push, SP('2026-10-14T14:35'), FUSO);
    expect(l.map((x) => x.corpo)).toEqual(['Às 15:00 (em 25 minutos)']);
    expect(enviados).toHaveLength(1);
  });

  it('apaga inscrições canceladas e não marca como enviado se nada chegou', async () => {
    const b = banco();
    b.salvarInscricao(inscricao(1));
    const { push } = pushFalso(() => 'expirada');
    expect(await executarLembretes(b, push, SP('2026-10-14T08:00'), FUSO)).toEqual([]);
    expect(b.inscricoes()).toEqual([]);
    expect(b.enviados(SP('2026-10-14T08:00')).size).toBe(0);
  });

  it('falha temporária tenta de novo na rodada seguinte', async () => {
    const b = banco();
    b.salvarInscricao(inscricao(1));
    let falhar = true;
    const { push, enviados } = pushFalso(() => (falhar ? 'erro' : 'ok'));
    expect(await executarLembretes(b, push, SP('2026-10-14T08:00'), FUSO)).toEqual([]);
    falhar = false;
    expect((await executarLembretes(b, push, SP('2026-10-14T08:01'), FUSO)).length).toBe(2);
    expect(enviados).toHaveLength(2);
  });
});
