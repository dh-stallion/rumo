import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import {
  ativo,
  chaveEvento,
  conflitosComFixos,
  expandirEventos,
  diaCurto,
  duracaoMin,
  formatar,
  inicioDaSemana,
  inicioDoDiaApos,
  paraDataLocal,
  type Atividade,
  type Evento,
  type EventoNaAgenda,
  type Sessao,
} from '@rumo/core';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useMemo, useRef, useState } from 'react';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { moverSessao, planejarSessao } from '../../db/acoes';
import { db } from '../../db/db';
import { useCalendario } from '../../db/preferencias';
import { useLista } from '../../db/repo';
import { EventoForm } from '../agenda/EventoForm';
import { AgendarSheet } from './AgendarSheet';
import { alinharAoDedo, useArrasteNaGrade, useSensoresDeArraste, type Alvo, type DadosArraste, type ResultadoArraste } from './arraste';
import { BancoAfazeres } from './BancoAfazeres';
import { BlocoEvento } from './Blocos';
import { BlocoSessaoArrastavel, PreviaArraste } from './BlocoArrastavel';
import { blocosDoDia } from './geometria';
import { FundoDia, GradeSemanal } from './GradeSemanal';
import { SessaoSheet } from './SessaoSheet';

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
  const toast = useToast();
  const atividades = useLista(db.atividades);
  const sessoes = useLista(db.sessoes);
  const eventos = useLista(db.eventos);
  const pessoas = useLista(db.pessoas);
  const [deslocamento, setDeslocamento] = useState(0);
  // Visão de 7 colunas em tela cheia ("Planejar a semana"); na URL para Hoje poder abrir direto.
  const [params, setParams] = useSearchParams();
  const telaCheia = params.get('planejar') === '1';
  const [editandoEvento, setEditandoEvento] = useState<EventoNaAgenda | 'novo' | null>(null);
  const [agendando, setAgendando] = useState<Atividade | null>(null);
  const [sessaoAberta, setSessaoAberta] = useState<string | null>(null);
  const [bancoAberto, setBancoAberto] = useState(false);
  const [larguraColuna, setLarguraColuna] = useState(100);
  const grade = useRef<HTMLDivElement>(null);
  const sensores = useSensoresDeArraste();

  const inicio = inicioDoDiaApos(inicioDaSemana(agora, cal), deslocamento * 7);
  const chave = paraDataLocal(inicio);
  // Recalcula só quando a semana muda (o "agora" anda a cada minuto).
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => inicioDoDiaApos(inicio, i)), [chave]);
  const porId = useMemo(() => new Map((atividades ?? []).map((a) => [a.id, a])), [atividades]);
  const ehEstaSemana = deslocamento === 0;

  async function soltar({ dados, alvo }: ResultadoArraste) {
    const quando = `${diaCurto(alvo.intervalo.inicio)} ${formatar(alvo.intervalo.inicio, 'HH:mm')}`;
    const aviso = alvo.conflitos.length ? ` · conflito com ${alvo.conflitos.map((c) => c.titulo).join(', ')}` : '';
    if (dados.tipo === 'banco') {
      const { desfazer } = await planejarSessao(dados.atividade, alvo.intervalo);
      setBancoAberto(false); // deixa o resultado à vista; reabrir é um toque
      toast({ texto: `${dados.atividade.nome}: ${quando}${aviso}`, acao: { rotulo: 'Desfazer', fn: desfazer } });
      return;
    }
    if (alvo.intervalo.inicio === dados.sessao.inicio && alvo.intervalo.fim === dados.sessao.fim) return;
    const desfazer = await moverSessao(dados.sessao, alvo.intervalo);
    const texto =
      dados.tipo === 'redim' ? `${dados.atividade.nome}: ${duracaoMin(alvo.intervalo)} min` : `${dados.atividade.nome}: ${quando}`;
    toast({ texto: `${texto}${aviso}`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  const arraste = useArrasteNaGrade({ grade, eventos: eventos ?? [], onSoltar: soltar });

  return (
    <div
      className={
        telaCheia
          ? 'fixed inset-0 z-[35] flex flex-col bg-neutral-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] dark:bg-neutral-950'
          : 'flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col pt-[env(safe-area-inset-top)]'
      }
    >
      <header className={telaCheia ? 'px-3 pt-2 pb-1' : 'px-4 pt-3 pb-2'}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-500">{rotuloSemana(inicio)}</p>
            <h1 className={`font-bold tracking-tight ${telaCheia ? 'text-2xl' : 'text-3xl'}`}>
              {telaCheia ? 'Planejar a semana' : 'Semana'}
            </h1>
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
          <Botao
            variante="secundario"
            className="ml-auto px-3"
            aria-pressed={telaCheia}
            onClick={() => setParams(telaCheia ? {} : { planejar: '1' }, { replace: true })}
          >
            {telaCheia ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            {telaCheia ? 'Ver 3 dias' : 'Ver semana toda'}
          </Botao>
        </nav>
      </header>

      <DndContext
        sensors={sensores}
        collisionDetection={pointerWithin}
        autoScroll={false}
        onDragStart={(e) => {
          setLarguraColuna(grade.current?.querySelector<HTMLElement>('[data-dia]')?.offsetWidth ?? 100);
          arraste.onDragStart(e);
        }}
        onDragEnd={arraste.onDragEnd}
        onDragCancel={arraste.onDragCancel}
      >
        {atividades && sessoes && eventos ? (
          <GradeSemanal
            dias={dias}
            agora={agora}
            modo={telaCheia ? 'semana' : 'tres'}
            refRolagem={grade}
            renderDia={(dia) => (
              <ConteudoDia
                dia={dia}
                agora={agora}
                eventos={eventos}
                sessoes={sessoes}
                atividades={porId}
                ativo={arraste.ativo}
                alvo={arraste.alvo}
                onAbrirEvento={(e) => !arraste.acabouDeArrastar() && setEditandoEvento(e)}
                onAbrirSessao={(s) => !arraste.acabouDeArrastar() && setSessaoAberta(s.id)}
              />
            )}
          />
        ) : (
          <div className="flex-1" />
        )}

        <BancoAfazeres
          atividades={atividades ?? []}
          sessoes={sessoes ?? []}
          inicioSemana={inicio}
          aberto={bancoAberto}
          arrastando={arraste.ativo?.tipo === 'banco'}
          onAlternar={() => setBancoAberto((a) => !a)}
          onEscolher={setAgendando}
          acabouDeArrastar={arraste.acabouDeArrastar}
        />

        <DragOverlay dropAnimation={null} modifiers={arraste.ativo?.tipo === 'banco' ? [alinharAoDedo] : []}>
          {arraste.ativo && arraste.ativo.tipo !== 'redim' && (
            <PreviaArraste
              atividade={arraste.ativo.atividade}
              duracao={arraste.ativo.tipo === 'banco' ? arraste.ativo.atividade.duracaoPadraoMin : duracaoMin(arraste.ativo.sessao)}
              alvo={arraste.alvo}
              largura={larguraColuna - 4}
            />
          )}
        </DragOverlay>
      </DndContext>

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

      <Sheet aberto={agendando !== null} onFechar={() => setAgendando(null)} titulo={agendando ? `Agendar ${agendando.nome}` : 'Agendar'}>
        {agendando && <AgendarSheet key={agendando.id} atividade={agendando} dias={dias} agora={agora} onFechar={() => setAgendando(null)} />}
      </Sheet>

      <SessaoSheet sessaoId={sessaoAberta} onFechar={() => setSessaoAberta(null)} />
    </div>
  );
}

function ConteudoDia({
  dia,
  agora,
  eventos,
  sessoes,
  atividades,
  ativo: emArraste,
  alvo,
  onAbrirEvento,
  onAbrirSessao,
}: {
  dia: Date;
  agora: Date;
  eventos: Evento[];
  sessoes: Sessao[];
  atividades: Map<string, Atividade>;
  ativo: DadosArraste | null;
  alvo: Alvo | null;
  onAbrirEvento: (e: EventoNaAgenda) => void;
  onAbrirSessao: (s: Sessao) => void;
}) {
  // Eventos e sessões dividem as faixas juntos: um conflito aparece lado a lado, não sobreposto.
  const blocos = blocosDoDia<EventoNaAgenda | Sessao>(
    [...expandirEventos(eventos, dia, inicioDoDiaApos(dia, 1)), ...sessoes.filter((s) => ativo(s) && atividades.get(s.atividadeId))],
    dia,
  );
  const idArrastado = emArraste && emArraste.tipo !== 'banco' ? emArraste.sessao.id : null;
  return (
    <FundoDia dia={dia} agora={agora}>
      {blocos.map(({ item, ...b }) =>
        'titulo' in item ? (
          <BlocoEvento key={chaveEvento(item)} bloco={{ ...b, item }} onAbrir={onAbrirEvento} />
        ) : (
          <BlocoSessaoArrastavel
            key={item.id}
            bloco={{ ...b, item }}
            atividade={atividades.get(item.atividadeId)!}
            conflitos={conflitosComFixos(item, eventos)}
            onAbrir={onAbrirSessao}
            movendo={idArrastado === item.id && emArraste?.tipo === 'sessao'}
            redimensionando={idArrastado === item.id && emArraste?.tipo === 'redim' && alvo ? alvo.intervalo : null}
          />
        ),
      )}
    </FundoDia>
  );
}
