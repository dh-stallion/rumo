import { TZDate, tz } from '@date-fns/tz';
import { format } from 'date-fns';
import { ativo, type Atividade, type Evento, type ISODateTime, type Pessoa, type Sessao } from '../model';
import { FUSO_PADRAO } from '../time';
import { lerRRule } from './recorrencia';

/**
 * iCalendar (RFC 5545) para exportar, para o feed assinável (etapa 5) e para o CalDAV.
 * Horários vão com TZID=America/Sao_Paulo, para séries manterem a hora local.
 */

const DOMINIO_UID = 'rumo';
const CRLF = '\r\n';

export interface DadosICS {
  eventos: readonly Evento[];
  /** Sessões planejadas entram como eventos da categoria "Atividade". */
  sessoes?: readonly Sessao[];
  atividades?: readonly Atividade[];
  pessoas?: readonly Pessoa[];
}

export interface OpcoesICS {
  nome?: string;
  agora?: Date;
  fuso?: string;
  /** Feed assinável: sugere ao cliente atualizar a cada hora. */
  feed?: boolean;
}

// ——— Escrita ———

export const escaparTexto = (t: string) =>
  t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Dobra linhas em 75 octetos (UTF-8), sem partir caracteres; continuação começa com espaço. */
export function dobrar(linha: string): string {
  const cod = new TextEncoder();
  const partes: string[] = [];
  let atual = '';
  let bytes = 0;
  for (const ch of linha) {
    const n = cod.encode(ch).length;
    const limite = partes.length === 0 ? 75 : 74; // a continuação já gasta 1 octeto no espaço
    if (bytes + n > limite) {
      partes.push(atual);
      atual = '';
      bytes = 0;
    }
    atual += ch;
    bytes += n;
  }
  partes.push(atual);
  return partes.join(`${CRLF} `);
}

const utc = (iso: string | Date) => format(new Date(iso), "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') });
const local = (iso: string, fuso: string) => format(new Date(iso), "yyyyMMdd'T'HHmmss", { in: tz(fuso) });
const comFuso = (prop: string, iso: string, fuso: string) => `${prop};TZID=${fuso}:${local(iso, fuso)}`;

export const uidDe = (id: string) => `${id}@${DOMINIO_UID}`;

function vtimezone(fuso: string): string[] {
  // São Paulo sem horário de verão desde 2019. Os clientes usam a própria base de fusos para o TZID.
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${fuso}`,
    `X-LIC-LOCATION:${fuso}`,
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

function vevento(e: Evento, fuso: string, agora: Date, pessoas: readonly Pessoa[]): string[] {
  const pessoa = e.pessoaId ? pessoas.find((p) => p.id === e.pessoaId)?.nome : undefined;
  const linhas = [
    'BEGIN:VEVENT',
    `UID:${uidDe(e.serieId ?? e.id)}`,
    `DTSTAMP:${utc(agora)}`,
    ...(e.criadoEm ? [`CREATED:${utc(e.criadoEm)}`] : []),
    ...(e.atualizadoEm ? [`LAST-MODIFIED:${utc(e.atualizadoEm)}`] : []),
    comFuso('DTSTART', e.inicio, fuso),
    comFuso('DTEND', e.fim, fuso),
    `SUMMARY:${escaparTexto(e.titulo)}`,
  ];
  if (pessoa) linhas.push(`DESCRIPTION:${escaparTexto(`Com ${pessoa}`)}`);
  if (e.rrule) linhas.push(`RRULE:${e.rrule}`);
  if (e.rrule && e.exdatas.length) linhas.push(`EXDATE;TZID=${fuso}:${[...e.exdatas].sort().map((x) => local(x, fuso)).join(',')}`);
  if (e.serieId && e.ocorrenciaOriginal) linhas.push(comFuso('RECURRENCE-ID', e.ocorrenciaOriginal, fuso));
  linhas.push(`TRANSP:${e.fixo ? 'OPAQUE' : 'TRANSPARENT'}`, 'CATEGORIES:Evento', 'END:VEVENT');
  return linhas;
}

function vsessao(s: Sessao, a: Atividade, fuso: string, agora: Date): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uidDe(`sessao-${s.id}`)}`,
    `DTSTAMP:${utc(agora)}`,
    `LAST-MODIFIED:${utc(s.atualizadoEm)}`,
    comFuso('DTSTART', s.inicio, fuso),
    comFuso('DTEND', s.fim, fuso),
    `SUMMARY:${escaparTexto(a.nome)}`,
    'TRANSP:OPAQUE',
    'CATEGORIES:Atividade',
    'END:VEVENT',
  ];
}

