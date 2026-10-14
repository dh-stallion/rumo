import {
  PREFERENCIAS_PADRAO,
  type Adiamento,
  type Atividade,
  type Evento,
  type MetaFinanceira,
  type Pessoa,
  type Preferencias,
  type Projeto,
  type Sessao,
} from '@rumo/core';
import Dexie, { type Table } from 'dexie';

export class RumoDB extends Dexie {
  atividades!: Table<Atividade, string>;
  sessoes!: Table<Sessao, string>;
  pessoas!: Table<Pessoa, string>;
  eventos!: Table<Evento, string>;
  adiamentos!: Table<Adiamento, string>;
  preferencias!: Table<Preferencias, string>;
  projetos!: Table<Projeto, string>;
  metas!: Table<MetaFinanceira, string>;

  constructor(nome = 'rumo') {
    super(nome);
    // Só campos consultados viram índice; `atualizadoEm` serve à sincronização da etapa 5.
    this.version(1).stores({
      atividades: 'id, atualizadoEm',
      sessoes: 'id, atividadeId, inicio, atualizadoEm',
      pessoas: 'id, atualizadoEm',
      eventos: 'id, inicio, atualizadoEm',
      adiamentos: 'id, atualizadoEm',
    });
    this.version(2).stores({ preferencias: 'id, atualizadoEm' });
    // v3: convite semanal; preenche os campos novos nas preferências já salvas.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Preferencias>('preferencias')
          .toCollection()
          .modify((p) => {
            p.convitePlanejar ??= PREFERENCIAS_PADRAO.convitePlanejar;
            p.semanaConviteTratada ??= PREFERENCIAS_PADRAO.semanaConviteTratada;
          }),
      );
    // v4: recorrência com exceções (EXDATE e ocorrências editadas).
    this.version(4)
      .stores({ eventos: 'id, inicio, serieId, atualizadoEm' })
      .upgrade((tx) =>
        tx
          .table<Evento>('eventos')
          .toCollection()
          .modify((e) => {
            e.exdatas ??= [];
            e.serieId ??= null;
            e.ocorrenciaOriginal ??= null;
          }),
      );
    // v5: projetos e metas financeiras; sessão pode ser de uma ação de projeto.
    this.version(5)
      .stores({ projetos: 'id, atualizadoEm', metas: 'id, projetoId, atualizadoEm' })
      .upgrade((tx) =>
        tx
          .table<Sessao>('sessoes')
          .toCollection()
          .modify((s) => {
            s.acao ??= null;
          }),
      );
    // v6: preferências de notificação (lembretes enviados pelo servidor).
    this.version(6)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Preferencias>('preferencias')
          .toCollection()
          .modify((p) => {
            p.notificacoes ??= PREFERENCIAS_PADRAO.notificacoes;
          }),
      );
  }
}

export const db = new RumoDB();
