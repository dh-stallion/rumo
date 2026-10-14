import { eventosExportaveis, gerarICS, paraDataLocal } from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarPlus, Rss } from 'lucide-react';
import { useState } from 'react';
import { entregarArquivo } from '../../app/arquivo';
import { Botao } from '../../components/ui/Botao';
import { Interruptor } from '../../components/ui/Campos';
import { classeCartao, Secao } from '../../components/ui/Pagina';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';

/** Ajustes → exportar o calendário em .ics (e, na etapa 5, o feed assinável). */
export function ExportarCalendario() {
  const toast = useToast();
  const [comSessoes, setComSessoes] = useState(true);

  // Arquivo pronto antes do toque: o compartilhamento no iPhone precisa acontecer direto no gesto.
  const pronto = useLiveQuery(async () => {
    const [eventos, sessoes, atividades, pessoas] = await Promise.all([
      db.eventos.toArray(),
      db.sessoes.toArray(),
      db.atividades.toArray(),
      db.pessoas.toArray(),
    ]);
    const planejadas = comSessoes ? sessoes.filter((s) => !s.excluidoEm && s.origem === 'planejada') : [];
    return {
      ics: gerarICS({ eventos, sessoes: planejadas, atividades, pessoas }),
      total: eventosExportaveis(eventos).length + planejadas.length,
    };
  }, [comSessoes]);

  async function exportar() {
    if (!pronto) return;
    const r = await entregarArquivo(pronto.ics, `rumo-${paraDataLocal(new Date())}.ics`, 'text/calendar');
    if (r !== 'cancelado') toast({ texto: r === 'compartilhado' ? 'Calendário pronto' : 'Calendário baixado' });
  }

  return (
    <Secao titulo="Calendário do iPhone">
      <div className={`${classeCartao} space-y-3 p-3`}>
        <Interruptor
          rotulo="Incluir sessões planejadas"
          dica="Além dos eventos, as atividades agendadas no planejador."
          marcado={comSessoes}
          onChange={setComSessoes}
        />
        <Botao variante="primario" className="w-full" disabled={!pronto?.total} onClick={exportar}>
          <CalendarPlus size={18} /> Exportar calendário (.ics)
        </Botao>
        <p className="text-xs text-neutral-500">
          {pronto?.total ? `${pronto.total} ${pronto.total === 1 ? 'item' : 'itens'} (séries contam uma vez).` : 'Nada para exportar ainda.'} No
          iPhone, escolha "Salvar em Arquivos" e toque no arquivo no app Arquivos para adicionar ao Calendário. É uma cópia:
          mudanças feitas depois no Rumo não aparecem lá.
        </p>
      </div>
      <div className={`${classeCartao} mt-3 flex items-start gap-3 p-3 text-sm`} aria-label="Assinatura do calendário">
        <Rss size={18} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
        <p className="text-neutral-500">
          <span className="block font-medium text-neutral-700 dark:text-neutral-300">Assinatura que se atualiza sozinha</span>
          Fica disponível quando o servidor do Rumo estiver configurado (etapa 5): o Calendário do iPhone assina um endereço
          webcal:// e recebe as mudanças automaticamente.
        </p>
      </div>
    </Secao>
  );
}
