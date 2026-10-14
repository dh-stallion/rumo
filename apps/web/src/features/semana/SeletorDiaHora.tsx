import { diaCurto, formatar, paraDataLocal, type Evento } from '@rumo/core';
import { AlertTriangle } from 'lucide-react';
import { Campo, classeInput, Stepper } from '../../components/ui/Campos';

/** Escolha de dia (7 botões da semana), horário e duração — o fluxo sem arrastar. */
export function SeletorDiaHora({
  dias,
  hoje,
  dia,
  hora,
  duracao,
  conflitos,
  onDia,
  onHora,
  onDuracao,
}: {
  dias: Date[];
  hoje: string;
  dia: string;
  hora: string;
  duracao: number;
  conflitos: Evento[];
  onDia: (d: string) => void;
  onHora: (h: string) => void;
  onDuracao: (m: number) => void;
}) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400">Dia</legend>
        <div role="radiogroup" aria-label="Dia" className="grid grid-cols-7 gap-1">
          {dias.map((d) => {
            const valor = paraDataLocal(d);
            const marcado = valor === dia;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={marcado}
                aria-label={formatar(d, "EEEE, d 'de' MMMM")}
                onClick={() => onDia(valor)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl text-sm ${
                  marcado
                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                    : 'bg-neutral-200/70 active:bg-neutral-300 dark:bg-neutral-800 dark:active:bg-neutral-700'
                }`}
              >
                <span className={`text-[11px] uppercase ${marcado ? '' : valor === hoje ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70'}`}>
                  {diaCurto(d)}
                </span>
                <span className="font-semibold tabular-nums">{formatar(d, 'd')}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Horário">
          <input type="time" step={900} className={classeInput} value={hora} onChange={(e) => onHora(e.target.value)} required />
        </Campo>
        <Campo rotulo="Duração">
          <Stepper rotulo="Duração" valor={duracao} onChange={onDuracao} min={15} max={480} passo={15} formatar={(v) => `${v} min`} />
        </Campo>
      </div>

      {conflitos.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          <AlertTriangle size={18} className="mt-px shrink-0" aria-hidden />
          Conflita com {conflitos.map((c) => c.titulo).join(', ')} (horário fixo).
        </p>
      )}
    </div>
  );
}

/** Minutos desde 00:00 a partir de "HH:MM". */
export const minutosDe = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