/** Eventos que vão para o arquivo: ativos; ocorrências editadas só se a série também for. */
export function eventosExportaveis(eventos: readonly Evento[]): Evento[] {
  const series = new Set(eventos.filter((e) => ativo(e) && e.rrule).map((e) => e.id));
  return eventos.filter((e) => ativo(e) && (!e.serieId || series.has(e.serieId)));
}

export function gerarICS(dados: DadosICS, opcoes: OpcoesICS = {}): string {
  const fuso = opcoes.fuso ?? FUSO_PADRAO;
  const agora = opcoes.agora ?? new Date();
  const atividades = new Map((dados.atividades ?? []).filter(ativo).map((a) => [a.id, a]));
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rumo//Calendario pessoal//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparTexto(opcoes.nome ?? 'Rumo')}`,
    `X-WR-TIMEZONE:${fuso}`,
    ...(opcoes.feed ? ['REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'] : []),
    ...vtimezone(fuso),
  ];
  for (const e of eventosExportaveis(dados.eventos)) linhas.push(...vevento(e, fuso, agora, dados.pessoas ?? []));
  for (const s of dados.sessoes ?? []) {
    const a = atividades.get(s.atividadeId);
    if (ativo(s) && s.origem === 'planejada' && a) linhas.push(...vsessao(s, a, fuso, agora));
  }
  linhas.push('END:VCALENDAR');
  return linhas.map(dobrar).join(CRLF) + CRLF;
}

// ——— Leitura ———

export interface VEventoLido {
  uid: string;
  titulo: string;
  descricao: string;
  inicio: ISODateTime;
  fim: ISODateTime;
  fixo: boolean;
  rrule: string | null;
  exdatas: ISODateTime[];
  recurrenceId: ISODateTime | null;
  categorias: string[];
}

export interface ResultadoLeitura {
  eventos: VEventoLido[];
  avisos: string[];
}

const desescapar = (t: string) =>
  t.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

interface Propriedade {
  nome: string;
  params: Record<string, string>;
  valor: string;
}

function lerLinha(linha: string): Propriedade | null {
  // Nome e parâmetros vão até o primeiro ":" fora de aspas.
  let i = 0;
  let aspas = false;
  for (; i < linha.length; i++) {
    if (linha[i] === '"') aspas = !aspas;
    else if (linha[i] === ':' && !aspas) break;
  }
  if (i >= linha.length) return null;
  const [nome, ...ps] = linha.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of ps) {
    const [k, v] = p.split('=');
    if (k && v !== undefined) params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
  }
  return { nome: nome!.toUpperCase(), params, valor: linha.slice(i + 1) };
}

/** Data/hora iCalendar → ISO UTC. Sem TZID nem "Z" (hora "flutuante"): usa o fuso do app. */
function lerDataHora(valor: string, params: Record<string, string>, fuso: string): ISODateTime | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(valor.trim());
  if (!m) return null;
  const [, a, me, d, h = '0', mi = '0', s = '0', z] = m;
  if (z) return new Date(Date.UTC(+a!, +me! - 1, +d!, +h, +mi, +s)).toISOString();
  const zona = params.TZID ?? fuso;
  try {
    return new Date(new TZDate(+a!, +me! - 1, +d!, +h, +mi, +s, zona).getTime()).toISOString();
  } catch {
    return new Date(new TZDate(+a!, +me! - 1, +d!, +h, +mi, +s, fuso).getTime()).toISOString();
  }
}

function lerDuracao(v: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, w = '0', d = '0', h = '0', mi = '0', s = '0'] = m;
  return ((+w * 7 + +d) * 86_400 + +h * 3600 + +mi * 60 + +s) * 1000;
}

