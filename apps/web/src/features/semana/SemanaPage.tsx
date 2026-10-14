import {
  ativo,
  conflitosComFixos,
  formatar,
  inicioDaSemana,
  inicioDoDiaApos,
  paraDataLocal,
  type Atividade,
  type Evento,
  type Sessao,
} from '@rumo/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { Sheet } from '../../components/ui/Sheet';
import { db } from '../../db/db';
import { useCalendario } from '../../db/preferencias';
import { useLista } from '../../db/repo';
import { EventoForm } from '../agenda/EventoForm';
import { BlocoEvento, BlocoSessao } from './Blocos';
import { blocosDoDia } from './geometria';
import { FundoDia, GradeSemanal } from './GradeSemanal';

/** "12 – 18 de outubro" ou "28 de setembro – 4 de outubro". */
function rotuloSemana(inicio: Date): string {
  const fim = inicioDoDiaApos(inicio, 6);
  return formatar(inicio, 'MM') === formatar(fim, 'MM')
    ? `${formatar(inicio, 'd')} – ${formatar(fim, "d 'de' MMMM")}`
    : `${formatar(inicio, "d 'de' MMMM")} – ${formatar(fim, "d 'de' MMMM")}`;
}

export function SemanaPage() {
  const agora = useAgora();
  const cal = useCalendario();
  const atividades = useLista(db.atividades);
  const sessoes = useLista(db.sessoes);
  const eventos = useLista(db.eventos);
  const pessoas = useLista(db.pessoas);
  const [deslocamento, setDeslocamento] = useState(0);
  const [editandoEvento, setEditandoEvento] = useState<Evento | 'novo' | null>(null);

  const inicio = inicioDoDiaApos(inicioDaSemana(agora, cal), deslocamento * 7);
  const chave = paraDataLocal(inicio);
  // Recalcula só quando a semana muda (o "agora" anda a cada minuto).
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => inicioDoDiaApos(inicio, i)), [chave]);
  const porId = useMemo(() => new Map((atividades ?? []).map((a) => [a.id, a])), [atividades]);
  const ehEstaSemana = deslocamento === 0;

  return (
    <div className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col pt-[env(safe-area-inset-top)]">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-500">{rotuloSemana(inicio)}</p>
            <h1 className="text-3xl font-bold tracking-tight">Semana</h1>
          </div>
          <Botao variante="primario" className="px-3" aria-label="Novo evento" onClick={() => setEditandoEvento('novo')}>
            <Plus size={20} /> Evento
          </Botao>
        </div>
        <nav className="mt-2 flex items-center gap-1" aria-label="Navegar entre semanas">
          <Botao variante="fantasma" className="px-2" aria-label="Semana anterior" onClick={() => setDeslocamento((d) => d - 1)}>
            <ChevronLeft size={22} />
          </Botao>
          <Botao variante="fantasma" className="px-3" disabled={ehEstaSemana} onClick={() => setDeslocamento(0)}>
            Hoje
          </Botao>
          <Botao variante="fantasma" className="px-2" aria-label="Semana seguinte" onClick={() => setDeslocamento((d) => d + 1)}>
            <ChevronRight size={22} />
          </Botao>
        </nav>
      </header>

      {atividades && sessoes && eventos && (
        <GradeSemanal
          dias={dias}
          agora={agora}
          modo="tres"
          renderDia={(dia) => (
            <ConteudoDia
              dia={dia}
              agora={agora}
              eventos={eventos}
              sessoes={sessoes}
              atividades={porId}
              onAbrirEvento={setEditandoEvento}
            />
          )}
        />
      )}

      <Sheet
        aberto={editandoEvento !== null}
        onFechar={() => setEditandoEvento(null)}
        titulo={editandoEvento === 'novo' ? 'Novo evento' : 'Editar evento'}
      >
        {editandoEvento !== null && pessoas && (
          <EventoForm
            key={editandoEvento === 'novo' ? 'novo' : editandoEvento.id}
            evento={editandoEvento === 'novo' ? undefined : editandoEvento}
            sugestao={ehEstaSemana ? undefined : inicio}
            pessoas={pessoas}
            onFechar={() => setEditandoEvento(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

function ConteudoDia({
  dia,
  agora,
  eventos,
  sessoes,
  atividades,
  onAbrirEvento,
}: {
  dia: Date;
  agora: Date;
  eventos: Evento[];
  sessoes: Sessao[];
  atividades: Map<string, Atividade>;
  onAbrirEvento: (e: Evento) => void;
}) {
  const blocosEventos = blocosDoDia(eventos.filter(ativo), dia);
  const blocosSessoes = blocosDoDia(
    sessoes.filter((s) => ativo(s) && atividades.get(s.atividadeId)),
    dia,
  );
  return (
    <FundoDia dia={dia} agora={agora}>
      {blocosEventos.map((b) => (
        <BlocoEvento key={b.item.id} bloco={b} onAbrir={onAbrirEvento} />
      ))}
      {blocosSessoes.map((b) => (
        <BlocoSessao key={b.item.id} bloco={b} atividade={atividades.get(b.item.atividadeId)!} conflitos={conflitosComFixos(b.item, eventos)} />
      ))}
    </FundoDia>
  );
}
