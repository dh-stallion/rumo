import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarBackup, paraDataLocal } from '@rumo/core';
import type { Banco } from './banco';

/**
 * Um backup JSON por dia (mesmo formato do "Exportar dados" do app), guardando os
 * `manter` mais recentes. Devolve o arquivo criado, ou null se o de hoje já existe.
 */
export function salvarBackupDiario(banco: Banco, pasta: string, agora: Date, fuso: string, manter = 14): string | null {
  const dir = join(pasta, 'backups');
  mkdirSync(dir, { recursive: true });
  const arquivo = join(dir, `rumo-${paraDataLocal(agora, fuso)}.json`);
  if (existsSync(arquivo)) return null;
  writeFileSync(arquivo, JSON.stringify(criarBackup(banco.todas(), agora)));
  const antigos = readdirSync(dir)
    .filter((n) => /^rumo-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
    .slice(0, -manter);
  for (const n of antigos) rmSync(join(dir, n));
  return arquivo;
}
