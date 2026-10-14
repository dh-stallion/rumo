import { formatar, paraDataLocal } from '@rumo/core';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { HORA_PX, LARGURA_HORAS, minParaPx } from './geometria';

export type ModoGrade = 'tres' | 'semana';

const HORAS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Grade da semana: 7 colunas de dia numa área que rola nas duas direções, com
 * cabeçalho e coluna de horas fixos. No modo "tres", cada coluna ocupa ⅓ da largura
 * e a rolagem horizontal encaixa por dia (scroll-snap); em telas largas e no modo
 * "semana", as 7 colunas cabem na tela.
 */
export function GradeSemanal({
  dias,
  agora,
  modo,
  refRolagem,
  renderDia,
}: {
  dias: Date[];
  agora: Date;
  modo: ModoGrade;
  refRolagem?: RefObject<HTMLDivElement | null>;
  renderDia: (dia: Date, indice: number) => ReactNode;
}) {
  const proprio = useRef<HTMLDivElement>(null);
  const rolagem = refRolagem ?? proprio;
  const hoje = paraDataLocal(agora);
  const chaveSemana = paraDataLocal(dias[0]!);
  const jaRolouVertical = useRef(false);

  // Ao abrir (e ao trocar de semana): hoje como primeira coluna visível, manhã à vista.
  useLayoutEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const colunaHoje = el.querySelector<HTMLElement>('[data-hoje="true"]');
    el.scrollLeft = colunaHoje ? colunaHoje.offsetLeft - LARGURA_HORAS : 0;
    if (!jaRolouVertical.current) {
      el.scrollTop = 7 * HORA_PX - 8;
      jaRolouVertical.current = true;
    }
  }, [chaveSemana, modo]);

  const largura =
    modo === 'semana'
      ? '[--col:calc((100cqw_-_44px)/7)]'
      : '[--col:calc((100cqw_-_44px)/3)] md:[--col:calc((100cqw_-_44px)/7)]';

  return (
    <div
      ref={rolagem}
      data-grade
      className="relative min-h-0 flex-1 overflow-auto overscroll-contain [container-type:inline-size] [scroll-padding-left:44px] [scroll-snap-type:x_mandatory]"
    >
      <div className={`grid w-max ${largura}`} style={{ gridTemplateColumns: `${LARGURA_HORAS}px repeat(7, var(--col))` }}>
        {/* Cabeçalho: canto + dias */}
        <div className="sticky top-0 left-0 z-30 bg-neutral-50 dark:bg-neutral-950" />
        {dias.map((d) => {
          const ehHoje = paraDataLocal(d) === hoje;
          return (
            <div
              key={d.toISOString()}
              className="sticky top-0 z-20 flex snap-start flex-col items-center border-b border-black/5 bg-neutral-50 py-1 dark:border-white/10 dark:bg-neutral-950"
            >
              <span className={`text-[11px] font-medium uppercase ${ehHoje ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-500'}`}>
                {formatar(d, 'EEE').replace('.', '')}
              </span>
              <span
                className={`grid size-7 place-items-center rounded-full text-[15px] font-semibold tabular-nums ${
                  ehHoje ? 'bg-indigo-600 text-white dark:bg-indigo-500' : ''
                }`}
              >
                {formatar(d, 'd')}
              </span>
            </div>
          );
        })}

        {/* Coluna de horas */}
        <div className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-950" style={{ height: 24 * HORA_PX }} aria-hidden>
          {HORAS.slice(1).map((h) => (
            <span
              key={h}
              className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-neutral-400"
              style={{ top: minParaPx(h * 60) }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {dias.map((d, i) => (
          <div key={d.toISOString()} className="snap-start" data-dia={paraDataLocal(d)} data-hoje={paraDataLocal(d) === hoje}>
            {renderDia(d, i)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fundo da coluna: linhas de hora e, em hoje, destaque e linha do "agora". */
export function FundoDia({ dia, agora, children }: { dia: Date; agora: Date; children?: ReactNode }) {
  const ehHoje = paraDataLocal(dia) === paraDataLocal(agora);
  const minutosAgora = (agora.getTime() - dia.getTime()) / 60_000;
  return (
    <div
      className={`relative border-l border-black/5 dark:border-white/10 ${ehHoje ? 'bg-indigo-500/[0.04]' : ''}`}
      style={{
        height: 24 * HORA_PX,
        backgroundImage: 'linear-gradient(to bottom, var(--linha-grade) 1px, transparent 1px)',
        backgroundSize: `100% ${HORA_PX}px`,
      }}
    >
      {children}
      {ehHoje && minutosAgora >= 0 && minutosAgora < 1440 && (
        <div className="pointer-events-none absolute inset-x-0 z-[3] h-0.5 bg-red-500" style={{ top: minParaPx(minutosAgora) }} aria-hidden>
          <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}
