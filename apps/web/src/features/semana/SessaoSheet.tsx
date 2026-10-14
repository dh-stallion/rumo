import {
  ativo,
  combinarDataHora,
  conflitosComFixos,
  duracaoMin,
  inicioDaSemana,
  inicioDoDiaApos,
  paraDataLocal,
  paraHoraLocal,
  posicionarNoDia,
  rotuloDia,
  type Sessao,
} from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { moverSessao } from '../../db/acoes';
import { db } from '../../db/db';
import { useCalendario } from '../../db/preferencias';
import { excluir, useLista } from '../../db/repo';
import { minutosDe, SeletorDiaHora } from './SeletorDiaHora';

/** Folha de uma sessão (aberta pela grade ou por "Hoje"): ver, mudar dia/hora/duração, remover. */
export function SessaoSheet({ sessaoId, onFechar, acoes }: { sessaoId: string | null; onFechar: () => void; acoes?: (s: Sessao) => ReactNode }) {
  const sessao = useLiveQuery(() => (sessaoId ? db.sessoes.get(sessaoId) : undefined), [sessaoId]);
  const atividade = useLiveQuery(() => (sessao ? db.atividades.get(sessao.atividadeId) : undefined), [sessao?.atividadeId]);
  const visivel = !!sessaoId && !!sessao && ativo(sessao) && !!atividade;
  return (
    <Sheet aberto={!!sessaoId} onFechar={onFechar} titulo={atividade?.nome ?? 'Sessão'}>
      {visivel && <Conteudo key={`${sessao.id}:${sessao.atualizadoEm}`} sessao={sessao} onFechar={onFechar} acoes={acoes} />}
    </Sheet>
  );
}

function Conteudo({ sessao, onFechar, acoes }: { sessao: Sessao; onFechar: () => void; acoes?: (s: Sessao) => ReactNode }) {
  const toast = useToast();
  const agora = useAgora();
  const cal = useCalendario();
  const eventos = useLista(db.eventos) ?? [];
  const planejada = sessao.origem === 'planejada';
  const semana = inicioDaSemana(new Date(sessao.inicio), cal);
  const dias = Array.from({ length: 7 }, (_, i) => inicioDoDiaApos(semana, i));

  const [dia, setDia] = useState(paraDataLocal(sessao.inicio));
  const [hora, setHora] = useState(paraHoraLocal(sessao.inicio));
  const [duracao, setDuracao] = useState(duracaoMin(sessao));

  const novo = hora ? posicionarNoDia(combinarDataHora(dia, '12:00'), minutosDe(hora), duracao) : null;
  const mudou = !!novo && (novo.inicio !== sessao.inicio || novo.fim !== sessao.fim);
  const conflitosAtuais = conflitosComFixos(sessao, eventos);
  const conflitosNovos = novo ? conflitosComFixos(novo, eventos) : [];

  async function salvar() {
    if (!novo) return;
    const desfazer = await moverSessao(sessao, novo);
    onFechar();
    toast({ texto: 'Sessão atualizada', acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  async function remover() {
    const desfazer = await excluir(db.sessoes, sessao.id);
    onFechar();
    toast({ texto: 'Sessão removida', acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[15px]">
          {rotuloDia(paraDataLocal(sessao.inicio), agora)} · {paraHoraLocal(sessao.inicio)}–{paraHoraLocal(sessao.fim)}
        </p>
        <p className="text-sm text-neutral-500">{planejada ? 'Planejado' : 'Feito'}</p>
      </div>

      {conflitosAtuais.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          <AlertTriangle size={18} className="mt-px shrink-0" aria-hidden />
          Em conflito com {conflitosAtuais.map((c) => c.titulo).join(', ')} (horário fixo).
        </p>
      )}

      {acoes?.(sessao)}

      {planejada && (
        <section className="space-y-4 border-t border-black/5 pt-4 dark:border-white/10">
          <h3 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Mudar</h3>
          <SeletorDiaHora
            dias={dias}
            hoje={paraDataLocal(agora)}
            dia={dia}
            hora={hora}
            duracao={duracao}
            conflitos={mudou ? conflitosNovos : []}
            onDia={setDia}
            onHora={setHora}
            onDuracao={setDuracao}
          />
          <Botao className="w-full" disabled={!mudou} onClick={salvar}>
            Salvar alterações
          </Botao>
        </section>
      )}

      <Botao variante="perigo" className="w-full" onClick={remover}>
        <Trash2 size={18} /> Remover sessão
      </Botao>
    </div>
  );
}
