import {
  agendadasNaSemana,
  combinarDataHora,
  conflitosComFixos,
  formatar,
  paraDataLocal,
  posicionarNoDia,
  type Atividade,
} from '@rumo/core';
import { useState } from 'react';
import { Botao } from '../../components/ui/Botao';
import { useToast } from '../../components/ui/Toast';
import { planejarSessao } from '../../db/acoes';
import { db } from '../../db/db';
import { useLista } from '../../db/repo';
import { minutosDe, SeletorDiaHora } from './SeletorDiaHora';

function horaSugerida(agora: Date, ehHoje: boolean) {
  if (!ehHoje) return '09:00';
  const h = Math.min(Number(formatar(agora, 'H')) + 1, 23);
  return `${String(h).padStart(2, '0')}:00`;
}

/** Fluxo sem arrastar: tocar no item do banco e escolher dia e hora. */
export function AgendarSheet({
  atividade,
  dias,
  agora,
  onFechar,
}: {
  atividade: Atividade;
  dias: Date[];
  agora: Date;
  onFechar: () => void;
}) {
  const toast = useToast();
  const eventos = useLista(db.eventos) ?? [];
  const sessoes = useLista(db.sessoes) ?? [];
  const hoje = paraDataLocal(agora);
  const temHoje = dias.some((d) => paraDataLocal(d) === hoje);
  const [dia, setDia] = useState(temHoje ? hoje : paraDataLocal(dias[0]!));
  const [hora, setHora] = useState(() => horaSugerida(agora, temHoje));
  const [duracao, setDuracao] = useState(atividade.duracaoPadraoMin);

  const intervalo = hora ? posicionarNoDia(combinarDataHora(dia, '12:00'), minutosDe(hora), duracao) : null;
  const conflitos = intervalo ? conflitosComFixos(intervalo, eventos) : [];
  const agendadas = agendadasNaSemana(atividade.id, sessoes, dias[0]!);

  async function agendar() {
    if (!intervalo) return;
    const { desfazer } = await planejarSessao(atividade, intervalo);
    onFechar();
    toast({
      texto: `${atividade.nome}: ${formatar(intervalo.inicio, "EEE, HH:mm")}${conflitos.length ? ' · conflito' : ''}`,
      acao: { rotulo: 'Desfazer', fn: desfazer },
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        {atividade.metaSemanal > 0 ? `${agendadas} de ${atividade.metaSemanal} agendados nesta semana` : `${agendadas} agendados nesta semana`}
      </p>
      <SeletorDiaHora
        dias={dias}
        hoje={hoje}
        dia={dia}
        hora={hora}
        duracao={duracao}
        conflitos={conflitos}
        onDia={setDia}
        onHora={setHora}
        onDuracao={setDuracao}
      />
      <Botao variante="primario" className="w-full" disabled={!intervalo} onClick={agendar}>
        Agendar
      </Botao>
    </div>
  );
}
