import { chamar, ErroServidor, type Servidor } from './cliente';

export type SituacaoPush =
  /** O navegador não tem Web Push (no iPhone: só com o app instalado na tela inicial, iOS 16.4+). */
  | 'sem-suporte'
  /** A pessoa negou a permissão; só dá para reverter nos ajustes do sistema. */
  | 'bloqueada'
  | 'inativa'
  | 'ativa';

export const suportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Aberto pelo ícone da tela inicial (no iPhone, condição para receber notificações). */
export const estaInstalado = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** "base64url" da chave VAPID → bytes, como o PushManager pede. */
function chaveEmBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Situação deste aparelho, conferindo também se o servidor ainda tem a inscrição. */
export async function situacaoPush(servidor: Servidor): Promise<SituacaoPush> {
  if (!suportaPush()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueada';
  const atual = await inscricaoAtual();
  if (!atual) return 'inativa';
  const { inscrito } = await chamar<{ inscrito: boolean }>(servidor, '/api/push/estado', {
    method: 'POST',
    body: JSON.stringify({ endpoint: atual.endpoint }),
  });
  return inscrito ? 'ativa' : 'inativa';
}

/** Pede permissão, inscreve este aparelho e registra no servidor. Precisa vir de um toque. */
export async function ativarPush(servidor: Servidor): Promise<void> {
  if (!suportaPush()) throw new ErroServidor('Este navegador não recebe notificações.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new ErroServidor('Permissão para notificações não concedida.');
  const { chavePublica } = await chamar<{ chavePublica: string }>(servidor, '/api/push/chave');
  const reg = await navigator.serviceWorker.ready;
  let inscricao = await reg.pushManager.getSubscription();
  // Chave diferente (servidor novo): refaz a inscrição.
  if (inscricao && inscricao.options.applicationServerKey) {
    const atual = new Uint8Array(inscricao.options.applicationServerKey);
    const nova = chaveEmBytes(chavePublica);
    if (atual.length !== nova.length || atual.some((b, i) => b !== nova[i])) {
      await inscricao.unsubscribe();
      inscricao = null;
    }
  }
  inscricao ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chavePublica) });
  await chamar(servidor, '/api/push/inscricao', { method: 'POST', body: JSON.stringify({ inscricao: inscricao.toJSON() }) });
}

export async function desativarPush(servidor: Servidor): Promise<void> {
  const atual = await inscricaoAtual();
  if (!atual) return;
  await chamar(servidor, '/api/push/inscricao', { method: 'DELETE', body: JSON.stringify({ endpoint: atual.endpoint }) }).catch(() => {});
  await atual.unsubscribe();
}

export const enviarTeste = (servidor: Servidor) => chamar<{ enviados: number }>(servidor, '/api/push/teste', { method: 'POST' });
