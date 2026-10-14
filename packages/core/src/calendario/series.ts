import { novoId } from '../id';
import { ativo, type Evento, type ISODateTime, type Registro } from '../model';
import { FUSO_PADRAO } from '../time';
import type { EventoNaAgenda } from './eventos';
import { escreverRRule, lerRRule, ocorrencias } from './recorrencia';

export type DadosEvento = Omit<Evento, keyof Registro>;
export type Escopo = 'este' | 'seguintes' | 'todos';

/** O que o formulário edita numa ocorrência. */
export interface MudancasOcorrencia {
  titulo: string;
  inicio: ISODateTime;
  fim: ISODateTime;
  fixo: boolean;
  pessoaId: string | null;
  /** Regra da série depois da edição (null = deixar de repetir). */
  rrule: string | null;
}

/** Mudanças a aplicar no banco, numa transação. */
export interface PlanoSerie {
  criar: (DadosEvento & { id: string })[];
  atualizar: { id: string; mudancas: Partial<DadosEvento> }[];
  excluir: string[];
}

export interface ContextoSerie {
  /** A série (evento com RRULE). */
  serie: Evento;
  /** A ocorrência tocada: da própria série ou uma ocorrência já editada ("só este"). */
  ocorrencia: EventoNaAgenda;
  /** Todos os eventos, para achar as ocorrências editadas da série. */
  eventos: readonly Evento[];
  fuso?: string;
}

const vazio = (): PlanoSerie => ({ criar: [], atualizar: [], excluir: [] });
const ms = (iso: string) => new Date(iso).getTime();
const desloca = (iso: string, delta: number) => new Date(ms(iso) + delta).toISOString();

const inicioOriginal = (ctx: ContextoSerie) => ctx.ocorrencia.ocorrencia?.inicioOriginal ?? ctx.serie.inicio;
const editadaAtual = (ctx: ContextoSerie) => (ctx.ocorrencia.id !== ctx.serie.id ? ctx.ocorrencia.id : null);
const editadasDaSerie = (ctx: ContextoSerie) => ctx.eventos.filter((e) => ativo(e) && e.serieId === ctx.serie.id);
const ehPrimeira = (ctx: ContextoSerie) => ms(inicioOriginal(ctx)) <= ms(ctx.serie.inicio);

/** "Só este" não faz sentido quando a própria regra mudou. */
export function escoposPermitidos(ctx: ContextoSerie, novaRRule: string | null): Escopo[] {
  return novaRRule === ctx.serie.rrule ? ['este', 'seguintes', 'todos'] : ['seguintes', 'todos'];
}

/** A série termina logo antes de `corte` (UNTIL = corte − 1s; COUNT vira UNTIL). */
function truncar(serie: Evento, corte: ISODateTime, fuso: string): string | null {
  const r = serie.rrule ? lerRRule(serie.rrule, fuso) : null;
  if (!r?.ok) return serie.rrule;
  return escreverRRule({ ...r.regra, contagem: null, ate: new Date(ms(corte) - 1000).toISOString() });
}

/** Quantas ocorrências a série teve antes de `corte` (para dividir um COUNT). */
function ocorrenciasAntes(serie: Evento, corte: ISODateTime, fuso: string): number {
  const r = serie.rrule ? lerRRule(serie.rrule, fuso) : null;
  if (!r?.ok) return 0;
  return ocorrencias(new Date(serie.inicio), r.regra, new Date(serie.inicio), new Date(corte), fuso).length;
}

