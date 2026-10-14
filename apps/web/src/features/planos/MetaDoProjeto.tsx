import { ativo, type Projeto } from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { PiggyBank } from 'lucide-react';
import { useState } from 'react';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { Secao } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { db } from '../../db/db';
import { MetaForm } from './MetaForm';
import { CartaoMeta } from './MetasLista';

/** Na página do projeto: a meta financeira ligada a ele, ou um atalho para criar uma. */
export function MetaDoProjeto({ projeto }: { projeto: Projeto }) {
  const agora = useAgora();
  const metas = useLiveQuery(() => db.metas.where('projetoId').equals(projeto.id).toArray(), [projeto.id]);
  const [criando, setCriando] = useState(false);
  if (!metas) return null;
  const ligadas = metas.filter(ativo);

  return (
    <Secao titulo="Meta financeira">
      {ligadas.length > 0 ? (
        <ul className="space-y-3">
          {ligadas.map((m) => (
            <CartaoMeta key={m.id} meta={m} projeto={projeto} agora={agora} />
          ))}
        </ul>
      ) : (
        <Botao className="w-full" onClick={() => setCriando(true)}>
          <PiggyBank size={18} /> Criar meta para este projeto
        </Botao>
      )}
      <Sheet aberto={criando} onFechar={() => setCriando(false)} titulo="Nova meta">
        {criando && <MetaForm projetoInicial={projeto.id} onFechar={() => setCriando(false)} />}
      </Sheet>
    </Secao>
  );
}
