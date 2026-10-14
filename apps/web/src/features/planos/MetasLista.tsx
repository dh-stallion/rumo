import { ativo, progressoMeta, type MetaFinanceira, type Projeto } from '@rumo/core';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { db } from '../../db/db';
import { useLista } from '../../db/repo';
import { MetaForm } from './MetaForm';
import { ProgressoMeta } from './ProgressoMeta';

export function MetasLista() {
  const agora = useAgora();
  const metas = useLista(db.metas);
  const projetos = useLista(db.projetos);
  const [criando, setCriando] = useState(false);
  if (!metas || !projetos) return null;
  const porId = new Map(projetos.filter(ativo).map((p) => [p.id, p]));
  // Mais urgentes primeiro: prazo mais próximo.
  const lista = metas.filter(ativo).sort((a, b) => a.prazo.localeCompare(b.prazo));

  return (
    <section aria-label="Metas">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Metas</h2>
        <Botao variante="primario" className="px-3" aria-label="Nova meta" onClick={() => setCriando(true)}>
          <Plus size={20} /> Nova meta
        </Botao>
      </div>
      {lista.length === 0 ? (
        <Vazio>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Nenhuma meta ainda.</p>
          <p className="mt-1 text-sm">Diga quanto quer juntar e até quando; o app calcula quanto guardar por mês e por semana.</p>
        </Vazio>
      ) : (
        <ul className="space-y-3">
          {lista.map((m) => (
            <CartaoMeta key={m.id} meta={m} projeto={m.projetoId ? porId.get(m.projetoId) : undefined} agora={agora} />
          ))}
        </ul>
      )}
      <Sheet aberto={criando} onFechar={() => setCriando(false)} titulo="Nova meta">
        {criando && <MetaForm onFechar={() => setCriando(false)} />}
      </Sheet>
    </section>
  );
}

export function CartaoMeta({ meta, projeto, agora }: { meta: MetaFinanceira; projeto?: Projeto; agora: Date }) {
  return (
    <li>
      <Link to={`/planos/meta/${meta.id}`} aria-label={meta.nome} className={`${classeCartao} block px-4 py-3 active:opacity-80`}>
        <span className="mb-2 block truncate text-[17px] font-semibold">{meta.nome}</span>
        {projeto && <span className="-mt-2 mb-2 block truncate text-sm text-neutral-500">{projeto.nome}</span>}
        <ProgressoMeta p={progressoMeta(meta, projeto, agora)} prazo={meta.prazo} compacto />
      </Link>
    </li>
  );
}
