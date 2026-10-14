import { z } from 'zod';
import {
  CATEGORIAS,
  PREFERENCIAS_PADRAO,
  type Adiamento,
  type Atividade,
  type Evento,
  type MetaFinanceira,
  type ISODateTime,
  type Pessoa,
  type Preferencias,
  type Projeto,
  type Sessao,
} from './model';

export const FORMATO_BACKUP = 'rumo-backup';
export const VERSAO_BACKUP = 1;

/** Todas as tabelas, inclusive registros excluídos (para não perder tombstones de sincronização). */
export interface TabelasBackup {
  atividades: Atividade[];
  sessoes: Sessao[];
  pessoas: Pessoa[];
  eventos: Evento[];
  adiamentos: Adiamento[];
  preferencias: Preferencias[];
  projetos: Projeto[];
  metas: MetaFinanceira[];
}

export interface Backup {
  formato: typeof FORMATO_BACKUP;
  versao: typeof VERSAO_BACKUP;
  exportadoEm: ISODateTime;
  tabelas: TabelasBackup;
}

export const TABELAS_BACKUP = [
  'atividades',
  'sessoes',
  'pessoas',
  'eventos',
  'adiamentos',
  'preferencias',
  'projetos',
  'metas',
] as const satisfies readonly (keyof TabelasBackup)[];

// Os esquemas são anotados com o tipo do modelo: se um mudar sem o outro, o compilador acusa.
const instante = z.iso.datetime();
const registro = {
  id: z.string().min(1),
  criadoEm: instante,
  atualizadoEm: instante,
  excluidoEm: instante.nullable(),
};

const atividade: z.ZodType<Atividade> = z.object({
  ...registro,
  nome: z.string(),
  categoria: z.enum(CATEGORIAS as [Atividade['categoria'], ...Atividade['categoria'][]]),
  duracaoPadraoMin: z.number().int().positive(),
  metaSemanal: z.number().int().min(0),
  cor: z.string(),
  pausada: z.boolean(),
  limiteDias: z.number().int().positive().nullable(),
});

const sessao: z.ZodType<Sessao> = z
  .object({
    ...registro,
    atividadeId: z.string().min(1).nullable(),
    // Posterior à versão 1 do formato: backups antigos recebem o padrão.
    acao: z.object({ projetoId: z.string().min(1), acaoId: z.string().min(1) }).nullable().default(null),
    inicio: instante,
    fim: instante,
    origem: z.enum(['planejada', 'registrada']),
  })
  .refine((s) => s.atividadeId !== null || s.acao !== null, { message: 'sessão sem atividade nem ação', path: ['atividadeId'] });

const data = z.iso.date();

const projeto: z.ZodType<Projeto> = z.object({
  ...registro,
  nome: z.string(),
  descricao: z.string(),
  cor: z.string(),
  arquivado: z.boolean(),
  marcos: z.array(z.object({ id: z.string().min(1), titulo: z.string(), data: data.nullable(), concluido: z.boolean() })),
  acoes: z.array(z.object({ id: z.string().min(1), titulo: z.string(), duracaoMin: z.number().int().positive(), concluida: z.boolean() })),
  itens: z.array(z.object({ id: z.string().min(1), nome: z.string(), precoCentavos: z.number().int().min(0), comprado: z.boolean() })),
});

const meta: z.ZodType<MetaFinanceira> = z.object({
  ...registro,
  nome: z.string(),
  valorAlvoCentavos: z.number().int().min(0).nullable(),
  prazo: data,
  saldoInicialCentavos: z.number().int(),
  aportes: z.array(z.object({ id: z.string().min(1), data, valorCentavos: z.number().int(), nota: z.string() })),
  projetoId: z.string().nullable(),
});

const pessoa: z.ZodType<Pessoa> = z.object({
  ...registro,
  nome: z.string(),
  frequenciaDias: z.number().int().min(0),
  ultimoContato: instante.nullable(),
  notas: z.string(),
  pausada: z.boolean(),
});

const evento: z.ZodType<Evento> = z.object({
  ...registro,
  titulo: z.string(),
  inicio: instante,
  fim: instante,
  fixo: z.boolean(),
  pessoaId: z.string().nullable(),
  rrule: z.string().nullable(),
  // Campos posteriores à versão 1 do formato: backups antigos recebem o padrão.
  exdatas: z.array(instante).default([]),
  serieId: z.string().nullable().default(null),
  ocorrenciaOriginal: instante.nullable().default(null),
});

const adiamento: z.ZodType<Adiamento> = z.object({
  ...registro,
  alvoTipo: z.enum(['atividade', 'pessoa']),
  alvoId: z.string().min(1),
  ate: instante,
});

const preferencias: z.ZodType<Preferencias> = z.object({
  ...registro,
  inicioSemana: z.literal([0, 1, 2, 3, 4, 5, 6]),
  // Campos posteriores à versão 1 do formato: backups antigos recebem o padrão.
  convitePlanejar: z.boolean().default(PREFERENCIAS_PADRAO.convitePlanejar),
  semanaConviteTratada: z.iso.date().nullable().default(PREFERENCIAS_PADRAO.semanaConviteTratada),
  notificacoes: z
    .object({
      resumo: z.boolean(),
      horaResumo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      eventos: z.boolean(),
      minutosAntes: z.number().int().min(0).max(24 * 60),
      contatos: z.boolean(),
    })
    .default(PREFERENCIAS_PADRAO.notificacoes),
});

