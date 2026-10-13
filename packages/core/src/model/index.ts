/** Instante em ISO 8601 UTC, ex.: "2026-10-13T21:00:00.000Z". */
export type ISODateTime = string;
/** Data de calendário sem hora, ex.: "2026-10-13". */
export type ISODate = string;

/** Campos comuns a todo registro, já pensados para a sincronização last-write-wins. */
export interface Registro {
  id: string;
  criadoEm: ISODateTime;
  atualizadoEm: ISODateTime;
  /** Exclusão lógica: o registro some da interface mas continua existindo para sincronizar. */
  excluidoEm: ISODateTime | null;
}

export type Categoria = 'hobby' | 'estudo' | 'lazer';
export const CATEGORIAS: readonly Categoria[] = ['hobby', 'estudo', 'lazer'];
export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  hobby: 'Hobby',
  estudo: 'Estudo',
  lazer: 'Lazer',
};

export interface Atividade extends Registro {
  nome: string;
  categoria: Categoria;
  duracaoPadraoMin: number;
  /** Vezes por semana; 0 = sem meta. */
  metaSemanal: number;
  cor: string;
  pausada: boolean;
  /** Avisar quando passar deste número de dias sem sessão; null = padrão derivado da meta. */
  limiteDias: number | null;
}

export type OrigemSessao = 'planejada' | 'registrada';

export interface Sessao extends Registro {
  atividadeId: string;
  inicio: ISODateTime;
  fim: ISODateTime;
  origem: OrigemSessao;
}

export interface Pessoa extends Registro {
  nome: string;
  /** Falar a cada N dias; 0 = sem lembrete. */
  frequenciaDias: number;
  ultimoContato: ISODateTime | null;
  notas: string;
  pausada: boolean;
}

export interface Evento extends Registro {
  titulo: string;
  inicio: ISODateTime;
  fim: ISODateTime;
  fixo: boolean;
  pessoaId: string | null;
  /** Regra de recorrência RFC 5545 (ex.: "FREQ=WEEKLY;BYDAY=MO,WE"); null = evento único. */
  rrule: string | null;
}

export type AlvoAdiamento = 'atividade' | 'pessoa';

export interface Adiamento extends Registro {
  alvoTipo: AlvoAdiamento;
  alvoId: string;
  /** O item volta a aparecer em "Hoje" a partir deste instante. */
  ate: ISODateTime;
}

/** 0 = domingo … 6 = sábado (convenção do date-fns). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Preferências que afetam as regras; registro único, sincronizável como os demais. */
export interface Preferencias extends Registro {
  inicioSemana: DiaSemana;
}

export const ID_PREFERENCIAS = 'preferencias';

/** Id determinístico: um adiamento por alvo, o que simplifica o upsert e a sincronização. */
export const idAdiamento = (alvoTipo: AlvoAdiamento, alvoId: string) => `${alvoTipo}:${alvoId}`;

export const ativo = <T extends Registro>(r: T) => !r.excluidoEm;
