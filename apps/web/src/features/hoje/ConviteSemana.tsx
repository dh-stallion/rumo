import { CALENDARIO_PADRAO, chaveDaSemana, mostrarConvitePlanejar } from '@rumo/core';
import { CalendarRange, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Botao } from '../../components/ui/Botao';
import { atualizarPreferencias, usePreferencias } from '../../db/preferencias';

/**
 * Card discreto "Semana nova: planejar?" no topo de Hoje: aparece a partir da primeira
 * abertura da semana e some ao ser aceito ou dispensado, até a semana seguinte.
 * Nunca bloqueia a tela.
 */
export function ConviteSemana({ agora }: { agora: Date }) {
  const prefs = usePreferencias();
  const navegar = useNavigate();
  const cal = { ...CALENDARIO_PADRAO, inicioSemana: prefs.inicioSemana };
  if (!prefs.carregado || !mostrarConvitePlanejar(prefs, agora, cal)) return null;

  const tratar = () => atualizarPreferencias({ semanaConviteTratada: chaveDaSemana(agora, cal) });

  return (
    <section
      aria-label="Convite para planejar a semana"
      className="mb-5 flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 py-1 pr-1 pl-3.5 dark:border-indigo-900/70 dark:bg-indigo-950/40"
    >
      <CalendarRange size={20} className="shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
      <p className="min-w-0 flex-1 text-[15px]">Semana nova: planejar?</p>
      <Botao
        variante="fantasma"
        className="px-3 font-semibold text-indigo-700 dark:text-indigo-300"
        onClick={async () => {
          await tratar();
          navegar('/semana?planejar=1');
        }}
      >
        Planejar
      </Botao>
      <Botao variante="fantasma" className="px-2" aria-label="Dispensar convite" onClick={tratar}>
        <X size={20} />
      </Botao>
    </section>
  );
}
