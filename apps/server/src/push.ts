import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import webpush from 'web-push';
import type { InscricaoPush } from './banco';

export interface MensagemPush {
  titulo: string;
  corpo: string;
  /** Tela que abre ao tocar. */
  url: string;
  /** Notificações com a mesma tag se substituem em vez de empilhar. */
  tag: string;
}

export type ResultadoEnvio = 'ok' | 'expirada' | 'erro';

export interface EnviadorPush {
  chavePublica: string;
  enviar(inscricao: InscricaoPush, mensagem: MensagemPush): Promise<ResultadoEnvio>;
}

/**
 * Chaves VAPID: geradas na primeira execução e guardadas na pasta de dados. Trocar as
 * chaves invalida as inscrições existentes, então elas precisam persistir.
 */
export function chavesVapid(pasta: string): { publicKey: string; privateKey: string } {
  const arquivo = join(pasta, 'vapid.json');
  if (existsSync(arquivo)) return JSON.parse(readFileSync(arquivo, 'utf8'));
  mkdirSync(pasta, { recursive: true });
  const chaves = webpush.generateVAPIDKeys();
  writeFileSync(arquivo, JSON.stringify(chaves, null, 2), { mode: 0o600 });
  return chaves;
}

export function enviadorWebPush(chaves: { publicKey: string; privateKey: string }, contato: string): EnviadorPush {
  webpush.setVapidDetails(contato, chaves.publicKey, chaves.privateKey);
  return {
    chavePublica: chaves.publicKey,
    async enviar(inscricao, mensagem) {
      try {
        await webpush.sendNotification(inscricao, JSON.stringify(mensagem), { TTL: 6 * 3600, urgency: 'normal' });
        return 'ok';
      } catch (e) {
        // 404/410: o aparelho cancelou a inscrição (app removido, permissão revogada).
        const status = (e as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? 'expirada' : 'erro';
      }
    },
  };
}
