import { ativo, type Adiamento, type Atividade, type Evento, type Pessoa, type Sessao } from '../model';
import { expandirEventos, type EventoNaAgenda } from '../calendario/eventos';
import { CALENDARIO_PADRAO, diasEntre, FUSO_PADRAO, inicioDoDia, inicioDoDiaApos, type Calendario } from '../time';
import { estaAdiado } from './adiamento';
import { limiteEfetivo, ultimaSessao } from './atraso';
import { contatoPendente, diasSemContato } from './contato';
import { progressoSemanal, type ProgressoSemanal } from './metaSemanal';

export type ItemHoje =
  | {
      tipo: 'atividade';
      atividade: Atividade;
      /** Nunca teve sessão registrada: card "Ainda não praticou". */
      nuncaPraticada: boolean;
      /** Preenchido quando passou do limite efetivo de dias. */
      diasSemSessao: number | null;
      /** Preenchido quando a meta semanal pede atenção. */
      progresso: ProgressoSemanal | null;
      urgencia: number;
    }
  | { tipo: 'pessoa'; pessoa: Pessoa; diasSemContato: number; urgencia: number };

export interface DadosHoje {
  atividades: readonly Atividade[];
  sessoes: readonly Sessao[];
  pessoas: readonly Pessoa[];
  adiamentos: readonly Adiamento[];
}

const nomeDoItem = (i: ItemHoje) => (i.tipo === 'atividade' ? i.atividade.nome : i.pessoa.nome);

/**
 * Só o que pede atenção agora, do mais urgente para o menos.
 * Uma atividade só deixa de aparecer se estiver pausada, adiada ou já feita hoje.
 */
export function itensDeAtencao(dados: DadosHoje, agora: Date, cal: Calendario = CALENDARIO_PADRAO): ItemHoje[] {
  const itens: ItemHoje[] = [];

  for (const atividade of dados.atividades) {
    if (!ativo(atividade) || atividade.pausada) continue;
    if (estaAdiado('atividade', atividade.id, dados.adiamentos, agora)) continue;

    const ultima = ultimaSessao(atividade.id, dados.sessoes, agora);
    const dias = ultima ? diasEntre(new Date(ultima.inicio), agora, cal.fuso) : null;
    // Já feita hoje: não há mais nada a pedir hoje, mesmo que a meta da semana esteja apertada.
    if (dias === 0) continue;

    const nuncaPraticada = dias === null;
    const limite = limiteEfetivo(atividade);
    const parada = dias !== null && dias > limite;
    const progresso = progressoSemanal(atividade, dados.sessoes, agora, cal);
    if (!nuncaPraticada && !parada && !progresso.atrasada) continue;

    const urgencia = Math.max(
      nuncaPraticada ? 1 : 0,
      parada ? dias / limite : 0,
      progresso.atrasada ? 1 + (progresso.meta - progresso.feitas) / Math.max(progresso.diasRestantes, 1) : 0,
    );
    itens.push({
      tipo: 'atividade',
      atividade,
      nuncaPraticada,
      diasSemSessao: parada ? dias : null,
      progresso: progresso.atrasada ? progresso : null,
      urgencia,
    });
  }

  for (const pessoa of dados.pessoas) {
    if (!ativo(pessoa) || !contatoPendente(pessoa, agora, cal.fuso)) continue;
    if (estaAdiado('pessoa', pessoa.id, dados.adiamentos, agora)) continue;
    const dias = diasSemContato(pessoa, agora, cal.fuso);
    itens.push({ tipo: 'pessoa', pessoa, diasSemContato: dias, urgencia: dias / pessoa.frequenciaDias });
  }

  return itens.sort((a, b) => b.urgencia - a.urgencia || nomeDoItem(a).localeCompare(nomeDoItem(b), 'pt-BR'));
}

/** Eventos que tocam o dia de `agora`. Recorrência entra na etapa 3. */
/** Ocorrências de eventos (inclusive de séries) que tocam o dia de `agora`. */
export function eventosDoDia(eventos: readonly Evento[], agora: Date, fuso = FUSO_PADRAO): EventoNaAgenda[] {
  return expandirEventos(eventos, inicioDoDia(agora, fuso), inicioDoDiaApos(agora, 1, fuso), fuso);
}
