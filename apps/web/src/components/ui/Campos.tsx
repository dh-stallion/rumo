import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export const classeInput =
  'w-full min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-neutral-700 dark:bg-neutral-800';

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{rotulo}</span>
      {children}
      {dica && <span className="block text-xs text-neutral-500">{dica}</span>}
    </label>
  );
}

export function Segmentado<T extends string>({
  valor,
  opcoes,
  onChange,
  rotulo,
}: {
  valor: T;
  opcoes: readonly { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex rounded-xl bg-neutral-200/70 p-1 dark:bg-neutral-800">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={`min-h-11 flex-1 rounded-lg text-[15px] font-medium transition-colors ${
            valor === o.valor
              ? 'bg-white shadow-sm dark:bg-neutral-600'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Número com botões − e +; `formatar` decide o texto (ex.: 0 → "Não avisar"). */
export function Stepper({
  valor,
  onChange,
  min = 0,
  max = 999,
  passo = 1,
  formatar = String,
  rotulo,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  formatar?: (v: number) => string;
  rotulo: string;
}) {
  const botao =
    'grid size-11 place-items-center rounded-xl bg-neutral-200/70 active:bg-neutral-300 disabled:opacity-30 dark:bg-neutral-800 dark:active:bg-neutral-700';
  return (
    <div className="flex items-center gap-3" role="group" aria-label={rotulo}>
      <button type="button" className={botao} aria-label="Diminuir" disabled={valor <= min} onClick={() => onChange(Math.max(min, valor - passo))}>
        <Minus size={20} />
      </button>
      <span className="min-w-24 flex-1 text-center text-base font-medium tabular-nums" aria-live="polite">
        {formatar(valor)}
      </span>
      <button type="button" className={botao} aria-label="Aumentar" disabled={valor >= max} onClick={() => onChange(Math.min(max, valor + passo))}>
        <Plus size={20} />
      </button>
    </div>
  );
}

export function Interruptor({
  marcado,
  onChange,
  rotulo,
  dica,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  rotulo: string;
  dica?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={marcado}
      onClick={() => onChange(!marcado)}
      className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-[15px] font-medium">{rotulo}</span>
        {dica && <span className="block text-xs text-neutral-500">{dica}</span>}
      </span>
      <span
        className={`relative h-8 w-13 shrink-0 rounded-full transition-colors ${marcado ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${marcado ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  );
}
