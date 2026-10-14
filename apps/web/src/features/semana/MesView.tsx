import {
  ativo,
  combinarDataHora,
  compromissosDeHoje,
  diaCurto,
  expandirEventos,
  formatar,
  gradeDoMes,
  inicioDoDiaApos,
  paraDataLocal,
  rotuloDia,
  type Atividade,
  type Calendario,
  type Compromisso,
  type Evento,
  type ISODate,
  type Pessoa,
  type Sessao,
} from '@rumo/core';
import { CalendarDays } from 'lucide-react';
import { Botao } from '../../components/ui/Botao';
import { ListaCompromissos } from '../hoje/Compromissos';

const MAX_MARCAS = 3;

interface Marca {
  cor: string;
  feito: boolean;
}

/**
 * Visão de mês: grade com marcas coloridas por dia (eventos em cinza, sessões na cor
 * da atividade) e, embaixo, a lista do dia selecionado.
 */
export function MesView({
  referencia,
  selecionado,
  agora,
  cal,
  eventos,
  sessoes,
  atividades,
  pessoas,
  onSelecionar,
  onAbrir,
  onVerSemana,
}: {
  referencia: Date;
  selecionado: ISODate;
  agora: Date;
  cal: Calendario;
  eventos: Evento[];
  sessoes: Sessao[];
  atividades: Map<string, Atividade>;
  pessoas: Pessoa[];
  onSelecionar: (d: ISODate) => void;
  onAbrir: (c: Compromisso) => void;
  onVerSemana: (d: ISODate) => void;
}) {
  const grade = gradeDoMes(referencia, cal);
  const primeiro = grade.semanas[0]![0]!.data;
  const ultimo = grade.semanas.at(-1)!.at(-1)!.data;
  const ini = combinarDataHora(primeiro, '00:00');
  const fim = inicioDoDiaApos(combinarDataHora(ultimo, '12:00'), 1);
  const hoje = paraDataLocal(agora);

  // Marcas por dia: ocorrências de eventos que tocam o dia e sessões que começam nele.
  const marcas = new Map<ISODate, Marca[]>();
  const marcar = (d: ISODate, m: Marca) => marcas.set(d, [...(marcas.get(d) ?? []), m]);
  for (const e of expandirEventos(eventos, ini, fim)) {
    // Do dia do início ao dia do fim (fim exclusivo: 22:00–00:00 marca só o primeiro dia).
    const ultimoDia = paraDataLocal(new Date(Math.max(new Date(e.fim).getTime() - 1, new Date(e.inicio).getTime())));
    for (let d = paraDataLocal(e.inicio); d <= ultimoDia; d = paraDataLocal(inicioDoDiaApos(combinarDataHora(d, '12:00'), 1))) {
      marcar(d, { cor: e.fixo ? '#737373' : '#a3a3a3', feito: false });
    }
  }
  for (const s of sessoes) {
    const a = atividades.get(s.atividadeId);
    if (!ativo(s) || !a || s.inicio < ini.toISOString() || s.inicio >= fim.toISOString()) continue;
    marcar(paraDataLocal(s.inicio), { cor: a.cor, feito: s.origem === 'registrada' });
  }

  const doDia = compromissosDeHoje({ eventos, sessoes, atividades: [...atividades.values()] }, combinarDataHora(selecionado, '12:00'));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
      <div role="grid" aria-label={formatar(referencia, "MMMM 'de' yyyy")} className="select-none">
        <div role="row" className="grid grid-cols-7 pb-1">
          {grade.semanas[0]!.map((d) => (
            <span key={d.data} role="columnheader" className="text-center text-[11px] font-medium text-neutral-500 uppercase">
              {diaCurto(combinarDataHora(d.data, '12:00'))}
            </span>
          ))}
        </div>
        {grade.semanas.map((semana) => (
          <div key={semana[0]!.data} role="row" className="grid grid-cols-7 border-t border-black/5 dark:border-white/10">
            {semana.map((d) => {
              const lista = marcas.get(d.data) ?? [];
              const ehHoje = d.data === hoje;
              const marcado = d.data === selecionado;
              return (
                <button
                  key={d.data}
                  type="button"
                  role="gridcell"
                  aria-selected={marcado}
                  aria-label={`${formatar(combinarDataHora(d.data, '12:00'), "EEEE, d 'de' MMMM")}${lista.length ? `, ${lista.length} ${lista.length === 1 ? 'item' : 'itens'}` : ''}`}
                  data-data={d.data}
                  onClick={() => onSelecionar(d.data)}
                  className={`flex min-h-14 flex-col items-center gap-1 pt-1.5 pb-1 ${d.doMes ? '' : 'opacity-40'} ${
                    marcado ? 'rounded-xl bg-indigo-500/10' : ''
                  }`}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full text-[15px] tabular-nums ${
                      ehHoje ? 'bg-indigo-600 font-semibold text-white dark:bg-indigo-500' : marcado ? 'font-semibold text-indigo-700 dark:text-indigo-300' : ''
                    }`}
                  >
                    {Number(d.data.slice(8))}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                    {lista.slice(0, MAX_MARCAS).map((m, i) => (
                      <span key={i} className={`size-1.5 rounded-full ${m.feito ? 'opacity-40' : ''}`} style={{ backgroundColor: m.cor }} />
                    ))}
                    {lista.length > MAX_MARCAS && <span className="text-[9px] leading-none text-neutral-500">+</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className="mt-4" aria-label={`Dia selecionado: ${rotuloDia(selecionado, agora)}`}>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="text-[15px] font-semibold">{rotuloDia(selecionado, agora)}</h2>
          <Botao variante="fantasma" className="px-2 text-indigo-600 dark:text-indigo-400" onClick={() => onVerSemana(selecionado)}>
            <CalendarDays size={18} /> Ver na semana
          </Botao>
        </div>
        {doDia.length ? (
          <ListaCompromissos itens={doDia} pessoas={pessoas} onAbrir={onAbrir} />
        ) : (
          <p className="px-1 text-sm text-neutral-500">Nada marcado neste dia.</p>
        )}
      </section>
    </div>
  );
}
