import { paraHoraLocal, type Atividade, type Evento, type Sessao } from '@rumo/core';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import type { CSSProperties, HTMLAttributes, Ref } from 'react';
import { ALTURA_MINIMA_BLOCO, minParaPx, type BlocoNoDia } from './geometria';

/** Posição absoluta de um bloco dentro da coluna do dia. */
export function estiloBloco(b: BlocoNoDia<unknown>): CSSProperties {
  const largura = 100 / b.faixas;
  return {
    top: minParaPx(b.inicioMin),
    height: Math.max(minParaPx(b.fimMin - b.inicioMin), ALTURA_MINIMA_BLOCO),
    left: `calc(${b.faixa * largura}% + 2px)`,
    width: `calc(${largura}% - 4px)`,
  };
}

const faixaHorario = (i: { inicio: string; fim: string }) => `${paraHoraLocal(i.inicio)}–${paraHoraLocal(i.fim)}`;

export function BlocoEvento({ bloco, onAbrir }: { bloco: BlocoNoDia<Evento>; onAbrir: (e: Evento) => void }) {
  const e = bloco.item;
  const alto = minParaPx(bloco.fimMin - bloco.inicioMin) >= 40;
  return (
    <button
      type="button"
      data-bloco="evento"
      onClick={() => onAbrir(e)}
      aria-label={`${e.titulo}, ${faixaHorario(e)}${e.fixo ? ', fixo' : ''}`}
      style={estiloBloco(bloco)}
      className={`absolute z-[1] overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight select-none ${
        e.fixo
          ? 'bg-neutral-300/90 text-neutral-800 dark:bg-neutral-700/90 dark:text-neutral-100'
          : 'border border-dashed border-neutral-400 bg-neutral-100/60 text-neutral-600 dark:border-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-300'
      }`}
    >
      <span className="flex items-start gap-1">
        {e.fixo && <Lock size={11} className="mt-px shrink-0" aria-hidden />}
        <span className="truncate font-semibold">{e.titulo}</span>
      </span>
      {alto && <span className="block truncate opacity-75">{faixaHorario(e)}</span>}
    </button>
  );
}

export interface PropsBlocoSessao {
  bloco: BlocoNoDia<Sessao>;
  atividade: Atividade;
  conflitos: Evento[];
  onAbrir?: (s: Sessao) => void;
  /** Estilo extra (ex.: altura ao redimensionar). */
  estilo?: CSSProperties;
  fantasma?: boolean;
  refArraste?: Ref<HTMLButtonElement>;
  propsArraste?: HTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}

export function BlocoSessao({ bloco, atividade, conflitos, onAbrir, estilo, fantasma, refArraste, propsArraste, children }: PropsBlocoSessao) {
  const s = bloco.item;
  const feita = s.origem === 'registrada';
  const alto = minParaPx(bloco.fimMin - bloco.inicioMin) >= 40;
  const conflito = conflitos.length > 0;
  const rotulo = [
    atividade.nome,
    faixaHorario(s),
    feita ? 'feito' : 'planejado',
    conflito && `em conflito com ${conflitos.map((c) => c.titulo).join(', ')}`,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div style={{ ...estiloBloco(bloco), ...estilo }} className={`absolute z-[2] ${fantasma ? 'opacity-30' : ''}`} data-sessao={s.id}>
      <button
        ref={refArraste}
        type="button"
        data-bloco="sessao"
        onClick={() => onAbrir?.(s)}
        aria-label={rotulo}
        style={{ backgroundColor: `${atividade.cor}${feita ? '26' : '40'}`, borderLeftColor: atividade.cor }}
        className={`arrastavel h-full w-full overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-tight text-neutral-900 dark:text-white ${
          conflito ? 'ring-2 ring-red-500' : ''
        } ${feita ? 'opacity-80' : ''}`}
        {...propsArraste}
      >
        <span className="flex items-start gap-1">
          {feita && <Check size={11} className="mt-px shrink-0" aria-hidden />}
          {conflito && <AlertTriangle size={11} className="mt-px shrink-0 text-red-600 dark:text-red-400" aria-hidden />}
          <span className="truncate font-semibold">{atividade.nome}</span>
        </span>
        {alto && <span className="block truncate opacity-75">{faixaHorario(s)}</span>}
      </button>
      {children}
    </div>
  );
}
