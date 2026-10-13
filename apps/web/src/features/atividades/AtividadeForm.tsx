import {
  CATEGORIAS,
  combinarDataHora,
  formatar,
  limitePadrao,
  paraDataLocal,
  ROTULO_CATEGORIA,
  type Atividade,
  type Categoria,
} from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { vezes } from '../../app/texto';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput, Interruptor, Segmentado, Stepper } from '../../components/ui/Campos';
import { useToast } from '../../components/ui/Toast';
import { registrarSessao } from '../../db/acoes';
import { db } from '../../db/db';
import { atualizar, criar, excluir, type Dados } from '../../db/repo';

export const CORES = ['#6366f1', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

const opcoesCategoria = CATEGORIAS.map((c) => ({ valor: c, rotulo: ROTULO_CATEGORIA[c] }));

export function AtividadeForm({ atividade, onFechar }: { atividade?: Atividade; onFechar: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(atividade?.nome ?? '');
  const [categoria, setCategoria] = useState<Categoria>(atividade?.categoria ?? 'hobby');
  const [duracao, setDuracao] = useState(atividade?.duracaoPadraoMin ?? 30);
  const [meta, setMeta] = useState(atividade?.metaSemanal ?? 0);
  // Texto livre: vazio = usar o padrão derivado da meta.
  const [limite, setLimite] = useState(atividade?.limiteDias ? String(atividade.limiteDias) : '');
  const limiteNum = Number(limite);
  const limiteValido = limite === '' || (Number.isInteger(limiteNum) && limiteNum >= 1 && limiteNum <= 365);
  const padrao = limitePadrao(meta);
  const [cor, setCor] = useState(atividade?.cor ?? CORES[0]!);
  const [pausada, setPausada] = useState(atividade?.pausada ?? false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !limiteValido) return;
    const dados: Dados<Atividade> = {
      nome: nome.trim(),
      categoria,
      duracaoPadraoMin: duracao,
      metaSemanal: meta,
      cor,
      pausada,
      limiteDias: limite === '' ? null : limiteNum,
    };
    if (atividade) await atualizar(db.atividades, atividade.id, dados);
    else await criar(db.atividades, dados);
    onFechar();
  }

  async function remover() {
    if (!atividade) return;
    const desfazer = await excluir(db.atividades, atividade.id);
    onFechar();
    toast({ texto: `${atividade.nome} excluída`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo="Nome">
        <input
          className={classeInput}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Violão, Inglês, Corrida"
          autoFocus={!atividade}
          required
        />
      </Campo>

      <Campo rotulo="Categoria">
        <Segmentado rotulo="Categoria" valor={categoria} opcoes={opcoesCategoria} onChange={setCategoria} />
      </Campo>

      <Campo rotulo="Duração padrão">
        <Stepper rotulo="Duração padrão" valor={duracao} onChange={setDuracao} min={5} max={480} passo={5} formatar={formatarDuracao} />
      </Campo>

      <Campo rotulo="Meta semanal">
        <Stepper
          rotulo="Meta semanal"
          valor={meta}
          onChange={setMeta}
          max={14}
          formatar={(v) => (v === 0 ? 'Sem meta' : `${vezes(v)} por semana`)}
        />
      </Campo>

      <Campo
        rotulo="Lembrar depois de quantos dias parada"
        dica={
          limiteValido
            ? `Em branco, usa o padrão pela meta: ${padrao} dias. Para parar os lembretes, pause a atividade.`
            : 'Use um número inteiro de 1 a 365.'
        }
      >
        <input
          className={`${classeInput} ${limiteValido ? '' : 'border-red-500'}`}
          inputMode="numeric"
          pattern="[0-9]*"
          value={limite}
          onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))}
          placeholder={`Padrão: ${padrao} dias`}
          aria-invalid={!limiteValido}
        />
      </Campo>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Cor</legend>
        <div className="grid grid-cols-8 justify-items-center">
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={cor === c}
              onClick={() => setCor(c)}
              className="grid size-11 place-items-center rounded-full"
            >
              <span
                className={`grid size-8 place-items-center rounded-full ${cor === c ? 'ring-2 ring-offset-2 ring-neutral-900 ring-offset-white dark:ring-white dark:ring-offset-neutral-900' : ''}`}
                style={{ backgroundColor: c }}
              >
                {cor === c && <Check size={16} className="text-white" />}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {atividade && (
        <Interruptor
          rotulo="Pausada"
          dica="Some de Hoje e não conta para metas até você retomar."
          marcado={pausada}
          onChange={setPausada}
        />
      )}

      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!nome.trim() || !limiteValido}>
          Salvar
        </Botao>
        {atividade && (
          <Botao variante="perigo" aria-label="Excluir atividade" onClick={remover}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>

      {atividade && <Historico atividade={atividade} />}
    </form>
  );
}

function formatarDuracao(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function Historico({ atividade }: { atividade: Atividade }) {
  const toast = useToast();
  const [data, setData] = useState(() => paraDataLocal(new Date()));
  const sessoes = useLiveQuery(
    async () =>
      (await db.sessoes.where('atividadeId').equals(atividade.id).toArray())
        .filter((s) => !s.excluidoEm && s.origem === 'registrada')
        .sort((a, b) => b.inicio.localeCompare(a.inicio))
        .slice(0, 8),
    [atividade.id],
  );

  return (
    <section className="space-y-3 border-t border-black/5 pt-5 dark:border-white/10">
      <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Histórico</h3>

      <div className="flex items-end gap-2">
        <Campo rotulo="Registrar em outra data">
          <input
            type="date"
            className={classeInput}
            value={data}
            max={paraDataLocal(new Date())}
            onChange={(e) => setData(e.target.value)}
          />
        </Campo>
        <Botao
          disabled={!data}
          onClick={async () => {
            await registrarSessao(atividade, combinarDataHora(data, '12:00'));
            toast({ texto: `Registrado em ${formatar(combinarDataHora(data, '12:00'), 'd/MM')}` });
          }}
        >
          Registrar
        </Botao>
      </div>

      {sessoes && sessoes.length > 0 ? (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {sessoes.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-1">
              <span className="text-[15px]">{formatar(s.inicio, "EEE, d 'de' MMM")}</span>
              <button
                type="button"
                aria-label="Remover sessão"
                className="grid size-11 place-items-center rounded-full text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-800"
                onClick={async () => {
                  const desfazer = await excluir(db.sessoes, s.id);
                  toast({ texto: 'Sessão removida', acao: { rotulo: 'Desfazer', fn: desfazer } });
                }}
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">Nenhuma sessão registrada ainda.</p>
      )}
    </section>
  );
}
