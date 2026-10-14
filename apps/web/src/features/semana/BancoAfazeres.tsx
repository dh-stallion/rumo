import { useDraggable } from '@dnd-kit/core';
import { agendadasNaSemana, CATEGORIAS, ROTULO_CATEGORIA, type Atividade, type Sessao } from '@rumo/core';
import { ChevronUp, GripVertical } from 'lucide-react';
import type { DadosArraste } from './arraste';

/**
 * Gaveta inferior com as atividades por categoria. Não é modal: a grade continua
 * visível e, ao começar a arrastar, a gaveta desce para liberar a área de soltar
 * (sem desmontar, para o arraste não ser cancelado).
 */
export function BancoAfazeres({
  atividades,
  sessoes,
  inicioSemana,
  aberto,
  arrastando,
  onAlternar,
  onEscolher,
  acabouDeArrastar,
}: {
  atividades: Atividade[];
  sessoes: Sessao[];
  inicioSemana: Date;
  aberto: boolean;
  arrastando: boolean;
  onAlternar: () => void;
  onEscolher: (a: Atividade) => void;
  acabouDeArrastar: () => boolean;
}) {
  const ativas = atividades.filter((a) => !a.pausada).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const grupos = CATEGORIAS.map((c) => ({ c, itens: ativas.filter((a) => a.categoria === c) })).filter((g) => g.itens.length);

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
        {grupos.length === 0 && <p className="px-1 py-4 text-sm text-neutral-500">Cadastre atividades na aba Atividades.</p>}
        {grupos.map(({ c, itens }) => (
          <div key={c} className="mb-3">
            <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{ROTULO_CATEGORIA[c]}</h3>
            <ul className="space-y-1">
              {itens.map((a) => (
                <li key={a.id}>
                  <ItemBanco
                    atividade={a}
                    agendadas={agendadasNaSemana(a.id, sessoes, inicioSemana)}
                    onEscolher={() => !acabouDeArrastar() && onEscolher(a)}
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

function ItemBanco({ atividade, agendadas, onEscolher }: { atividade: Atividade; agendadas: number; onEscolher: () => void }) {
  const dados: DadosArraste = { tipo: 'banco', atividade };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `banco:${atividade.id}`, data: dados });
  const contador =
    atividade.metaSemanal > 0 ? `${agendadas} de ${atividade.metaSemanal} agendados` : agendadas ? `${agendadas} agendados` : 'nenhum agendado';
  const completo = atividade.metaSemanal > 0 && agendadas >= atividade.metaSemanal;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="item arrastável"
      aria-label={`${atividade.nome}, ${contador}, ${atividade.duracaoPadraoMin} min`}
      onClick={onEscolher}
      onContextMenu={(e) => e.preventDefault()}
      className={`arrastavel flex min-h-13 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-neutral-100 dark:active:bg-neutral-800 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <GripVertical size={18} className="shrink-0 text-neutral-400" aria-hidden />
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: atividade.cor }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{atividade.nome}</span>
        <span className="block text-sm text-neutral-500">{atividade.duracaoPadraoMin} min</span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
          completo
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
            : 'bg-neutral-200/70 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
        }`}
        data-contador={atividade.id}
      >
        {contador}
      </span>
    </button>
  );
}