/** Esquema de cada tabela, para validar registros soltos (ex.: recebidos na sincronização). */
const ESQUEMAS_REGISTRO = { atividades: atividade, sessoes: sessao, pessoas: pessoa, eventos: evento, adiamentos: adiamento, preferencias, projetos: projeto, metas: meta } satisfies Record<
  TabelaBackup,
  z.ZodType
>;

export type TabelaBackup = (typeof TABELAS_BACKUP)[number];

export type ResultadoRegistro<T extends TabelaBackup> = { ok: true; registro: TabelasBackup[T][number] } | { ok: false; erro: string };

/** Valida um registro de uma tabela; a mensagem segue o mesmo formato da validação do backup. */
export function validarRegistro<T extends TabelaBackup>(tabela: T, dado: unknown): ResultadoRegistro<T> {
  const r = ESQUEMAS_REGISTRO[tabela].safeParse(dado, { reportInput: true });
  if (r.success) return { ok: true, registro: r.data as TabelasBackup[T][number] };
  const i = r.error.issues[0]!;
  const motivo = i.input === undefined ? 'ausente' : i.code === 'invalid_format' ? 'formato inválido' : 'valor inválido';
  return { ok: false, erro: `campo "${i.path.join('.') || '(registro)'}": ${motivo}` };
}

const esquemaBackup: z.ZodType<Backup> = z.object({
  formato: z.literal(FORMATO_BACKUP),
  versao: z.literal(VERSAO_BACKUP),
  exportadoEm: instante,
  tabelas: z.object({
    atividades: z.array(atividade),
    sessoes: z.array(sessao),
    pessoas: z.array(pessoa),
    eventos: z.array(evento),
    adiamentos: z.array(adiamento),
    preferencias: z.array(preferencias),
    // Tabelas posteriores à versão 1 do formato.
    projetos: z.array(projeto).default([]),
    metas: z.array(meta).default([]),
  }),
});

export function criarBackup(tabelas: TabelasBackup, agora = new Date()): Backup {
  return { formato: FORMATO_BACKUP, versao: VERSAO_BACKUP, exportadoEm: agora.toISOString(), tabelas };
}

export type ResultadoValidacao = { ok: true; backup: Backup } | { ok: false; erros: string[] };

const NOMES: Record<string, string> = {
  atividades: 'atividade',
  sessoes: 'sessão',
  pessoas: 'pessoa',
  eventos: 'evento',
  adiamentos: 'adiamento',
  preferencias: 'preferências',
  projetos: 'projeto',
  metas: 'meta',
};

function descreverCaminho(caminho: PropertyKey[]): string {
  if (caminho[0] === 'tabelas' && typeof caminho[1] === 'string') {
    const [, tabela, indice, ...resto] = caminho;
    const item = typeof indice === 'number' ? `${NOMES[tabela] ?? tabela} nº ${indice + 1}` : `tabela "${tabela}"`;
    return resto.length ? `${item}, campo "${resto.join('.')}"` : item;
  }
  return caminho.length ? `campo "${caminho.join('.')}"` : 'arquivo';
}

/** Valida um JSON já lido (texto → JSON.parse) e explica, em português, o que está errado. */
export function validarBackup(json: unknown): ResultadoValidacao {
  if (typeof json !== 'object' || json === null || (json as { formato?: unknown }).formato !== FORMATO_BACKUP) {
    return { ok: false, erros: ['Este arquivo não é um backup do Rumo.'] };
  }
  const versao = (json as { versao?: unknown }).versao;
  if (versao !== VERSAO_BACKUP) {
    return {
      ok: false,
      erros: [`Versão de backup não suportada (${String(versao)}). Esta versão do app lê a versão ${VERSAO_BACKUP}.`],
    };
  }

  // reportInput: sem ele o zod não informa o valor recebido, e não dá para distinguir "ausente" de "errado".
  const r = esquemaBackup.safeParse(json, { reportInput: true });
  if (!r.success) {
    const erros = r.error.issues.map((i) => {
      const motivo = i.input === undefined ? 'ausente' : i.code === 'invalid_format' ? 'formato inválido' : 'valor inválido';
      return `${descreverCaminho(i.path)}: ${motivo}`;
    });
    return { ok: false, erros };
  }

  const erros: string[] = [];
  for (const tabela of TABELAS_BACKUP) {
    const vistos = new Set<string>();
    for (const { id } of r.data.tabelas[tabela]) {
      if (vistos.has(id)) erros.push(`tabela "${tabela}": id repetido (${id})`);
      vistos.add(id);
    }
  }
  return erros.length ? { ok: false, erros } : { ok: true, backup: r.data };
}

/** Quantos registros visíveis (não excluídos) há em cada tabela. */
export function contarRegistros(tabelas: TabelasBackup) {
  const ativos = (t: { excluidoEm: string | null }[]) => t.filter((r) => !r.excluidoEm).length;
  return {
    atividades: ativos(tabelas.atividades),
    sessoes: ativos(tabelas.sessoes),
    pessoas: ativos(tabelas.pessoas),
    eventos: ativos(tabelas.eventos),
    projetos: ativos(tabelas.projetos),
    metas: ativos(tabelas.metas),
  };
}