export function lerICS(texto: string, fuso = FUSO_PADRAO): ResultadoLeitura {
  const linhas = texto.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const eventos: VEventoLido[] = [];
  const avisos: string[] = [];
  let atual: Propriedade[] | null = null;
  let profundidade = 0; // ignora componentes aninhados (VALARM)

  for (const l of linhas) {
    if (!l.trim()) continue;
    const p = lerLinha(l);
    if (!p) continue;
    if (p.nome === 'BEGIN' && p.valor.toUpperCase() === 'VEVENT') {
      atual = [];
      profundidade = 0;
      continue;
    }
    if (!atual) continue;
    if (p.nome === 'BEGIN') profundidade++;
    else if (p.nome === 'END' && profundidade > 0) profundidade--;
    else if (p.nome === 'END' && p.valor.toUpperCase() === 'VEVENT') {
      const ev = montar(atual, fuso, avisos);
      if (ev) eventos.push(ev);
      atual = null;
    } else if (profundidade === 0) atual.push(p);
  }
  return { eventos, avisos };
}

function montar(props: Propriedade[], fuso: string, avisos: string[]): VEventoLido | null {
  const uma = (n: string) => props.find((p) => p.nome === n);
  const uid = uma('UID')?.valor.trim() ?? '';
  const titulo = desescapar(uma('SUMMARY')?.valor ?? '');
  const ini = uma('DTSTART');
  if (!uid || !ini) {
    avisos.push(`Evento sem ${uid ? 'DTSTART' : 'UID'} ignorado${titulo ? `: ${titulo}` : ''}`);
    return null;
  }
  const diaInteiro = ini.params.VALUE === 'DATE' || /^\d{8}$/.test(ini.valor.trim());
  const inicio = lerDataHora(ini.valor, ini.params, fuso);
  if (!inicio) {
    avisos.push(`Data inválida em "${titulo}"`);
    return null;
  }
  const fimProp = uma('DTEND');
  const duracao = uma('DURATION');
  const fim =
    (fimProp && lerDataHora(fimProp.valor, fimProp.params, fuso)) ||
    (duracao && lerDuracao(duracao.valor) !== null ? new Date(new Date(inicio).getTime() + lerDuracao(duracao.valor)!).toISOString() : null) ||
    new Date(new Date(inicio).getTime() + (diaInteiro ? 86_400_000 : 3_600_000)).toISOString();

  const rrule = uma('RRULE')?.valor.trim() ?? null;
  if (rrule) {
    const r = lerRRule(rrule, fuso);
    if (!r.ok) avisos.push(`"${titulo}": ${r.erro}; a série aparece só na primeira data`);
  }
  const exdatas = props
    .filter((p) => p.nome === 'EXDATE')
    .flatMap((p) => p.valor.split(',').map((v) => lerDataHora(v, p.params, fuso)))
    .filter((x): x is string => !!x);
  const rid = uma('RECURRENCE-ID');
  return {
    uid,
    titulo,
    descricao: desescapar(uma('DESCRIPTION')?.valor ?? ''),
    inicio,
    fim,
    fixo: (uma('TRANSP')?.valor.trim().toUpperCase() ?? 'OPAQUE') !== 'TRANSPARENT',
    rrule,
    exdatas,
    recurrenceId: rid ? lerDataHora(rid.valor, rid.params, fuso) : null,
    categorias: props.filter((p) => p.nome === 'CATEGORIES').flatMap((p) => p.valor.split(',').map((c) => desescapar(c.trim()))),
  };
}

/** Id local a partir do UID (os nossos terminam em "@rumo"). */
export const idDoUid = (uid: string) => (uid.endsWith(`@${DOMINIO_UID}`) ? uid.slice(0, -DOMINIO_UID.length - 1) : uid);

/**
 * Converte VEVENTs lidos em eventos do app (sem campos de registro): a série fica com o id
 * do UID; ocorrências com RECURRENCE-ID viram exceções ligadas a ela.
 */
export function eventosDoICS(lidos: readonly VEventoLido[]): (Omit<Evento, 'criadoEm' | 'atualizadoEm' | 'excluidoEm'>)[] {
  return lidos
    .filter((v) => !v.categorias.includes('Atividade'))
    .map((v) => {
      const base = idDoUid(v.uid);
      return {
        id: v.recurrenceId ? `${base}@${v.recurrenceId}` : base,
        titulo: v.titulo,
        inicio: v.inicio,
        fim: v.fim,
        fixo: v.fixo,
        pessoaId: null,
        rrule: v.recurrenceId ? null : v.rrule,
        exdatas: v.recurrenceId ? [] : v.exdatas,
        serieId: v.recurrenceId ? base : null,
        ocorrenciaOriginal: v.recurrenceId,
      };
    });
}
