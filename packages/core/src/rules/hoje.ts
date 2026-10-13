import { ativo, type Adiamento, type Atividade, type Evento, type Pessoa, type Sessao } from '../model';
import { diasEntre, fimDoDia, FUSO_PADRAO, inicioDoDia } from '../time';
import { estaAdiado } from './adiamento';
import { diasSemSessao, estaParada, ultimaSessao } from './atraso';
import { contatoPendente, diasSemContato } from './contato';
import { progressoSemanal, type ProgressoSemanal } from './metaSemanal';

export type ItemHoje =
  | {
      tipo: 'atividade';
      atividade: Atividade;
      /** Preenchido quando passou do limite de dias. */
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

/** Só o que pede atenção agora, do mais urgente para o menos. */
export function itensDeAtencao(dados: DadosHoje, agora: Date, fuso = FUSO_PADRAO): ItemHoje[] {
  const itens: ItemHoje[] = [];

  for (const atividade of dados.atividades) {
    if (!ativo(atividade) || atividade.pausada) continue;
    if (estaAdiado('atividade', atividade.id, dados.adiamentos, agora)) continue;
    // Já feita hoje: não há mais nada a pedir hoje, mesmo que a meta da semana esteja apertada.
    const ultima = ultimaSessao(atividade.id, dados.sessoes, agora);
    if (ultima && diasEntre(new Date(ultima.inicio), agora, fuso) === 0) continue;
    const parada = estaParada(atividade, dados.sessoes, agora, fuso);
    const progresso = progressoSemanal(atividade, dados.sessoes, agora, fuso);
    if (!parada && !progresso.atrasada) continue;
    const dias = parada ? diasSemSessao(atividade, dados.sessoes, agora, fuso) : null;
    const urgencia = Math.max(
      dias !== null ? dias / atividade.limiteDias! : 0,
      progresso.atrasada
        ? 1 + (progresso.meta - progresso.feitas) / Math.max(progresso.diasRestantes, 1)
        : 0,
    );
    itens.push({
      tipo: 'atividade',
      atividade,
      diasSemSessao: dias,
      progresso: progresso.atrasada ? progresso : null,
      urgencia,
    });
  }

  for (const pessoa of dados.pessoas) {
    if (!ativo(pessoa) || !contatoPendente(pessoa, agora, fuso)) continue;
    if (estaAdiado('pessoa', pessoa.id, dados.adiamentos, agora)) continue;
    const dias = diasSemContato(pessoa, agora, fuso);
    itens.push({ tipo: 'pessoa', pessoa, diasSemContato: dias, urgencia: dias / pessoa.frequenciaDias });
  }

  return itens.sort((a, b) => b.urgencia - a.urgencia);
}

/** Eventos que tocam o dia de `agora`. Recorrência entra na etapa 3. */
export function eventosDoDia(eventos: readonly Evento[], agora: Date, fuso = FUSO_PADRAO): Evento[] {
  const ini = inicioDoDia(agora, fuso);
  const fim = fimDoDia(agora, fuso);
  return eventos
    .filter((e) => ativo(e) && new Date(e.inicio) <= fim && new Date(e.fim) >= ini)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
