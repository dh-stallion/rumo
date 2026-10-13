import { ativo, novoId, type Registro } from '@rumo/core';
import type { Table, UpdateSpec } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export type Dados<T extends Registro> = Omit<T, keyof Registro>;

const agoraISO = () => new Date().toISOString();

/** O Dexie não consegue relacionar um objeto parcial a `UpdateSpec<T>` com T genérico. */
const spec = <T,>(mudancas: object) => mudancas as unknown as UpdateSpec<T>;

export async function criar<T extends Registro>(tabela: Table<T, string>, dados: Dados<T>): Promise<T> {
  const t = agoraISO();
  const registro = { ...dados, id: novoId(), criadoEm: t, atualizadoEm: t, excluidoEm: null } as T;
  await tabela.add(registro);
  return registro;
}

export async function atualizar<T extends Registro>(
  tabela: Table<T, string>,
  id: string,
  mudancas: Partial<Dados<T>>,
): Promise<void> {
  await tabela.update(id, spec<T>({ ...mudancas, atualizadoEm: agoraISO() }));
}

/** Exclusão lógica; devolve a função que desfaz. */
export async function excluir<T extends Registro>(tabela: Table<T, string>, id: string) {
  const t = agoraISO();
  await tabela.update(id, spec<T>({ excluidoEm: t, atualizadoEm: t }));
  return () => tabela.update(id, spec<T>({ excluidoEm: null, atualizadoEm: agoraISO() }));
}

/** Registros não excluídos da tabela, atualizados ao vivo. `undefined` enquanto carrega. */
export function useLista<T extends Registro>(tabela: Table<T, string>): T[] | undefined {
  return useLiveQuery(async () => (await tabela.toArray()).filter(ativo), [tabela]);
}
