import {
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import {
  combinarDataHora,
  conflitosComFixos,
  duracaoMin,
  paraDataLocal,
  posicionarNoDia,
  redimensionar,
  type Atividade,
  type Evento,
  type Intervalo,
  type Sessao,
} from '@rumo/core';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { LARGURA_HORAS, pxParaMin } from './geometria';

/**
 * Toque longo para começar a arrastar: com o dedo parado por 250ms (tolerância de 8px).
 * Se o dedo se mexer antes disso, é rolagem normal. Sem sensor de teclado: quem usa
 * teclado ou leitor de tela agenda pelo fluxo sem arrastar (folhas de agendar/editar).
 */
export function useSensoresDeArraste() {
  return useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
  );
}

/** Distância do topo da prévia até o dedo, ao arrastar do banco. */
export const ALCA_Y = 10;

/** Prévia do banco: centrada no dedo na horizontal e logo abaixo dele na vertical. */
export const alinharAoDedo: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  const p = getEventCoordinates(activatorEvent);
  if (!p) return transform;
  return {
    ...transform,
    x: transform.x + p.x - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + p.y - draggingNodeRect.top - ALCA_Y,
  };
};

export type DadosArraste =
  | { tipo: 'banco'; atividade: Atividade }
  | { tipo: 'sessao'; atividade: Atividade; sessao: Sessao }
  | { tipo: 'redim'; atividade: Atividade; sessao: Sessao };

export interface Alvo {
  dia: string;
  intervalo: Intervalo;
  conflitos: Evento[];
}

export interface ResultadoArraste {
  dados: DadosArraste;
  alvo: Alvo;
}

const BORDA = 36;
const VELOCIDADE = 10;

/**
 * Liga o dnd-kit à grade: acompanha o dedo, rola a grade nas bordas, calcula o
 * dia e horário de destino e devolve o resultado ao soltar.
 */
export function useArrasteNaGrade({
  grade,
  eventos,
  onSoltar,
}: {
  grade: RefObject<HTMLDivElement | null>;
  eventos: Evento[];
  onSoltar: (r: ResultadoArraste) => void;
}) {
  const [ativo, setAtivo] = useState<DadosArraste | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const dedo = useRef({ x: 0, y: 0 });
  const offsetY = useRef(0);
  const alvoAtual = useRef<Alvo | null>(null);
  const dadosAtuais = useRef<DadosArraste | null>(null);
  const eventosRef = useRef(eventos);
  eventosRef.current = eventos;
  const ultimoArraste = useRef(-Infinity);

  function calcularAlvo(): Alvo | null {
    const el = grade.current;
    const dados = dadosAtuais.current;
    if (!el || !dados) return null;
    const g = el.getBoundingClientRect();
    const { x, y } = dedo.current;

    if (dados.tipo === 'redim') {
      const col = el.querySelector<HTMLElement>(`[data-dia="${paraDataLocal(dados.sessao.inicio)}"]`);
      if (!col) return null;
      const r = col.getBoundingClientRect();
      const fimMin = pxParaMin(y - r.top);
      const inicioMin = (new Date(dados.sessao.inicio).getTime() - combinarDataHora(paraDataLocal(dados.sessao.inicio), '00:00').getTime()) / 60_000;
      const intervalo = redimensionar(dados.sessao, fimMin - inicioMin);
      return { dia: paraDataLocal(dados.sessao.inicio), intervalo, conflitos: conflitosComFixos(intervalo, eventosRef.current) };
    }

    if (x < g.left + LARGURA_HORAS || x > g.right || y < g.top || y > g.bottom) return null;
    const col = [...el.querySelectorAll<HTMLElement>('[data-dia]')].find((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    if (!col) return null;
    const r = col.getBoundingClientRect();
    const dia = col.dataset.dia!;
    const minuto = pxParaMin(y - offsetY.current - r.top);
    const duracao = dados.tipo === 'banco' ? dados.atividade.duracaoPadraoMin : duracaoMin(dados.sessao);
    const intervalo = posicionarNoDia(combinarDataHora(dia, '12:00'), minuto, duracao);
    return { dia, intervalo, conflitos: conflitosComFixos(intervalo, eventosRef.current) };
  }

  // Enquanto arrasta: acompanha o dedo, rola nas bordas e atualiza o destino.
  useEffect(() => {
    if (!ativo) return;
    const el = grade.current;
    if (el) el.style.scrollSnapType = 'none'; // o encaixe brigaria com a rolagem automática
    const mover = (e: TouchEvent | MouseEvent) => {
      const p = 'touches' in e ? e.touches[0] : e;
      if (p) dedo.current = { x: p.clientX, y: p.clientY };
    };
    window.addEventListener('touchmove', mover, { passive: true, capture: true });
    window.addEventListener('mousemove', mover, { passive: true, capture: true });
    let quadro = 0;
    const passo = () => {
      if (el && ativo.tipo !== 'redim') {
        const g = el.getBoundingClientRect();
        const { x, y } = dedo.current;
        const dentroY = y > g.top && y < g.bottom + 40;
        if (dentroY && x < g.left + LARGURA_HORAS + BORDA) el.scrollLeft -= VELOCIDADE;
        else if (dentroY && x > g.right - BORDA) el.scrollLeft += VELOCIDADE;
      }
      if (el) {
        const g = el.getBoundingClientRect();
        const y = dedo.current.y;
        if (y < g.top + 48 + BORDA && y > g.top - 40) el.scrollTop -= VELOCIDADE;
        else if (y > g.bottom - BORDA && y < g.bottom + 40) el.scrollTop += VELOCIDADE;
      }
      const novo = calcularAlvo();
      const antes = alvoAtual.current;
      if (novo?.intervalo.inicio !== antes?.intervalo.inicio || novo?.intervalo.fim !== antes?.intervalo.fim) {
        alvoAtual.current = novo;
        setAlvo(novo);
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('touchmove', mover, { capture: true });
      window.removeEventListener('mousemove', mover, { capture: true });
      if (el) el.style.scrollSnapType = '';
    };
    // Só reinicia quando começa/termina um arraste; o resto é lido por refs a cada quadro.
  }, [ativo]);

  function limpar() {
    dadosAtuais.current = null;
    alvoAtual.current = null;
    setAtivo(null);
    setAlvo(null);
  }

  return {
    ativo,
    alvo,
    /** true logo depois de um arraste: o toque que termina o arraste não deve abrir folhas. */
    acabouDeArrastar: () => performance.now() - ultimoArraste.current < 400,
    onDragStart(e: DragStartEvent) {
      const dados = e.active.data.current as DadosArraste;
      const p = getEventCoordinates(e.activatorEvent) ?? { x: 0, y: 0 };
      dedo.current = p;
      // O dnd-kit ainda não mediu o item neste momento (rect.initial vem nulo); medimos o bloco no DOM
      // para manter o ponto em que o dedo o pegou.
      const blocoEl = dados.tipo === 'sessao' ? document.querySelector(`[data-sessao="${dados.sessao.id}"]`) : null;
      offsetY.current = dados.tipo === 'banco' ? ALCA_Y : blocoEl ? p.y - blocoEl.getBoundingClientRect().top : 0;
      dadosAtuais.current = dados;
      setAtivo(dados);
    },
    onDragEnd(_e: DragEndEvent) {
      const dados = dadosAtuais.current;
      const final = calcularAlvo();
      limpar();
      ultimoArraste.current = performance.now();
      if (dados && final) onSoltar({ dados, alvo: final });
    },
    onDragCancel() {
      limpar();
    },
  };
}

