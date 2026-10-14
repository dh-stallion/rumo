import type { DiaSemana } from '@rumo/core';
import { definirTema, useTema, type Tema } from '../../app/tema';
import { Interruptor, Segmentado } from '../../components/ui/Campos';
import { Pagina, Secao } from '../../components/ui/Pagina';
import { atualizarPreferencias, definirInicioSemana, useCalendario, usePreferencias } from '../../db/preferencias';
import { DadosSecao } from './DadosSecao';
import { ExportarCalendario } from './ExportarCalendario';

const opcoesInicioSemana = [
  { valor: '0', rotulo: 'Domingo' },
  { valor: '1', rotulo: 'Segunda' },
  { valor: '6', rotulo: 'Sábado' },
] as const;

const opcoesTema: { valor: Tema; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

export function AjustesPage() {
  const tema = useTema();
  const cal = useCalendario();
  const prefs = usePreferencias();

  return (
    <Pagina titulo="Ajustes">
      <Secao titulo="Aparência">
        <Segmentado rotulo="Tema" valor={tema} opcoes={opcoesTema} onChange={definirTema} />
      </Secao>

      <Secao titulo="Calendário">
        <p className="mb-2 px-1 text-sm text-neutral-500">A semana começa em</p>
        <Segmentado
          rotulo="Início da semana"
          valor={String(cal.inicioSemana)}
          opcoes={opcoesInicioSemana}
          onChange={(v) => definirInicioSemana(Number(v) as DiaSemana)}
        />
        <p className="mt-2 px-1 text-xs text-neutral-500">Vale para as metas semanais e para o planejador.</p>
        <div className="mt-4 px-1">
          <Interruptor
            rotulo="Convite para planejar a semana"
            dica="Um card discreto em Hoje, uma vez por semana, com atalho para a visão da semana toda."
            marcado={prefs.convitePlanejar}
            onChange={(v) => atualizarPreferencias({ convitePlanejar: v })}
          />
        </div>
      </Secao>

      <ExportarCalendario />

      <DadosSecao />
    </Pagina>
  );
}
