import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';

const estilos: Record<Variante, string> = {
  primario: 'bg-indigo-600 text-white active:bg-indigo-700 dark:bg-indigo-500 dark:active:bg-indigo-600',
  secundario:
    'bg-neutral-200/70 text-neutral-900 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:active:bg-neutral-700',
  fantasma: 'text-neutral-600 active:bg-neutral-200 dark:text-neutral-300 dark:active:bg-neutral-800',
  perigo: 'bg-red-50 text-red-700 active:bg-red-100 dark:bg-red-950/50 dark:text-red-300',
};

export function Botao({
  variante = 'secundario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-medium transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${estilos[variante]} ${className}`}
      {...props}
    />
  );
}
