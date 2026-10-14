import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface Toast {
  texto: string;
  /** Normalmente "Desfazer". */
  acao?: { rotulo: string; fn: () => unknown };
}

const Ctx = createContext<(t: Toast) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const mostrar = useCallback((t: Toast) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl bg-neutral-900 py-1 pr-1 pl-4 text-[15px] text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
          >
            <span className="py-2">{toast.texto}</span>
            {toast.acao && (
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 font-semibold text-indigo-300 active:bg-white/10 dark:text-indigo-700 dark:active:bg-black/5"
                onClick={() => {
                  toast.acao!.fn();
                  setToast(null);
                }}
              >
                {toast.acao.rotulo}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
