import {
  afazerDeAcao,
  ativo,
  combinarDataHora,
  formatar,
  formatarReais,
  inicioDaSemana,
  inicioDoDiaApos,
  marcoAtrasado,
  marcosEmOrdem,
  paraDataLocal,
  resumoProjeto,
  type AcaoProjeto,
  type Afazer,
  type ItemProjeto,
  type Marco,
  type Projeto,
} from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { plural } from '../../app/texto';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { CampoReais, Marcador } from '../../components/ui/CampoReais';
import { Campo, classeInput, Stepper } from '../../components/ui/Campos';
import { classeCartao, Pagina, Secao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';
import { useCalendario } from '../../db/preferencias';
import { adicionar, editar, remover } from '../../db/projetos';
import { useLista } from '../../db/repo';
import { AgendarSheet } from '../semana/AgendarSheet';
import { MetaDoProjeto } from './MetaDoProjeto';
import { ProjetoForm } from './ProjetoForm';

type Edicao =
  | { tipo: 'acao'; item?: AcaoProjeto }
  | { tipo: 'marco'; item?: Marco }
  | { tipo: 'item'; item?: ItemProjeto };

const VOLTAR = { para: '/planos', rotulo: 'Planos' };

export function ProjetoPage() {
  const { id } = useParams();
  const projeto = useLiveQuery(() => db.projetos.get(id ?? '').then((p) => p ?? null), [id]);
  if (projeto === undefined) return null;
  if (!projeto || !ativo(projeto)) {
    return (
      <Pagina titulo="Projeto" voltar={VOLTAR}>
        <Vazio>Este projeto não existe mais.</Vazio>
      </Pagina>
    );
  }
  return <ConteudoProjeto projeto={projeto} />;
}

function ConteudoProjeto({ projeto }: { projeto: Projeto }) {
  const toast = useToast();
  const agora = useAgora();
  const cal = useCalendario();
  const sessoes = useLista(db.sessoes) ?? [];
  const [editandoProjeto, setEditandoProjeto] = useState(false);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [agendando, setAgendando] = useState<Afazer | null>(null);
  const [novaAcao, setNovaAcao] = useState('');

  const resumo = resumoProjeto(projeto);
  const hoje = paraDataLocal(agora);
  const semana = inicioDaSemana(agora, cal);
  const dias = Array.from({ length: 7 }, (_, i) => inicioDoDiaApos(semana, i));
  const agendadas = (acaoId: string) =>
    sessoes.filter((s) => ativo(s) && s.origem === 'planejada' && s.acao?.acaoId === acaoId && s.fim >= agora.toISOString()).length;

  async function alternar<C extends 'acoes' | 'marcos' | 'itens'>(campo: C, itemId: string, mudancas: object, texto: string) {
    const desfazer = await editar(projeto.id, campo, itemId, mudancas);
    toast({ texto, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  async function adicionarAcao(e: FormEvent) {
    e.preventDefault();
    if (!novaAcao.trim()) return;
    await adicionar(projeto.id, 'acoes', { titulo: novaAcao.trim(), duracaoMin: 60, concluida: false });
    setNovaAcao('');
  }

  const abertas = projeto.acoes.filter((a) => !a.concluida);
  const feitas = projeto.acoes.filter((a) => a.concluida);

  return (
    <Pagina
      titulo={projeto.nome}
      subtitulo={projeto.arquivado ? 'Arquivado' : undefined}
      voltar={VOLTAR}
      acao={
        <Botao variante="fantasma" className="px-2" aria-label="Editar projeto" onClick={() => setEditandoProjeto(true)}>
          <Pencil size={20} />
        </Botao>
      }
    >
      {projeto.descricao && <p className="-mt-2 mb-5 text-[15px] whitespace-pre-line text-neutral-600 dark:text-neutral-400">{projeto.descricao}</p>}

      <Secao titulo="Próximas ações">
        <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>
          {[...abertas, ...feitas].map((a) => {
            const n = agendadas(a.id);
            return (
              <li key={a.id} className="flex items-center gap-1 py-1 pr-2 pl-1">
                <Marcador
                  marcado={a.concluida}
                  rotulo={`Concluir ${a.titulo}`}
                  onChange={(v) => alternar('acoes', a.id, { concluida: v }, v ? `${a.titulo}: concluída` : `${a.titulo}: reaberta`)}
                />
                <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEdicao({ tipo: 'acao', item: a })}>
                  <span className={`block truncate font-medium ${a.concluida ? 'text-neutral-400 line-through' : ''}`}>{a.titulo}</span>
                  <span className="block text-sm text-neutral-500">
                    {a.duracaoMin} min{n > 0 && ` · ${plural(n, 'agendada', 'agendadas')}`}
                  </span>
                </button>
                {!a.concluida && (
                  <Botao className="px-3" aria-label={`Agendar ${a.titulo}`} onClick={() => setAgendando(afazerDeAcao(projeto, a))}>
                    <CalendarPlus size={18} />
                  </Botao>
                )}
              </li>
            );
          })}
          <li>
            <form onSubmit={adicionarAcao} className="flex items-center gap-2 p-2">
              <input
                className={`${classeInput} flex-1`}
                value={novaAcao}
                onChange={(e) => setNovaAcao(e.target.value)}
                placeholder="Nova ação (ex.: pesquisar HDs)"
                aria-label="Nova ação"
              />
              <Botao type="submit" variante="primario" className="px-3" aria-label="Adicionar ação" disabled={!novaAcao.trim()}>
                <Plus size={20} />
              </Botao>
            </form>
          </li>
        </ul>
        <p className="mt-2 px-1 text-xs text-neutral-500">Ações em aberto também ficam no banco de afazeres do Calendário.</p>
      </Secao>

      <Secao titulo={`Marcos${resumo.marcosTotal ? ` · ${resumo.marcosFeitos} de ${resumo.marcosTotal}` : ''}`}>
        <Lista vazio="Nenhum marco ainda." onAdicionar={() => setEdicao({ tipo: 'marco' })} rotuloAdicionar="Adicionar marco">
          {marcosEmOrdem(projeto.marcos).map((m) => (
            <li key={m.id} className="flex items-center gap-1 py-1 pr-3 pl-1">
              <Marcador
                marcado={m.concluido}
                rotulo={`Marco ${m.titulo} concluído`}
                onChange={(v) => alternar('marcos', m.id, { concluido: v }, v ? `${m.titulo}: concluído` : `${m.titulo}: reaberto`)}
              />
              <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEdicao({ tipo: 'marco', item: m })}>
                <span className={`block truncate font-medium ${m.concluido ? 'text-neutral-400 line-through' : ''}`}>{m.titulo}</span>
                {m.data && (
                  <span className={`block text-sm ${marcoAtrasado(m, hoje) ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-500'}`}>
                    {marcoAtrasado(m, hoje) ? 'era para ' : 'até '}
                    {formatar(combinarDataHora(m.data, '12:00'), 'dd/MM/yyyy')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </Lista>
      </Secao>

      <Secao titulo="Itens e preços">
        <Lista vazio="Nenhum item ainda." onAdicionar={() => setEdicao({ tipo: 'item' })} rotuloAdicionar="Adicionar item">
          {projeto.itens.map((i) => (
            <li key={i.id} className="flex items-center gap-1 py-1 pr-3 pl-1">
              <Marcador
                marcado={i.comprado}
                rotulo={`${i.nome} comprado`}
                onChange={(v) => alternar('itens', i.id, { comprado: v }, v ? `${i.nome}: comprado` : `${i.nome}: a comprar`)}
              />
              <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 text-left" onClick={() => setEdicao({ tipo: 'item', item: i })}>
                <span className={`truncate font-medium ${i.comprado ? 'text-neutral-400 line-through' : ''}`}>{i.nome}</span>
                <span className="shrink-0 tabular-nums">{formatarReais(i.precoCentavos)}</span>
              </button>
            </li>
          ))}
        </Lista>
        {projeto.itens.length > 0 && (
          <dl className="mt-2 grid grid-cols-3 gap-2 px-1 text-sm" aria-label="Totais dos itens">
            <div>
              <dt className="text-neutral-500">Total</dt>
              <dd className="font-semibold tabular-nums">{formatarReais(resumo.totalItens)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Comprado</dt>
              <dd className="font-semibold tabular-nums">{formatarReais(resumo.comprado)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Falta comprar</dt>
              <dd className="font-semibold tabular-nums">{formatarReais(resumo.faltaComprar)}</dd>
            </div>
          </dl>
        )}
      </Secao>

      <MetaDoProjeto projeto={projeto} />

      <Sheet aberto={editandoProjeto} onFechar={() => setEditandoProjeto(false)} titulo="Editar projeto">
        {editandoProjeto && <ProjetoForm projeto={projeto} onFechar={() => setEditandoProjeto(false)} />}
      </Sheet>

      <Sheet
        aberto={edicao !== null}
        onFechar={() => setEdicao(null)}
        titulo={edicao ? `${edicao.item ? 'Editar' : 'Novo'} ${edicao.tipo === 'acao' ? 'ação' : edicao.tipo}` : ''}
      >
        {edicao && <FormularioDoProjeto key={edicao.item?.id ?? edicao.tipo} projeto={projeto} edicao={edicao} onFechar={() => setEdicao(null)} />}
      </Sheet>

      <Sheet aberto={agendando !== null} onFechar={() => setAgendando(null)} titulo={agendando ? `Agendar ${agendando.nome}` : 'Agendar'}>
        {agendando && <AgendarSheet afazer={agendando} dias={dias} agora={agora} onFechar={() => setAgendando(null)} />}
      </Sheet>
    </Pagina>
  );
}

function Lista({ children, vazio, onAdicionar, rotuloAdicionar }: { children: ReactNode[]; vazio: string; onAdicionar: () => void; rotuloAdicionar: string }) {
  return (
    <>
      {children.length > 0 ? (
        <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>{children}</ul>
      ) : (
        <p className="px-1 text-sm text-neutral-500">{vazio}</p>
      )}
      <Botao variante="fantasma" className="mt-1 px-2 text-indigo-600 dark:text-indigo-400" onClick={onAdicionar}>
        <Plus size={18} /> {rotuloAdicionar}
      </Botao>
    </>
  );
}

/** Formulário de ação, marco ou item (novo ou edição), com remover e desfazer. */
function FormularioDoProjeto({ projeto, edicao, onFechar }: { projeto: Projeto; edicao: Edicao; onFechar: () => void }) {
  const toast = useToast();
  const i = edicao.item;
  const [titulo, setTitulo] = useState(i ? ('titulo' in i ? i.titulo : i.nome) : '');
  const [duracao, setDuracao] = useState(edicao.tipo === 'acao' ? (edicao.item?.duracaoMin ?? 60) : 60);
  const [data, setData] = useState(edicao.tipo === 'marco' ? (edicao.item?.data ?? '') : '');
  const [preco, setPreco] = useState<number | null>(edicao.tipo === 'item' ? (edicao.item?.precoCentavos ?? null) : null);
  const valido = titulo.trim() !== '' && (edicao.tipo !== 'item' || preco !== null);
  const campo = ({ acao: 'acoes', marco: 'marcos', item: 'itens' } as const)[edicao.tipo];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const t = titulo.trim();
    if (edicao.tipo === 'acao') {
      if (edicao.item) await editar(projeto.id, 'acoes', edicao.item.id, { titulo: t, duracaoMin: duracao });
      else await adicionar(projeto.id, 'acoes', { titulo: t, duracaoMin: duracao, concluida: false });
    } else if (edicao.tipo === 'marco') {
      if (edicao.item) await editar(projeto.id, 'marcos', edicao.item.id, { titulo: t, data: data || null });
      else await adicionar(projeto.id, 'marcos', { titulo: t, data: data || null, concluido: false });
    } else {
      if (edicao.item) await editar(projeto.id, 'itens', edicao.item.id, { nome: t, precoCentavos: preco! });
      else await adicionar(projeto.id, 'itens', { nome: t, precoCentavos: preco!, comprado: false });
    }
    onFechar();
  }

  async function apagar() {
    if (!i) return;
    const desfazer = await remover(projeto.id, campo, i.id);
    onFechar();
    toast({ texto: `${titulo} removido`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo={edicao.tipo === 'item' ? 'Nome' : 'Título'}>
        <input className={classeInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus={!i} required />
      </Campo>
      {edicao.tipo === 'acao' && (
        <Campo rotulo="Duração ao agendar">
          <Stepper rotulo="Duração ao agendar" valor={duracao} onChange={setDuracao} min={15} max={480} passo={15} formatar={(v) => `${v} min`} />
        </Campo>
      )}
      {edicao.tipo === 'marco' && (
        <Campo rotulo="Data (opcional)">
          <input type="date" className={classeInput} value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
      )}
      {edicao.tipo === 'item' && (
        <Campo rotulo="Preço">
          <CampoReais rotulo="Preço" valor={preco} onChange={setPreco} />
        </Campo>
      )}
      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!valido}>
          Salvar
        </Botao>
        {i && (
          <Botao variante="perigo" aria-label="Remover" onClick={apagar}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>
    </form>
  );
}
