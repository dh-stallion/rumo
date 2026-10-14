import { ativo, combinarDataHora, formatar, formatarReais, paraDataLocal, progressoMeta, type MetaFinanceira } from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { CampoReais } from '../../components/ui/CampoReais';
import { Campo, classeInput, Segmentado } from '../../components/ui/Campos';
import { classeCartao, Pagina, Secao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';
import { registrarAporte, removerAporte } from '../../db/metas';
import { MetaForm } from './MetaForm';
import { ProgressoMeta } from './ProgressoMeta';

const VOLTAR = { para: '/planos?aba=metas', rotulo: 'Metas' };

export function MetaPage() {
  const { id } = useParams();
  const meta = useLiveQuery(() => db.metas.get(id ?? '').then((m) => m ?? null), [id]);
  if (meta === undefined) return null;
  if (!meta || !ativo(meta)) {
    return (
      <Pagina titulo="Meta" voltar={VOLTAR}>
        <Vazio>Esta meta não existe mais.</Vazio>
      </Pagina>
    );
  }
  return <ConteudoMeta meta={meta} />;
}

function ConteudoMeta({ meta }: { meta: MetaFinanceira }) {
  const toast = useToast();
  const agora = useAgora();
  const projeto = useLiveQuery(() => (meta.projetoId ? db.projetos.get(meta.projetoId) : undefined), [meta.projetoId]);
  const [editando, setEditando] = useState(false);
  const [aportando, setAportando] = useState(false);
  const p = progressoMeta(meta, projeto && ativo(projeto) ? projeto : null, agora);
  const aportes = [...meta.aportes].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Pagina
      titulo={meta.nome}
      voltar={VOLTAR}
      acao={
        <Botao variante="fantasma" className="px-2" aria-label="Editar meta" onClick={() => setEditando(true)}>
          <Pencil size={20} />
        </Botao>
      }
    >
      <div className={`${classeCartao} mb-3 p-4`}>
        <ProgressoMeta p={p} prazo={meta.prazo} />
      </div>
      {projeto && ativo(projeto) && (
        <p className="mb-5 px-1 text-sm text-neutral-500">
          Ligada ao projeto{' '}
          <Link to={`/planos/projeto/${projeto.id}`} className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
            {projeto.nome}
          </Link>
          {meta.valorAlvoCentavos === null && ' · alvo pela soma dos itens'}
        </p>
      )}

      <Botao variante="primario" className="mb-7 w-full" onClick={() => setAportando(true)}>
        <Plus size={18} /> Registrar aporte
      </Botao>

      <Secao titulo="Aportes">
        {aportes.length === 0 && meta.saldoInicialCentavos === 0 ? (
          <p className="px-1 text-sm text-neutral-500">Nenhum aporte ainda.</p>
        ) : (
          <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>
            {aportes.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1 pr-1 pl-4">
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium tabular-nums ${a.valorCentavos < 0 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                    {a.valorCentavos < 0 ? '−' : '+'} {formatarReais(Math.abs(a.valorCentavos))}
                  </span>
                  <span className="block truncate text-sm text-neutral-500">
                    {formatar(combinarDataHora(a.data, '12:00'), 'dd/MM/yyyy')}
                    {a.nota && ` · ${a.nota}`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remover aporte de ${formatarReais(Math.abs(a.valorCentavos))}`}
                  className="grid size-11 place-items-center rounded-full text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-800"
                  onClick={async () => {
                    const desfazer = await removerAporte(meta.id, a.id);
                    toast({ texto: 'Aporte removido', acao: { rotulo: 'Desfazer', fn: desfazer } });
                  }}
                >
                  <X size={18} />
                </button>
              </li>
            ))}
            {meta.saldoInicialCentavos !== 0 && (
              <li className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-neutral-500">
                <span>Saldo inicial</span>
                <span className="tabular-nums">{formatarReais(meta.saldoInicialCentavos)}</span>
              </li>
            )}
          </ul>
        )}
      </Secao>

      <Sheet aberto={editando} onFechar={() => setEditando(false)} titulo="Editar meta">
        {editando && <MetaForm meta={meta} onFechar={() => setEditando(false)} />}
      </Sheet>
      <Sheet aberto={aportando} onFechar={() => setAportando(false)} titulo="Registrar aporte">
        {aportando && <AporteForm metaId={meta.id} agora={agora} onFechar={() => setAportando(false)} />}
      </Sheet>
    </Pagina>
  );
}

function AporteForm({ metaId, agora, onFechar }: { metaId: string; agora: Date; onFechar: () => void }) {
  const toast = useToast();
  const [tipo, setTipo] = useState<'aporte' | 'retirada'>('aporte');
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(paraDataLocal(agora));
  const [nota, setNota] = useState('');
  const valido = valor !== null && valor > 0 && !!data;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const desfazer = await registrarAporte(metaId, { valorCentavos: tipo === 'retirada' ? -valor! : valor!, data, nota: nota.trim() });
    onFechar();
    toast({ texto: tipo === 'retirada' ? 'Retirada registrada' : 'Aporte registrado', acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Segmentado
        rotulo="Tipo"
        valor={tipo}
        opcoes={[
          { valor: 'aporte', rotulo: 'Aporte' },
          { valor: 'retirada', rotulo: 'Retirada' },
        ]}
        onChange={setTipo}
      />
      <Campo rotulo="Valor">
        <CampoReais rotulo="Valor" valor={valor} onChange={setValor} />
      </Campo>
      <Campo rotulo="Data">
        <input type="date" className={classeInput} value={data} onChange={(e) => setData(e.target.value)} max={paraDataLocal(agora)} required />
      </Campo>
      <Campo rotulo="Nota (opcional)">
        <input className={classeInput} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: comprei €500 a R$ 6,15" />
      </Campo>
      <Botao type="submit" variante="primario" className="w-full" disabled={!valido}>
        Registrar
      </Botao>
    </form>
  );
}
