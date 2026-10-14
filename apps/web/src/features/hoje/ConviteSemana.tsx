import { CALENDARIO_PADRAO, chaveDaSemana, mostrarConvitePlanejar } from '@rumo/core';
import { CalendarRange } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Botao } from '../../components/ui/Botao';
import { useToast } from '../../components/ui/Toast';
import { atualizarPreferencias, usePreferencias } from '../../db/preferencias';

/**
 * Card discreto "Semana nova: planejar?" no topo de Hoje: aparece a partir da primeira
 * abertura da semana. "Agora não" esconde até a semana seguinte; "Não mostrar mais"
 * desliga o convite (reativável em Ajustes). Nunca bloqueia a tela.
 */
export function ConviteSemana({ agora }: { agora: Date }) {
  const prefs = usePreferencias();
  const navegar = useNavigate();
  const toast = useToast();
  const cal = { ...CALENDARIO_PADRAO, inicioSemana: prefs.inicioSemana };
  if (!prefs.carregado || !mostrarConvitePlanejar(prefs, agora, cal)) return null;

  const tratar = () => atualizarPreferencias({ semanaConviteTratada: chaveDaSemana(agora, cal) });

  return (
    <section
      aria-label="Convite para planejar a semana"
      className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 dark:border-indigo-900/70 dark:bg-indigo-950/40"
    >
      <div className="flex items-center gap-2">
        <CalendarRange size={20} className="shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
        <p className="min-w-0 flex-1 text-[15px] font-medium">Semana nova: planejar?</p>
        <Botao
          variante="primario"
          className="px-3"
          onClick={async () => {
            await tratar();
            navegar('/semana?planejar=1');
          }}
        >
          Planejar
        </Botao>
      </div>
      <div className="-mx-2 mt-1 flex gap-1">
        <Botao variante="fantasma" className="px-2 text-sm" onClick={tratar}>
          Agora não
        </Botao>
        <Botao
          variante="fantasma"
          className="px-2 text-sm"
          onClick={async () => {
            await atualizarPreferencias({ convitePlanejar: false });
            toast({ texto: 'Convite desligado', acao: { rotulo: 'Desfazer', fn: () => atualizarPreferencias({ convitePlanejar: true }) } });
          }}
        >
          Não mostrar mais
        </Botao>
      </div>
    </section>
  );
}
