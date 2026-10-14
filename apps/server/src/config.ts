import { createHmac } from 'node:crypto';
import { FUSO_PADRAO } from '@rumo/core';

export interface Config {
  /** Token único de acesso (uso pessoal). */
  token: string;
  porta: number;
  host: string;
  /** Pasta com o banco SQLite, as chaves VAPID e os backups diários. */
  dados: string;
  /** Origens liberadas no CORS; "*" aceita qualquer uma (o token protege as rotas). */
  origens: string[] | '*';
  fuso: string;
  /** Contato exigido pelo protocolo Web Push (mailto: ou https:). */
  contatoPush: string;
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.RUMO_TOKEN?.trim() ?? '';
  if (token.length < 16) {
    throw new Error('Defina RUMO_TOKEN com pelo menos 16 caracteres (ex.: gere com `openssl rand -hex 24`).');
  }
  const origens = env.RUMO_ORIGENS?.trim();
  return {
    token,
    porta: Number(env.RUMO_PORTA ?? 8787),
    host: env.RUMO_HOST ?? '0.0.0.0',
    dados: env.RUMO_DADOS ?? './dados',
    origens: !origens || origens === '*' ? '*' : origens.split(',').map((o) => o.trim()),
    fuso: env.RUMO_FUSO ?? FUSO_PADRAO,
    contatoPush: env.RUMO_CONTATO ?? 'mailto:rumo@localhost',
  };
}

/**
 * Token do feed .ics, derivado do token principal: vai na URL que o Calendário assina,
 * então não pode ser o próprio token (quem vê a URL só consegue ler o calendário).
 */
export const tokenDoFeed = (token: string) => createHmac('sha256', token).update('feed-ics').digest('hex').slice(0, 32);
