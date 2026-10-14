import { ativo, type Evento, type Pessoa } from '../model';
import { eventosDoICS, type VEventoLido } from './ics';
import type { DadosEvento } from './series';

export interface PlanoImportacao {
  /** Eventos com id (do UID) que ainda não existem. */
  novos: (DadosEvento & { id: string })[];
  /** Eventos que já existem (mesmo UID): são atualizados, sem duplicar. */
  atualizar: (DadosEvento & { id: string })[];
  /** Sessões de atividades exportadas pelo Rumo: não viram eventos. */
  sessoesIgnoradas: number;
  /** Quantas séries (eventos com repetição) há no arquivo. */
  series: number;
}

/**
 * Decide o que fazer com os eventos lidos de um .ics: criar, atualizar (mesmo UID, como
 * ao reimportar um arquivo exportado pelo próprio app) ou ignorar (sessões de atividades).
 * "Com Fulano" na descrição volta a ligar o evento à pessoa de mesmo nome.
 */
export function planoImportacao(lidos: readonly VEventoLido[], existentes: readonly Evento[], pessoas: readonly Pessoa[] = []): PlanoImportacao {
  const porId = new Map(existentes.map((e) => [e.id, e]));
  const nomes = new Map(pessoas.filter(ativo).map((p) => [p.nome.trim().toLocaleLowerCase('pt-BR'), p.id]));

  // eventosDoICS converte um a um, na mesma ordem: dá para ler a descrição de cada um.
  const relevantes = lidos.filter((v) => !v.categorias.includes('Atividade'));
  const convertidos = eventosDoICS(relevantes);

  // Último vence se o mesmo evento aparecer duas vezes no arquivo.
  const unicos = new Map<string, DadosEvento & { id: string }>();
  convertidos.forEach((e, i) => {
    const com = /^Com (.+)$/.exec(relevantes[i]!.descricao.trim());
    const pessoaId = com ? (nomes.get(com[1]!.trim().toLocaleLowerCase('pt-BR')) ?? null) : null;
    unicos.set(e.id, { ...e, pessoaId: pessoaId ?? porId.get(e.id)?.pessoaId ?? null });
  });

  const novos: PlanoImportacao['novos'] = [];
  const atualizar: PlanoImportacao['atualizar'] = [];
  for (const e of unicos.values()) (porId.has(e.id) ? atualizar : novos).push(e);
  return {
    novos,
    atualizar,
    sessoesIgnoradas: lidos.filter((v) => v.categorias.includes('Atividade')).length,
    series: [...unicos.values()].filter((e) => e.rrule).length,
  };
}
