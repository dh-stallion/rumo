import {
  combinarDataHora,
  formatar,
  inicioDoDia,
  inicioDoDiaApos,
  paraDataLocal,
  paraHoraLocal,
  type Evento,
} from '@rumo/core';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Pagina, Secao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { db } from '../../db/db';
import { useLista } from '../../db/repo';
import { EventoForm } from './EventoForm';

export function AgendaPage() {
  const agora = useAgora();
  const eventos = useLista(db.eventos);
  const pessoas = useLista(db.pessoas);
  const [editando, setEditando] = useState<Evento | 'novo' | null>(null);

  const novo = (
    <Botao variante="primario" aria-label="Novo evento" className="px-3" onClick={() => setEditando('novo')}>
      <Plus size={20} /> Novo
    </Botao>
  );

  if (!eventos || !pessoas) return <Pagina titulo="Agenda" acao={novo}>{null}</Pagina>;

  const hoje = paraDataLocal(agora);
  const amanha = paraDataLocal(inicioDoDiaApos(agora, 1));
  const desdeHoje = inicioDoDia(agora).toISOString();
  const proximos = eventos.filter((e) => e.fim >= desdeHoje).sort((a, b) => a.inicio.localeCompare(b.inicio));

  const porDia = new Map<string, Evento[]>();
  for (const e of proximos) {
    // Evento que começou ontem e ainda não acabou fica agrupado em hoje.
    const dia = e.inicio < desdeHoje ? hoje : paraDataLocal(e.inicio);
    porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  }

  const rotuloDia = (dia: string) =>
    dia === hoje ? 'Hoje' : dia === amanha ? 'Amanhã' : formatar(combinarDataHora(dia, '12:00'), "EEEE, d 'de' MMMM");

  return (
    <Pagina titulo="Agenda" acao={novo}>
      {proximos.length === 0 && (
        <Vazio>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Nada marcado pela frente.</p>
          <p className="mt-1 text-sm">Compromissos fixos entram aqui e aparecem no dia em Hoje.</p>
        </Vazio>
      )}

      {[...porDia].map(([dia, lista]) => (
        <Secao key={dia} titulo={rotuloDia(dia)}>
          <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>
            {lista.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setEditando(e)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
                >
                  <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-neutral-500">
                    {paraHoraLocal(e.inicio)}–{paraHoraLocal(e.fim)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.titulo}</span>
                    {e.pessoaId && (
                      <span className="block truncate text-sm text-neutral-500">
                        com {pessoas.find((p) => p.id === e.pessoaId)?.nome ?? '—'}
                      </span>
                    )}
                  </span>
                  {e.fixo && <Lock size={16} className="shrink-0 text-neutral-400" aria-label="Fixo" />}
                </button>
              </li>
            ))}
          </ul>
        </Secao>
      ))}

      <Sheet
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === 'novo' ? 'Novo evento' : 'Editar evento'}
      >
        {editando !== null && (
          <EventoForm
            key={editando === 'novo' ? 'novo' : editando.id}
            evento={editando === 'novo' ? undefined : editando}
            pessoas={pessoas}
            onFechar={() => setEditando(null)}
          />
        )}
      </Sheet>
    </Pagina>
  );
}
