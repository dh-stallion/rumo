import { paraHoraLocal, rotuloDia, type Compromisso, type DiaDeCompromissos, type Pessoa } from '@rumo/core';
import { Lock, Plus, Repeat } from 'lucide-react';
import { Botao } from '../../components/ui/Botao';
import { classeCartao } from '../../components/ui/Pagina';

export function ListaCompromissos({
  itens,
  pessoas,
  onAbrir,
}: {
  itens: Compromisso[];
  pessoas: Pessoa[];
  onAbrir: (c: Compromisso) => void;
}) {
  return (
    <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>
      {itens.map((c) => {
        const pessoa = c.pessoaId ? pessoas.find((p) => p.id === c.pessoaId)?.nome : undefined;
        return (
          <li key={`${c.tipo}:${c.id}`}>
            <button
              type="button"
              onClick={() => onAbrir(c)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-neutral-500">{paraHoraLocal(c.inicio)}</span>
              {c.tipo === 'sessao' && (
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.afazer.cor }} aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.titulo}</span>
                {pessoa && <span className="block truncate text-sm text-neutral-500">com {pessoa}</span>}
                {c.tipo === 'sessao' && <span className="block text-sm text-neutral-500">planejado</span>}
              </span>
              {c.tipo === 'evento' && c.evento.ocorrencia && (
                <Repeat size={16} className="shrink-0 text-neutral-400" role="img" aria-label="Repete" />
              )}
              {c.fixo && <Lock size={16} className="shrink-0 text-neutral-400" role="img" aria-label="Fixo" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ProximosCompromissos({
  grupos,
  agora,
  pessoas,
  onAbrir,
  onNovo,
}: {
  grupos: DiaDeCompromissos[];
  agora: Date;
  pessoas: Pessoa[];
  onAbrir: (c: Compromisso) => void;
  onNovo: () => void;
}) {
  return (
    <section className="mb-7" aria-labelledby="proximos-titulo">
      <h2 id="proximos-titulo" className="mb-2 px-1 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
        Próximos compromissos
      </h2>
      {grupos.length === 0 ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-sm text-neutral-500">Nada marcado para os próximos 7 dias.</p>
          <Botao variante="fantasma" className="shrink-0 px-2 text-indigo-600 dark:text-indigo-400" onClick={onNovo}>
            <Plus size={18} /> Adicionar compromisso
          </Botao>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.data}>
              <h3 className="mb-1.5 px-1 text-[15px] font-semibold">{rotuloDia(g.data, agora)}</h3>
              <ListaCompromissos itens={g.itens} pessoas={pessoas} onAbrir={onAbrir} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
