import {
  CALENDARIO_PADRAO,
  ID_PREFERENCIAS,
  PREFERENCIAS_PADRAO,
  type Calendario,
  type DiaSemana,
  type Preferencias,
} from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

type Ajustaveis = Pick<Preferencias, keyof typeof PREFERENCIAS_PADRAO>;

/** Preferências salvas, com os padrões preenchidos; os padrões enquanto carrega. */
export function usePreferencias(): Ajustaveis & { carregado: boolean } {
  const prefs = useLiveQuery(() => db.preferencias.get(ID_PREFERENCIAS).then((p) => p ?? null));
  return { ...PREFERENCIAS_PADRAO, ...(prefs ?? {}), carregado: prefs !== undefined };
}

/** Calendário do usuário (fuso + início da semana). */
export function useCalendario(): Calendario {
  const { inicioSemana } = usePreferencias();
  return { ...CALENDARIO_PADRAO, inicioSemana };
}

export async function atualizarPreferencias(mudancas: Partial<Ajustaveis>) {
  const t = new Date().toISOString();
  await db.transaction('rw', db.preferencias, async () => {
    const atual = await db.preferencias.get(ID_PREFERENCIAS);
    await db.preferencias.put({
      ...PREFERENCIAS_PADRAO,
      ...atual,
      ...mudancas,
      id: ID_PREFERENCIAS,
      criadoEm: atual?.criadoEm ?? t,
      atualizadoEm: t,
      excluidoEm: null,
    });
  });
}

export const definirInicioSemana = (inicioSemana: DiaSemana) => atualizarPreferencias({ inicioSemana });
