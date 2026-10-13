import { contatoPendente, diasSemContato, type Pessoa } from '@rumo/core';
import { MessageCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { haDias } from '../../app/texto';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Pagina, Secao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { pausar, registrarContato } from '../../db/acoes';
import { db } from '../../db/db';
import { useLista } from '../../db/repo';
import { PessoaForm } from './PessoaForm';

export function PessoasPage() {
  const agora = useAgora();
  const pessoas = useLista(db.pessoas);
  const toast = useToast();
  const [editando, setEditando] = useState<Pessoa | 'nova' | null>(null);

  const novo = (
    <Botao variante="primario" aria-label="Nova pessoa" className="px-3" onClick={() => setEditando('nova')}>
      <Plus size={20} /> Nova
    </Botao>
  );

  if (!pessoas) return <Pagina titulo="Pessoas" acao={novo}>{null}</Pagina>;

  // Quem está há mais tempo além da frequência aparece primeiro.
  const atraso = (p: Pessoa) => (p.frequenciaDias > 0 ? diasSemContato(p, agora) / p.frequenciaDias : 0);
  const ativas = pessoas.filter((p) => !p.pausada).sort((a, b) => atraso(b) - atraso(a));
  const pausadas = pessoas.filter((p) => p.pausada).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const linha = (p: Pessoa) => {
    const dias = diasSemContato(p, agora);
    const pendente = contatoPendente(p, agora);
    const resumo = [
      p.ultimoContato ? `último contato ${haDias(dias)}` : 'sem contato registrado',
      p.frequenciaDias > 0 && `a cada ${p.frequenciaDias} ${p.frequenciaDias === 1 ? 'dia' : 'dias'}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <li key={p.id} className="flex items-center gap-2 py-1.5 pr-2 pl-4">
        <button type="button" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditando(p)}>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
              pendente
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
            aria-hidden
          >
            {p.nome.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.nome}</span>
            <span className="block truncate text-sm text-neutral-500">{resumo}</span>
          </span>
        </button>
        {p.pausada ? (
          <Botao
            onClick={async () => {
              await pausar('pessoa', p.id, false);
              toast({ texto: `Lembretes de ${p.nome} retomados` });
            }}
          >
            Retomar
          </Botao>
        ) : (
          <Botao
            variante={pendente ? 'primario' : 'secundario'}
            aria-label={`Falei com ${p.nome}`}
            onClick={async () => {
              const desfazer = await registrarContato(p);
              toast({ texto: `Contato com ${p.nome} registrado`, acao: { rotulo: 'Desfazer', fn: desfazer } });
            }}
          >
            <MessageCircle size={18} /> Falei
          </Botao>
        )}
      </li>
    );
  };

  return (
    <Pagina titulo="Pessoas" acao={novo}>
      {pessoas.length === 0 ? (
        <Vazio>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Ninguém por aqui ainda.</p>
          <p className="mt-1 text-sm">Adicione quem você quer manter por perto e de quanto em quanto tempo.</p>
        </Vazio>
      ) : (
        <ul className={`${classeCartao} mb-7 divide-y divide-black/5 dark:divide-white/10`}>{ativas.map(linha)}</ul>
      )}

      {pausadas.length > 0 && (
        <Secao titulo="Pausadas">
          <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>{pausadas.map(linha)}</ul>
        </Secao>
      )}

      <Sheet
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === 'nova' ? 'Nova pessoa' : 'Editar pessoa'}
      >
        {editando !== null && (
          <PessoaForm
            key={editando === 'nova' ? 'nova' : editando.id}
            pessoa={editando === 'nova' ? undefined : editando}
            onFechar={() => setEditando(null)}
          />
        )}
      </Sheet>
    </Pagina>
  );
}
