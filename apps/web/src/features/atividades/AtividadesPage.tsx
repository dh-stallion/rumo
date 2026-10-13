import {
  CATEGORIAS,
  diasEntre,
  progressoSemanal,
  ROTULO_CATEGORIA,
  ultimaSessao,
  type Atividade,
  type Sessao,
} from '@rumo/core';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { haDias } from '../../app/texto';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Pagina, Secao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { pausar, registrarSessao } from '../../db/acoes';
import { db } from '../../db/db';
import { excluir, useLista } from '../../db/repo';
import { AtividadeForm } from './AtividadeForm';

const porNome = (a: Atividade, b: Atividade) => a.nome.localeCompare(b.nome, 'pt-BR');

export function AtividadesPage() {
  const agora = useAgora();
  const atividades = useLista(db.atividades);
  const sessoes = useLista(db.sessoes);
  const [editando, setEditando] = useState<Atividade | 'nova' | null>(null);

  const novo = (
    <Botao variante="primario" aria-label="Nova atividade" className="px-3" onClick={() => setEditando('nova')}>
      <Plus size={20} /> Nova
    </Botao>
  );

  if (!atividades || !sessoes) return <Pagina titulo="Atividades" acao={novo}>{null}</Pagina>;

  const ativas = atividades.filter((a) => !a.pausada).sort(porNome);
  const pausadas = atividades.filter((a) => a.pausada).sort(porNome);
  const grupos = CATEGORIAS.map((c) => ({ c, itens: ativas.filter((a) => a.categoria === c) })).filter(
    (g) => g.itens.length > 0,
  );

  return (
    <Pagina titulo="Atividades" acao={novo}>
      {atividades.length === 0 && (
        <Vazio>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Nenhuma atividade ainda.</p>
          <p className="mt-1 text-sm">Cadastre hobbies, estudos e lazer — com metas semanais se quiser.</p>
        </Vazio>
      )}

      {grupos.map(({ c, itens }) => (
        <Secao key={c} titulo={ROTULO_CATEGORIA[c]}>
          <Lista itens={itens} sessoes={sessoes} agora={agora} onEditar={setEditando} />
        </Secao>
      ))}

      {pausadas.length > 0 && (
        <Secao titulo="Pausadas">
          <Lista itens={pausadas} sessoes={sessoes} agora={agora} onEditar={setEditando} />
        </Secao>
      )}

      <Sheet
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === 'nova' ? 'Nova atividade' : 'Editar atividade'}
      >
        {editando !== null && (
          <AtividadeForm
            key={editando === 'nova' ? 'nova' : editando.id}
            atividade={editando === 'nova' ? undefined : editando}
            onFechar={() => setEditando(null)}
          />
        )}
      </Sheet>
    </Pagina>
  );
}

function Lista({
  itens,
  sessoes,
  agora,
  onEditar,
}: {
  itens: Atividade[];
  sessoes: Sessao[];
  agora: Date;
  onEditar: (a: Atividade) => void;
}) {
  const toast = useToast();
  return (
    <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>
      {itens.map((a) => {
        const ultima = ultimaSessao(a.id, sessoes, agora);
        const { feitas } = progressoSemanal(a, sessoes, agora);
        const resumo = [
          a.metaSemanal > 0 && `${feitas} de ${a.metaSemanal} esta semana`,
          ultima ? `última ${haDias(diasEntre(new Date(ultima.inicio), agora))}` : 'nenhuma sessão ainda',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={a.id} className="flex items-center gap-2 py-1.5 pr-2 pl-4">
            <button
              type="button"
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => onEditar(a)}
            >
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: a.cor }} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.nome}</span>
                <span className="block truncate text-sm text-neutral-500">{resumo}</span>
              </span>
            </button>
            {a.pausada ? (
              <Botao
                onClick={async () => {
                  await pausar('atividade', a.id, false);
                  toast({ texto: `${a.nome} retomada` });
                }}
              >
                Retomar
              </Botao>
            ) : (
              <Botao
                variante="primario"
                aria-label={`Fiz ${a.nome} hoje`}
                onClick={async () => {
                  const s = await registrarSessao(a);
                  toast({
                    texto: `${a.nome}: registrado`,
                    acao: { rotulo: 'Desfazer', fn: () => excluir(db.sessoes, s.id) },
                  });
                }}
              >
                <Check size={18} /> Fiz hoje
              </Botao>
            )}
          </li>
        );
      })}
    </ul>
  );
}
