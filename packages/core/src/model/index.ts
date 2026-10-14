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
  /** Atividade praticada; null quando a sessão é de uma ação de projeto. */
  atividadeId: string | null;
  /** Ação de projeto agendada na grade; null quando a sessão é de uma atividade. */
  acao: { projetoId: string; acaoId: string } | null;
  inicio: ISODateTime;
  fim: ISODateTime;
  origem: OrigemSessao;
}

export interface Marco {
  id: string;
  titulo: string;
  data: ISODate | null;
  concluido: boolean;
}

/** Próxima ação de um projeto; pode virar sessão na grade semanal. */
export interface AcaoProjeto {
  id: string;
  titulo: string;
  duracaoMin: number;
  concluida: boolean;
}

/** Item com preço (ex.: componentes de um NAS). */
export interface ItemProjeto {
  id: string;
  nome: string;
  precoCentavos: number;
  comprado: boolean;
}

/** Projeto de longo prazo. Marcos, ações e itens vivem dentro do registro (uso pessoal). */
export interface Projeto extends Registro {
  nome: string;
  descricao: string;
  cor: string;
  arquivado: boolean;
  marcos: Marco[];
  acoes: AcaoProjeto[];
  itens: ItemProjeto[];
}

export interface Aporte {
  id: string;
  data: ISODate;
  /** Negativo para retirada. */
  valorCentavos: number;
  nota: string;
}

/** Meta financeira, sempre em reais (centavos inteiros). */
export interface MetaFinanceira extends Registro {
  nome: string;
  /** null = usar a soma dos itens do projeto ligado. */
  valorAlvoCentavos: number | null;
  prazo: ISODate;
  /** Quanto já havia guardado ao criar a meta. */
  saldoInicialCentavos: number;
  aportes: Aporte[];
  projetoId: string | null;
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
  /** Inícios de ocorrências puladas da série (EXDATE). */
  exdatas: ISODateTime[];
  /**
   * Ocorrência editada isoladamente ("só este"): id da série e início original da
   * ocorrência que este evento substitui (RECURRENCE-ID no iCalendar).
   */
  serieId: string | null;
  ocorrenciaOriginal: ISODateTime | null;
}

/** Campos de recorrência de um evento único, para criação. */
export const semRecorrencia = (): Pick<Evento, 'rrule' | 'exdatas' | 'serieId' | 'ocorrenciaOriginal'> => ({
  rrule: null,
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
});

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
  /** Mostrar em "Hoje" o convite "Semana nova: planejar?". */
  convitePlanejar: boolean;
  /** Semana (data local do 1º dia) em que o convite já foi dispensado ou aceito. */
  semanaConviteTratada: ISODate | null;
}

export const ID_PREFERENCIAS = 'preferencias';

/** Valores usados quando ainda não há preferências salvas (ou faltam campos de versões antigas). */
export const PREFERENCIAS_PADRAO: Pick<Preferencias, 'inicioSemana' | 'convitePlanejar' | 'semanaConviteTratada'> = {
  inicioSemana: 1,
  convitePlanejar: true,
  semanaConviteTratada: null,
};

/** Id determinístico: um adiamento por alvo, o que simplifica o upsert e a sincronização. */
export const idAdiamento = (alvoTipo: AlvoAdiamento, alvoId: string) => `${alvoTipo}:${alvoId}`;

export const ativo = <T extends Registro>(r: T) => !r.excluidoEm;
