import { useDraggable } from '@dnd-kit/core';
import {
  acoesPendentes,
  afazerDeAtividade,
  agendadasDoAfazer,
  CATEGORIAS,
  ROTULO_CATEGORIA,
  type Afazer,
  type Atividade,
  type Projeto,
  type Sessao,
} from '@rumo/core';
import { ChevronUp, GripVertical } from 'lucide-react';
import type { DadosArraste } from './arraste';

/**
 * Gaveta inferior com o que dá para agendar: atividades por categoria e as próximas ações
 * dos projetos. Não é modal: a grade continua visível e, ao começar a arrastar, a gaveta
 * desce para liberar a área de soltar (sem desmontar, para o arraste não ser cancelado).
 */
export function BancoAfazeres({
  atividades,
  projetos,
  sessoes,
  inicioSemana,
  aberto,
  arrastando,
  onAlternar,
  onEscolher,
  acabouDeArrastar,
}: {
  atividades: Atividade[];
  projetos: Projeto[];
  sessoes: Sessao[];
  inicioSemana: Date;
  aberto: boolean;
  arrastando: boolean;
  onAlternar: () => void;
  onEscolher: (f: Afazer) => void;
  acabouDeArrastar: () => boolean;
}) {
  const porNome = (a: Afazer, b: Afazer) => a.nome.localeCompare(b.nome, 'pt-BR');
  const ativas = atividades.filter((a) => !a.pausada);
  const grupos = [
    ...CATEGORIAS.map((c) => ({
      titulo: ROTULO_CATEGORIA[c],
      itens: ativas.filter((a) => a.categoria === c).map(afazerDeAtividade).sort(porNome),
    })),
    { titulo: 'Projetos', itens: acoesPendentes(projetos) },
  ].filter((g) => g.itens.length);

  return (
    <div className="relative z-30">
      <section
        id="banco-afazeres"
        aria-label="Banco de afazeres"
        aria-hidden={!aberto}
        className={`absolute inset-x-0 bottom-full max-h-[55dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-black/5 bg-white px-3 pt-3 pb-2 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-200 dark:border-white/10 dark:bg-neutral-900 ${
          aberto && !arrastando ? 'translate-y-0' : 'pointer-events-none translate-y-[110%] opacity-0'
        } ${aberto ? '' : 'invisible'}`}
      >
        <p className="mb-2 px-1 text-xs text-neutral-500">Segure e arraste para a grade, ou toque para escolher dia e hora.</p>
        {grupos.length === 0 && (
          <p className="px-1 py-4 text-sm text-neutral-500">Cadastre atividades na aba Atividades ou ações nos seus projetos.</p>
        )}
        {grupos.map(({ titulo, itens }) => (
          <div key={titulo} className="mb-3">
            <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{titulo}</h3>
            <ul className="space-y-1">
              {itens.map((f) => (
                <li key={`${f.tipo}:${f.id}`}>
                  <ItemBanco
                    afazer={f}
                    agendadas={agendadasDoAfazer(f, sessoes, inicioSemana)}
                    onEscolher={() => !acabouDeArrastar() && onEscolher(f)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        aria-controls="banco-afazeres"
        className="flex min-h-12 w-full items-center justify-between border-t border-black/5 bg-white px-4 text-[15px] font-semibold dark:border-white/10 dark:bg-neutral-900"
      >
        Banco de afazeres
        <ChevronUp size={20} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
    </div>
  );
}

function ItemBanco({ afazer, agendadas, onEscolher }: { afazer: Afazer; agendadas: number; onEscolher: () => void }) {
  const dados: DadosArraste = { tipo: 'banco', afazer };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `banco:${afazer.tipo}:${afazer.id}`, data: dados });
  const meta = afazer.tipo === 'atividade' ? afazer.atividade.metaSemanal : 0;
  const contador = meta > 0 ? `${agendadas} de ${meta} agendados` : agendadas ? `${agendadas} agendados` : 'nenhum agendado';
  const completo = meta > 0 && agendadas >= meta;
  const detalhe = afazer.tipo === 'acao' ? `${afazer.projeto.nome} · ${afazer.duracaoMin} min` : `${afazer.duracaoMin} min`;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="item arrastável"
      aria-label={`${afazer.nome}, ${contador}, ${afazer.duracaoMin} min`}
      onClick={onEscolher}
      onContextMenu={(e) => e.preventDefault()}
      className={`arrastavel flex min-h-13 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-neutral-100 dark:active:bg-neutral-800 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <GripVertical size={18} className="shrink-0 text-neutral-400" aria-hidden />
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: afazer.cor }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{afazer.nome}</span>
        <span className="block truncate text-sm text-neutral-500">{detalhe}</span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
          completo
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
            : 'bg-neutral-200/70 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
        }`}
        data-contador={afazer.id}
      >
        {contador}
      </span>
    </button>
  );
}
