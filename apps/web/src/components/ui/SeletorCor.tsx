import { Check } from 'lucide-react';

export const CORES = ['#6366f1', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

export function SeletorCor({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Cor</legend>
      <div className="grid grid-cols-8 justify-items-center">
        {CORES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            aria-pressed={valor === c}
            onClick={() => onChange(c)}
            className="grid size-11 place-items-center rounded-full"
          >
            <span
              className={`grid size-8 place-items-center rounded-full ${valor === c ? 'ring-2 ring-offset-2 ring-neutral-900 ring-offset-white dark:ring-white dark:ring-offset-neutral-900' : ''}`}
              style={{ backgroundColor: c }}
            >
              {valor === c && <Check size={16} className="text-white" />}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
