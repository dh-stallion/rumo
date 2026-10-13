import type { Adiamento, Atividade, Evento, Pessoa, Sessao } from '@rumo/core';
import Dexie, { type Table } from 'dexie';

export class RumoDB extends Dexie {
  atividades!: Table<Atividade, string>;
  sessoes!: Table<Sessao, string>;
  pessoas!: Table<Pessoa, string>;
  eventos!: Table<Evento, string>;
  adiamentos!: Table<Adiamento, string>;

  constructor() {
    super('rumo');
    // Só campos consultados viram índice; `atualizadoEm` serve à sincronização da etapa 5.
    this.version(1).stores({
      atividades: 'id, atualizadoEm',
      sessoes: 'id, atividadeId, inicio, atualizadoEm',
      pessoas: 'id, atualizadoEm',
      eventos: 'id, inicio, atualizadoEm',
      adiamentos: 'id, atualizadoEm',
    });
  }
}

export const db = new RumoDB();
