import type { ReactNode } from 'react';

export function Pagina({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          {subtitulo && <p className="text-sm font-medium text-neutral-500 first-letter:uppercase">{subtitulo}</p>}
          <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
        </div>
        {acao}
      </header>
      {children}
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-neutral-500 uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 px-5 py-8 text-center text-neutral-500 dark:border-neutral-700">
      {children}
    </div>
  );
}

export const classeCartao = 'rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10';
