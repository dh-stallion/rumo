import type { PreferenciasNotificacao } from '@rumo/core';
import { Bell, BellOff, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput, Interruptor, Stepper } from '../../components/ui/Campos';
import { classeCartao } from '../../components/ui/Pagina';
import { useToast } from '../../components/ui/Toast';
import { atualizarPreferencias, usePreferencias } from '../../db/preferencias';
import { ErroServidor, type Servidor } from '../../sync/cliente';
import { ativarPush, desativarPush, enviarTeste, estaInstalado, situacaoPush, type SituacaoPush } from '../../sync/notificacoes';

/** Ajustes → notificações (dependem do servidor, que é quem envia os lembretes). */
export function Notificacoes({ servidor }: { servidor: Servidor }) {
  const toast = useToast();
  const prefs = usePreferencias();
  const [situacao, setSituacao] = useState<SituacaoPush | 'verificando'>('verificando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    situacaoPush(servidor).then(setSituacao, () => setSituacao('inativa'));
  }, [servidor]);

  const n = prefs.notificacoes;
  const mudar = (m: Partial<PreferenciasNotificacao>) => atualizarPreferencias({ notificacoes: { ...n, ...m } });

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setOcupado(true);
    try {
      await acao();
      setSituacao(await situacaoPush(servidor));
      toast({ texto: sucesso });
    } catch (e) {
      toast({ texto: e instanceof ErroServidor ? e.message : 'Não deu para mudar as notificações.' });
      setSituacao(await situacaoPush(servidor).catch(() => 'inativa' as const));
    } finally {
      setOcupado(false);
    }
  }

  const texto: Record<SituacaoPush | 'verificando', string> = {
    verificando: 'Verificando…',
    'sem-suporte': estaInstalado()
      ? 'Este navegador não recebe notificações.'
      : 'No iPhone, as notificações só funcionam com o Rumo aberto pelo ícone da tela inicial (iOS 16.4 ou mais novo).',
    bloqueada: 'Notificações bloqueadas para o Rumo. Libere nos ajustes do sistema.',
    inativa: 'Desativadas neste aparelho.',
    ativa: 'Ativas neste aparelho.',
  };

  return (
    <div className={`${classeCartao} space-y-4 p-3`} aria-label="Notificações">
      <div className="space-y-2">
        <p className="text-[15px] font-medium">Notificações</p>
        <p className="text-sm text-neutral-500" data-push={situacao}>
          {texto[situacao]}
        </p>
        {situacao === 'inativa' && (
          <Botao variante="primario" className="w-full" disabled={ocupado} onClick={() => executar(() => ativarPush(servidor), 'Notificações ativadas')}>
            <Bell size={18} /> Ativar notificações
          </Botao>
        )}
        {situacao === 'ativa' && (
          <div className="flex gap-2">
            <Botao
              className="flex-1"
              disabled={ocupado}
              onClick={async () => {
                const { enviados } = await enviarTeste(servidor).catch(() => ({ enviados: 0 }));
                toast({ texto: enviados ? 'Notificação de teste enviada' : 'Nenhum aparelho recebeu o teste' });
              }}
            >
              <Send size={18} /> Enviar teste
            </Botao>
            <Botao
              variante="fantasma"
              aria-label="Desativar notificações"
              disabled={ocupado}
              onClick={() => executar(() => desativarPush(servidor), 'Notificações desativadas')}
            >
              <BellOff size={18} />
            </Botao>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-black/5 pt-3 dark:border-white/10">
        <Interruptor rotulo="Resumo do dia" dica="O que pede atenção e os compromissos de hoje. Só chega se houver algo." marcado={n.resumo} onChange={(v) => mudar({ resumo: v })} />
        {n.resumo && (
          <Campo rotulo="Horário do resumo">
            <input type="time" className={classeInput} value={n.horaResumo} onChange={(e) => e.target.value && mudar({ horaResumo: e.target.value })} />
          </Campo>
        )}
        <Interruptor rotulo="Antes de compromissos fixos" marcado={n.eventos} onChange={(v) => mudar({ eventos: v })} />
        {n.eventos && (
          <Campo rotulo="Quanto tempo antes">
            <Stepper rotulo="Quanto tempo antes" valor={n.minutosAntes} onChange={(v) => mudar({ minutosAntes: v })} min={5} max={120} passo={5} formatar={(v) => `${v} min`} />
          </Campo>
        )}
        <Interruptor
          rotulo="Contato com pessoas"
          dica="Uma vez quando passa da frequência, a partir do horário do resumo."
          marcado={n.contatos}
          onChange={(v) => mudar({ contatos: v })}
        />
        <p className="text-xs text-neutral-500">Pausar ou adiar algo no app também silencia o lembrete.</p>
      </div>
    </div>
  );
}
