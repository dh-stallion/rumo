import {
  combinarDataHora,
  diaDaSemanaDe,
  escoposPermitidos,
  paraDataLocal,
  paraHoraLocal,
  planoEditar,
  planoExcluir,
  repeticaoDe,
  rruleDe,
  type ContextoSerie,
  type Escopo,
  type Evento,
  type EventoNaAgenda,
  type MudancasOcorrencia,
  type Pessoa,
  type Repeticao,
} from '@rumo/core';
import { Repeat, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput, Interruptor } from '../../components/ui/Campos';
import { useToast } from '../../components/ui/Toast';
import { aplicarPlano } from '../../db/acoes';
import { db } from '../../db/db';
import { atualizar, criar, excluir, useLista } from '../../db/repo';
import { RepeticaoCampo } from './RepeticaoCampo';

function proximaHoraCheia() {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return d;
}

const ROTULO_ESCOPO: Record<Escopo, string> = {
  este: 'Só este evento',
  seguintes: 'Este e os seguintes',
  todos: 'Todos os eventos',
};

type Pedido = { acao: 'salvar'; mudancas: MudancasOcorrencia } | { acao: 'remover' };

interface Props {
  /** Ocorrência tocada (de um evento único ou de uma série); sem ela, evento novo. */
  evento?: EventoNaAgenda;
  /** Dia sugerido para um evento novo (09:00); sem ele, a próxima hora cheia. */
  sugestao?: Date;
  pessoas: Pessoa[];
  onFechar: () => void;
}

/** Carrega os eventos antes de montar o formulário: a regra de uma ocorrência vem da série. */
export function EventoForm(props: Props) {
  const todos = useLista(db.eventos);
  if (!todos) return null;
  const serie = props.evento?.ocorrencia ? todos.find((e) => e.id === props.evento!.ocorrencia!.serieId) : undefined;
  return <FormularioEvento {...props} todos={todos} serie={serie} />;
}

function FormularioEvento({ evento, sugestao, pessoas, onFechar, todos, serie }: Props & { todos: Evento[]; serie?: Evento }) {
  const toast = useToast();

  const base = evento
    ? new Date(evento.inicio)
    : sugestao
      ? combinarDataHora(paraDataLocal(sugestao), '09:00')
      : proximaHoraCheia();
  const fimBase = evento ? new Date(evento.fim) : new Date(base.getTime() + 3_600_000);
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [data, setData] = useState(paraDataLocal(base));
  const [inicio, setInicio] = useState(paraHoraLocal(base));
  const [fim, setFim] = useState(paraHoraLocal(fimBase));
  const [fixo, setFixo] = useState(evento?.fixo ?? true);
  const [pessoaId, setPessoaId] = useState(evento?.pessoaId ?? '');
  // A regra vem da série (uma ocorrência editada não tem regra própria).
  const rruleOriginal = evento?.ocorrencia ? (serie?.rrule ?? null) : (evento?.rrule ?? null);
  const [repeticao, setRepeticao] = useState<Repeticao>(() => repeticaoDe(rruleOriginal, base));
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const ini = data && inicio ? combinarDataHora(data, inicio) : null;
  let fimData = data && fim ? combinarDataHora(data, fim) : null;
  // "23:00–01:00" termina no dia seguinte.
  if (ini && fimData && fimData <= ini) fimData = new Date(fimData.getTime() + 86_400_000);
  const valido = titulo.trim() && ini && fimData && fimData > ini;

  // Repetição semanal num único dia acompanha a troca de data (ter → qua).
  function mudarData(nova: string) {
    if (nova && (repeticao.tipo === 'semanal' || repeticao.tipo === 'quinzenal') && repeticao.dias.length === 1) {
      const antes = diaDaSemanaDe(combinarDataHora(data, '12:00'));
      if (repeticao.dias[0] === antes) setRepeticao({ ...repeticao, dias: [diaDaSemanaDe(combinarDataHora(nova, '12:00'))] });
    }
    setData(nova);
  }

  // Ocorrência de série (ou editada dela): edições pedem o escopo. Sem a série (apagada), vale como evento único.
  const ctx: ContextoSerie | null = evento && serie ? { serie, ocorrencia: evento, eventos: todos } : null;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const mudancas: MudancasOcorrencia = {
      titulo: titulo.trim(),
      inicio: ini!.toISOString(),
      fim: fimData!.toISOString(),
      fixo,
      pessoaId: pessoaId || null,
      rrule: rruleDe(repeticao, ini!),
    };
    if (ctx) return setPedido({ acao: 'salvar', mudancas });
    if (evento) await atualizar(db.eventos, evento.id, mudancas);
    else await criar(db.eventos, { ...mudancas, exdatas: [], serieId: null, ocorrenciaOriginal: null });
    onFechar();
  }

  async function remover() {
    if (!evento) return;
    if (ctx) return setPedido({ acao: 'remover' });
    const desfazer = await excluir(db.eventos, evento.id);
    onFechar();
    toast({ texto: 'Evento removido', acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  async function aplicar(escopo: Escopo) {
    if (!ctx || !pedido) return;
    const plano = pedido.acao === 'salvar' ? planoEditar(ctx, escopo, pedido.mudancas) : planoExcluir(ctx, escopo);
    const desfazer = await aplicarPlano(plano);
    onFechar();
    toast({ texto: pedido.acao === 'salvar' ? 'Evento atualizado' : 'Evento removido', acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  if (pedido && ctx) {
    const escopos = pedido.acao === 'salvar' ? escoposPermitidos(ctx, pedido.mudancas.rrule) : (['este', 'seguintes', 'todos'] as Escopo[]);
    return (
      <div className="space-y-3" role="group" aria-label="Aplicar a">
        <p className="flex items-center gap-2 text-[15px]">
          <Repeat size={18} className="shrink-0 text-neutral-500" aria-hidden />
          {pedido.acao === 'salvar' ? 'Este evento se repete. Salvar as mudanças em:' : 'Este evento se repete. Remover:'}
        </p>
        {pedido.acao === 'salvar' && !escopos.includes('este') && (
          <p className="text-sm text-neutral-500">Como a repetição mudou, a mudança vale para a série.</p>
        )}
        {escopos.map((e) => (
          <Botao key={e} variante={pedido.acao === 'remover' ? 'perigo' : 'secundario'} className="w-full" onClick={() => aplicar(e)}>
            {ROTULO_ESCOPO[e]}
          </Botao>
        ))}
        <Botao variante="fantasma" className="w-full" onClick={() => setPedido(null)}>
          Voltar
        </Botao>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo="Título">
        <input className={classeInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus={!evento} required />
      </Campo>

      <Campo rotulo="Data">
        <input type="date" className={classeInput} value={data} onChange={(e) => mudarData(e.target.value)} required />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Início">
          <input type="time" className={classeInput} value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </Campo>
        <Campo rotulo="Fim">
          <input type="time" className={classeInput} value={fim} onChange={(e) => setFim(e.target.value)} required />
        </Campo>
      </div>

      {ini && <RepeticaoCampo valor={repeticao} inicio={ini} onChange={setRepeticao} />}

      <Campo rotulo="Com quem (opcional)">
        <select className={classeInput} value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
          <option value="">Ninguém</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Interruptor
        rotulo="Horário fixo"
        dica="No planejador, aparece travado e avisa sobre conflitos."
        marcado={fixo}
        onChange={setFixo}
      />

      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!valido}>
          Salvar
        </Botao>
        {evento && (
          <Botao variante="perigo" aria-label="Remover evento" onClick={remover}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>
    </form>
  );
}
