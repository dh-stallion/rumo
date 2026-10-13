import { z } from 'zod';
import {
  CATEGORIAS,
  type Adiamento,
  type Atividade,
  type Evento,
  type ISODateTime,
  type Pessoa,
  type Preferencias,
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

const sessao: z.ZodType<Sessao> = z.object({
  ...registro,
  atividadeId: z.string().min(1),
  inicio: instante,
  fim: instante,
  origem: z.enum(['planejada', 'registrada']),
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
});

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
  };
}
