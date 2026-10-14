import { combinarDataHora, formatar, formatarReais, formatarReaisCurto, type ProgressoMeta as Progresso } from '@rumo/core';

/** Barra e números da meta. `compacto` para listas; completo na página da meta. */
export function ProgressoMeta({ p, prazo, compacto = false }: { p: Progresso; prazo: string; compacto?: boolean }) {
  const quando = formatar(combinarDataHora(prazo, '12:00'), compacto ? "MMM 'de' yyyy" : "d 'de' MMMM 'de' yyyy");
  const situacao = p.concluida
    ? 'Meta atingida'
    : p.vencida
      ? `Prazo passou · faltam ${formatarReais(p.faltam)}`
      : `Guarde ${formatarReais(p.aporteMensal)}/mês · ${formatarReais(p.aporteSemanal)}/semana`;
  return (
    <div className="space-y-2" data-progresso-meta>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${compacto ? 'text-[15px]' : 'text-2xl'} font-semibold tabular-nums`}>{formatarReaisCurto(p.atual)}</span>
        <span className="text-sm text-neutral-500 tabular-nums">de {formatarReaisCurto(p.alvo)}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso da meta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.percentual * 100)}
        className="h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      >
        <div
          className={`h-full rounded-full ${p.concluida ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-indigo-500'}`}
          style={{ width: `${Math.max(p.percentual * 100, p.atual > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className={`text-sm ${p.vencida ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-600 dark:text-neutral-400'}`} data-situacao>
        {situacao}
      </p>
      <p className="text-xs text-neutral-500">
        até {quando}
        {!p.concluida && !p.vencida && !compacto && ` · ${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mês' : 'meses'}, ${p.semanasRestantes} ${p.semanasRestantes === 1 ? 'semana' : 'semanas'}`}
        {!p.concluida && !p.vencida && (p.noRitmo ? ' · no ritmo' : ` · ${formatarReais(p.esperadoHoje - p.atual)} abaixo do ritmo`)}
      </p>
    </div>
  );
}
