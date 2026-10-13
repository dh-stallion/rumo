import { CALENDARIO_PADRAO, ID_PREFERENCIAS, type Calendario, type DiaSemana } from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

/** Calendário do usuário (fuso + início da semana); usa o padrão enquanto carrega. */
export function useCalendario(): Calendario {
  const prefs = useLiveQuery(() => db.preferencias.get(ID_PREFERENCIAS));
  return prefs ? { ...CALENDARIO_PADRAO, inicioSemana: prefs.inicioSemana } : CALENDARIO_PADRAO;
}

export async function definirInicioSemana(inicioSemana: DiaSemana) {
  const t = new Date().toISOString();
  const atual = await db.preferencias.get(ID_PREFERENCIAS);
  await db.preferencias.put({
    id: ID_PREFERENCIAS,
    inicioSemana,
    criadoEm: atual?.criadoEm ?? t,
    atualizadoEm: t,
    excluidoEm: null,
  });
}