export function planoEditar(ctx: ContextoSerie, escopo: Escopo, novo: MudancasOcorrencia): PlanoSerie {
  const fuso = ctx.fuso ?? FUSO_PADRAO;
  const plano = vazio();
  const original = inicioOriginal(ctx);
  const editada = editadaAtual(ctx);
  const conteudo = { titulo: novo.titulo, fixo: novo.fixo, pessoaId: novo.pessoaId };

  if (escopo === 'este') {
    if (editada) plano.atualizar.push({ id: editada, mudancas: { ...conteudo, inicio: novo.inicio, fim: novo.fim } });
    else
      plano.criar.push({
        id: novoId(),
        ...conteudo,
        inicio: novo.inicio,
        fim: novo.fim,
        rrule: null,
        exdatas: [],
        serieId: ctx.serie.id,
        ocorrenciaOriginal: original,
      });
    return plano;
  }

  const delta = ms(novo.inicio) - ms(original);
  const regraMudou = novo.rrule !== ctx.serie.rrule;
  const editadas = editadasDaSerie(ctx);

  if (escopo === 'todos' || ehPrimeira(ctx)) {
    if (novo.rrule === null) {
      // Deixou de repetir: vira um evento único no horário editado.
      plano.atualizar.push({
        id: ctx.serie.id,
        mudancas: { ...conteudo, inicio: novo.inicio, fim: novo.fim, rrule: null, exdatas: [] },
      });
      plano.excluir.push(...editadas.map((e) => e.id));
      return plano;
    }
    const inicio = desloca(ctx.serie.inicio, delta);
    plano.atualizar.push({
      id: ctx.serie.id,
      mudancas: {
        ...conteudo,
        inicio,
        fim: new Date(ms(inicio) + ms(novo.fim) - ms(novo.inicio)).toISOString(),
        rrule: novo.rrule,
        exdatas: regraMudou ? [] : ctx.serie.exdatas.map((x) => desloca(x, delta)),
      },
    });
    for (const e of editadas) {
      if (regraMudou) plano.excluir.push(e.id);
      else plano.atualizar.push({ id: e.id, mudancas: { ocorrenciaOriginal: desloca(e.ocorrenciaOriginal!, delta) } });
    }
    return plano;
  }

  // "Este e os seguintes": a série antiga termina antes desta ocorrência; nasce uma série nova.
  const novaId = novoId();
  let rruleNova = novo.rrule;
  if (!regraMudou && rruleNova) {
    const r = lerRRule(rruleNova, fuso);
    if (r.ok && r.regra.contagem !== null) {
      rruleNova = escreverRRule({ ...r.regra, contagem: Math.max(1, r.regra.contagem - ocorrenciasAntes(ctx.serie, original, fuso)) });
    }
  }
  plano.atualizar.push({
    id: ctx.serie.id,
    mudancas: { rrule: truncar(ctx.serie, original, fuso), exdatas: ctx.serie.exdatas.filter((x) => ms(x) < ms(original)) },
  });
  plano.criar.push({
    id: novaId,
    ...conteudo,
    inicio: novo.inicio,
    fim: novo.fim,
    rrule: rruleNova,
    exdatas: regraMudou ? [] : ctx.serie.exdatas.filter((x) => ms(x) >= ms(original)).map((x) => desloca(x, delta)),
    serieId: null,
    ocorrenciaOriginal: null,
  });
  for (const e of editadas) {
    if (ms(e.ocorrenciaOriginal!) < ms(original)) continue;
    if (e.id === editada || regraMudou) plano.excluir.push(e.id);
    else plano.atualizar.push({ id: e.id, mudancas: { serieId: novaId, ocorrenciaOriginal: desloca(e.ocorrenciaOriginal!, delta) } });
  }
  return plano;
}

export function planoExcluir(ctx: ContextoSerie, escopo: Escopo): PlanoSerie {
  const fuso = ctx.fuso ?? FUSO_PADRAO;
  const plano = vazio();
  const original = inicioOriginal(ctx);
  const editada = editadaAtual(ctx);
  const editadas = editadasDaSerie(ctx);

  if (escopo === 'este') {
    plano.atualizar.push({ id: ctx.serie.id, mudancas: { exdatas: [...new Set([...ctx.serie.exdatas, original])] } });
    if (editada) plano.excluir.push(editada);
    return plano;
  }
  if (escopo === 'todos' || ehPrimeira(ctx)) {
    plano.excluir.push(ctx.serie.id, ...editadas.map((e) => e.id));
    return plano;
  }
  plano.atualizar.push({
    id: ctx.serie.id,
    mudancas: { rrule: truncar(ctx.serie, original, fuso), exdatas: ctx.serie.exdatas.filter((x) => ms(x) < ms(original)) },
  });
  plano.excluir.push(...editadas.filter((e) => ms(e.ocorrenciaOriginal!) >= ms(original)).map((e) => e.id));
  return plano;
}
