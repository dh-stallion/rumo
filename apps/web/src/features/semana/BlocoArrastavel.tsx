import { useDraggable } from '@dnd-kit/core';
import { diaCurto, duracaoMin, paraHoraLocal, type Afazer, type Evento, type Intervalo, type Sessao } from '@rumo/core';
import { AlertTriangle } from 'lucide-react';
import type { DadosArraste } from './arraste';
import { BlocoSessao } from './Blocos';
import { ALTURA_MINIMA_BLOCO, minParaPx, type BlocoNoDia } from './geometria';

/** Bloco de sessão que se move com toque longo; planejadas têm alça para mudar a duração. */
export function BlocoSessaoArrastavel({
  bloco,
  afazer,
  conflitos,
  onAbrir,
  movendo,
  redimensionando,
}: {
  bloco: BlocoNoDia<Sessao>;
  afazer: Afazer;
  conflitos: Evento[];
  onAbrir: (s: Sessao) => void;
  /** Esta sessão está sendo movida (o original fica esmaecido). */
  movendo: boolean;
  /** Prévia da nova duração durante o redimensionamento. */
  redimensionando: Intervalo | null;
}) {
  const s = bloco.item;
  const planejada = s.origem === 'planejada';
  const mover: DadosArraste = { tipo: 'sessao', afazer, sessao: s };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `sessao:${s.id}`, data: mover, disabled: !planejada });
  const alturaPrevia = redimensionando
    ? Math.max(minParaPx(duracaoMin(redimensionando)), ALTURA_MINIMA_BLOCO)
    : undefined;

  return (
    <BlocoSessao
      bloco={bloco}
      afazer={afazer}
      conflitos={conflitos}
      onAbrir={onAbrir}
      fantasma={movendo}
      estilo={alturaPrevia ? { height: alturaPrevia, zIndex: 5 } : undefined}
      refArraste={setNodeRef}
      propsArraste={planejada ? { ...attributes, ...listeners, 'aria-roledescription': 'bloco arrastável', onContextMenu: (e) => e.preventDefault() } : undefined}
    >
      {redimensionando && (
        <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums dark:bg-white dark:text-neutral-900">
          até {paraHoraLocal(redimensionando.fim)}
        </span>
      )}
      {planejada && minParaPx(bloco.fimMin - bloco.inicioMin) >= 28 && <AlcaRedimensionar sessao={s} afazer={afazer} />}
    </BlocoSessao>
  );
}

function AlcaRedimensionar({ sessao, afazer }: { sessao: Sessao; afazer: Afazer }) {
  const dados: DadosArraste = { tipo: 'redim', afazer, sessao };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `redim:${sessao.id}`, data: dados });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-bloco="alca"
      {...attributes}
      {...listeners}
      aria-roledescription="alça de redimensionar"
      aria-label={`Mudar duração de ${afazer.nome}`}
      onContextMenu={(e) => e.preventDefault()}
      className="arrastavel absolute -bottom-3 left-1/2 z-[3] flex h-6 w-11 -translate-x-1/2 items-center justify-center"
    >
      <span className="h-1.5 w-7 rounded-full border border-white/70 bg-neutral-500/80 dark:bg-neutral-300/80" aria-hidden />
    </button>
  );
}

/** Prévia que segue o dedo durante o arraste, com o horário de destino. */
export function PreviaArraste({
  afazer,
  duracao,
  alvo,
  largura,
}: {
  afazer: Afazer;
  duracao: number;
  alvo: { intervalo: Intervalo; conflitos: Evento[] } | null;
  largura: number;
}) {
  const conflito = !!alvo?.conflitos.length;
  return (
    <div
      style={{
        width: largura,
        height: Math.max(minParaPx(duracao), ALTURA_MINIMA_BLOCO),
        backgroundColor: `${afazer.cor}cc`,
        borderLeftColor: afazer.cor,
      }}
      className={`arrastavel overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-xs leading-tight text-white shadow-xl ${
        conflito ? 'ring-2 ring-red-500' : 'ring-1 ring-black/10'
      }`}
      data-previa
    >
      <span className="flex items-center gap-1 font-semibold">
        {conflito && <AlertTriangle size={11} aria-hidden />}
        <span className="truncate">{afazer.nome}</span>
      </span>
      <span className="block truncate tabular-nums" data-previa-horario>
        {alvo ? `${diaCurto(alvo.intervalo.inicio)} ${paraHoraLocal(alvo.intervalo.inicio)}` : 'solte na grade'}
      </span>
    </div>
  );
}
