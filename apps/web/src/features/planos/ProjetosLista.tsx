import { ativo, formatarReais, resumoProjeto, type Projeto } from '@rumo/core';
import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { db } from '../../db/db';
import { useLista } from '../../db/repo';
import { ProjetoForm } from './ProjetoForm';

export function ProjetosLista() {
  const projetos = useLista(db.projetos);
  const [criando, setCriando] = useState(false);
  if (!projetos) return null;

  const porNome = (a: Projeto, b: Projeto) => a.nome.localeCompare(b.nome, 'pt-BR');
  const ativos = projetos.filter((p) => ativo(p) && !p.arquivado).sort(porNome);
  const arquivados = projetos.filter((p) => ativo(p) && p.arquivado).sort(porNome);

  return (
    <section className="mb-9" aria-label="Projetos">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Projetos</h2>
        <Botao variante="primario" className="px-3" aria-label="Novo projeto" onClick={() => setCriando(true)}>
          <Plus size={20} /> Novo projeto
        </Botao>
      </div>

      {ativos.length === 0 ? (
        <Vazio>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Nenhum projeto ainda.</p>
          <p className="mt-1 text-sm">Projetos de longo prazo com marcos, próximas ações e uma lista de compras.</p>
        </Vazio>
      ) : (
        <ul className="space-y-3">{ativos.map((p) => <CartaoProjeto key={p.id} projeto={p} />)}</ul>
      )}

      {arquivados.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 px-1 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Arquivados</h3>
          <ul className="space-y-3">{arquivados.map((p) => <CartaoProjeto key={p.id} projeto={p} />)}</ul>
        </>
      )}

      <Sheet aberto={criando} onFechar={() => setCriando(false)} titulo="Novo projeto">
        {criando && <ProjetoForm onFechar={() => setCriando(false)} />}
      </Sheet>
    </section>
  );
}

function CartaoProjeto({ projeto }: { projeto: Projeto }) {
  const r = resumoProjeto(projeto);
  const detalhes = [
    r.marcosTotal > 0 && `${r.marcosFeitos} de ${r.marcosTotal} marcos`,
    r.totalItens > 0 && (r.faltaComprar > 0 ? `${formatarReais(r.faltaComprar)} a comprar` : 'itens comprados'),
  ].filter(Boolean);
  return (
    <li>
      <Link to={`/planos/projeto/${projeto.id}`} className={`${classeCartao} flex items-center gap-3 px-4 py-3 active:opacity-80`}>
        <span className="w-1.5 shrink-0 self-stretch rounded-full" style={{ backgroundColor: projeto.cor }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold">{projeto.nome}</span>
          <span className="block truncate text-sm text-neutral-500">
            {r.proximaAcao ? `Próxima: ${r.proximaAcao.titulo}` : 'Sem próximas ações'}
          </span>
          {detalhes.length > 0 && <span className="block truncate text-sm text-neutral-500">{detalhes.join(' · ')}</span>}
        </span>
        <ChevronRight size={20} className="shrink-0 text-neutral-400" aria-hidden />
      </Link>
    </li>
  );
}
