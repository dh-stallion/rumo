import {
  PREFERENCIAS_PADRAO,
  type Adiamento,
  type Atividade,
  type Evento,
  type Pessoa,
  type Preferencias,
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
  }
}

export const db = new RumoDB();
