import { DatabaseSync } from 'node:sqlite';
import { TABELAS_SYNC, venceLWW, type Mudancas, type Registro, type TabelaSync, type TabelasBackup } from '@rumo/core';

export interface InscricaoPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Armazenamento do servidor em SQLite (módulo nativo do Node, sem dependência nativa).
 * Os registros ficam como JSON, um por (tabela, id), com uma revisão crescente que serve
 * de cursor para a sincronização.
 */
export class Banco {
  private readonly db: DatabaseSync;

  constructor(caminho = ':memory:') {
    this.db = new DatabaseSync(caminho);
    this.db.exec(`
      pragma journal_mode = wal;
      create table if not exists registros (
        tabela text not null,
        id text not null,
        atualizado_em text not null,
        rev integer not null,
        dados text not null,
        primary key (tabela, id)
      );
      create index if not exists registros_rev on registros(rev);
      create table if not exists contador (nome text primary key, valor integer not null);
      insert or ignore into contador values ('rev', 0);
      create table if not exists inscricoes (endpoint text primary key, dados text not null, criada_em text not null);
      create table if not exists enviados (chave text primary key, enviado_em text not null);
    `);
  }

  fechar() {
    this.db.close();
  }

  private transacao<T>(fn: () => T): T {
    this.db.exec('begin');
    try {
      const r = fn();
      this.db.exec('commit');
      return r;
    } catch (e) {
      this.db.exec('rollback');
      throw e;
    }
  }

  cursorAtual(): number {
    return (this.db.prepare("select valor from contador where nome = 'rev'").get() as { valor: number }).valor;
  }

  /** Aplica registros já validados com last-write-wins; devolve quantos venceram. */
  aplicar(mudancas: Mudancas): number {
    const buscar = this.db.prepare('select atualizado_em from registros where tabela = ? and id = ?');
    const proximaRev = this.db.prepare("update contador set valor = valor + 1 where nome = 'rev' returning valor");
    const gravar = this.db.prepare(
      `insert into registros (tabela, id, atualizado_em, rev, dados) values (?, ?, ?, ?, ?)
       on conflict (tabela, id) do update set atualizado_em = excluded.atualizado_em, rev = excluded.rev, dados = excluded.dados`,
    );
    return this.transacao(() => {
      let aplicados = 0;
      for (const [tabela, lista] of Object.entries(mudancas) as [TabelaSync, Registro[]][]) {
        for (const r of lista) {
          const atual = buscar.get(tabela, r.id) as { atualizado_em: string } | undefined;
          if (!venceLWW(r, atual && { atualizadoEm: atual.atualizado_em })) continue;
          const { valor: rev } = proximaRev.get() as { valor: number };
          gravar.run(tabela, r.id, r.atualizadoEm, rev, JSON.stringify(r));
          aplicados++;
        }
      }
      return aplicados;
    });
  }

  /** Tudo o que mudou depois de `cursor`, agrupado por tabela, e o cursor novo. */
  desde(cursor: number): { cursor: number; mudancas: Mudancas } {
    const linhas = this.db.prepare('select tabela, dados from registros where rev > ? order by rev').all(cursor) as { tabela: TabelaSync; dados: string }[];
    const mudancas: Mudancas = {};
    for (const l of linhas) ((mudancas[l.tabela] ??= []) as Registro[]).push(JSON.parse(l.dados));
    return { cursor: this.cursorAtual(), mudancas };
  }

  /** Todos os registros de uma tabela (inclusive excluídos). */
  tabela<T extends TabelaSync>(nome: T): TabelasBackup[T] {
    const linhas = this.db.prepare('select dados from registros where tabela = ?').all(nome) as { dados: string }[];
    return linhas.map((l) => JSON.parse(l.dados)) as TabelasBackup[T];
  }

  todas(): TabelasBackup {
    return Object.fromEntries(TABELAS_SYNC.map((t) => [t, this.tabela(t)])) as unknown as TabelasBackup;
  }

  salvarInscricao(i: InscricaoPush, agora = new Date()) {
    this.db
      .prepare('insert into inscricoes values (?, ?, ?) on conflict (endpoint) do update set dados = excluded.dados')
      .run(i.endpoint, JSON.stringify(i), agora.toISOString());
  }

  removerInscricao(endpoint: string) {
    this.db.prepare('delete from inscricoes where endpoint = ?').run(endpoint);
  }

  inscricoes(): InscricaoPush[] {
    return (this.db.prepare('select dados from inscricoes').all() as { dados: string }[]).map((l) => JSON.parse(l.dados));
  }

  /** Chaves de lembretes já enviados nos últimos `dias` dias (o resto é esquecido). */
  enviados(agora: Date, dias = 60): Set<string> {
    const limite = new Date(agora.getTime() - dias * 86_400_000).toISOString();
    this.db.prepare('delete from enviados where enviado_em < ?').run(limite);
    return new Set((this.db.prepare('select chave from enviados').all() as { chave: string }[]).map((l) => l.chave));
  }

  marcarEnviado(chave: string, agora = new Date()) {
    this.db.prepare('insert or ignore into enviados values (?, ?)').run(chave, agora.toISOString());
  }
}
