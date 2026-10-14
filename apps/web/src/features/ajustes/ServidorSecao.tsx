import { diasEntre, formatar } from '@rumo/core';
import { CloudOff, Copy, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput } from '../../components/ui/Campos';
import { classeCartao, Secao } from '../../components/ui/Pagina';
import { useToast } from '../../components/ui/Toast';
import { chamar, ErroServidor, lerServidor, normalizarUrl, salvarServidor, testarServidor, type Servidor } from '../../sync/cliente';
import { sincronizarAgora, useEstadoSync } from '../../sync/motor';

/** http:// a partir de uma página https:// é bloqueado pelo navegador (exceto localhost). */
const seraBloqueado = (url: string) =>
  location.protocol === 'https:' && /^http:\/\//i.test(url.trim()) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url.trim());

export function ServidorSecao() {
  const [servidor, setServidor] = useState<Servidor | null>(lerServidor);
  return (
    <Secao titulo="Servidor e sincronização">
      {servidor ? <Conectado servidor={servidor} onDesconectar={() => setServidor(null)} /> : <Conectar onConectar={setServidor} />}
    </Secao>
  );
}

function Conectar({ onConectar }: { onConectar: (s: Servidor) => void }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);

  async function conectar(e: FormEvent) {
    e.preventDefault();
    const s = { url: normalizarUrl(url), token: token.trim() };
    setTestando(true);
    setErro(null);
    try {
      await testarServidor(s);
      salvarServidor(s);
      onConectar(s);
      void sincronizarAgora();
      toast({ texto: 'Conectado ao servidor' });
    } catch (e) {
      setErro(e instanceof ErroServidor ? e.message : 'Não foi possível conectar.');
    } finally {
      setTestando(false);
    }
  }

  return (
    <form onSubmit={conectar} className={`${classeCartao} space-y-4 p-3`} aria-label="Conectar ao servidor">
      <p className="flex items-start gap-2 text-sm text-neutral-500">
        <Server size={18} className="mt-0.5 shrink-0" aria-hidden />
        Sem servidor, tudo fica só neste aparelho. Com ele, os dados sincronizam e chegam as notificações.
      </p>
      <Campo rotulo="Endereço do servidor">
        <input
          className={classeInput}
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="https://rumo.seu-nas…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </Campo>
      {seraBloqueado(url) && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          O app está em HTTPS, então o servidor também precisa estar: endereços http:// são bloqueados pelo navegador.
        </p>
      )}
      <Campo rotulo="Token">
        <input className={classeInput} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} required />
      </Campo>
      {erro && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {erro}
        </p>
      )}
      <Botao type="submit" variante="primario" className="w-full" disabled={testando || !url.trim() || !token.trim()}>
        {testando ? 'Testando…' : 'Conectar'}
      </Botao>
    </form>
  );
}

function Conectado({ servidor, onDesconectar }: { servidor: Servidor; onDesconectar: () => void }) {
  const toast = useToast();
  const agora = useAgora(15_000);
  const sync = useEstadoSync();
  const [feed, setFeed] = useState<string | null>(null);

  useEffect(() => {
    chamar<{ caminho: string }>(servidor, '/api/feed')
      .then(({ caminho }) => setFeed(`${normalizarUrl(servidor.url).replace(/^https?:/, 'webcal:')}${caminho}`))
      .catch(() => setFeed(null));
  }, [servidor]);

  const situacao =
    sync.situacao === 'sincronizando'
      ? 'Sincronizando…'
      : sync.situacao === 'erro'
        ? sync.erro
        : sync.ultima
          ? diasEntre(new Date(sync.ultima), agora) === 0 && agora.getTime() - new Date(sync.ultima).getTime() < 60_000
            ? 'Sincronizado agora'
            : `Sincronizado às ${formatar(sync.ultima, 'HH:mm')}`
          : 'Ainda não sincronizado';

  return (
    <div className="space-y-3">
      <div className={`${classeCartao} space-y-3 p-3`}>
        <dl className="text-[15px]">
          <dt className="text-sm text-neutral-500">Servidor</dt>
          <dd className="truncate font-medium">{servidor.url}</dd>
        </dl>
        <p
          role="status"
          data-sync={sync.situacao}
          className={`text-sm ${sync.situacao === 'erro' ? 'text-red-700 dark:text-red-300' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          {situacao}
        </p>
        <div className="flex gap-2">
          <Botao className="flex-1" disabled={sync.situacao === 'sincronizando'} onClick={() => void sincronizarAgora()}>
            <RefreshCw size={18} /> Sincronizar agora
          </Botao>
          <Botao
            variante="fantasma"
            aria-label="Desconectar do servidor"
            onClick={() => {
              salvarServidor(null);
              void sincronizarAgora();
              onDesconectar();
              toast({ texto: 'Desconectado; os dados continuam neste aparelho' });
            }}
          >
            <CloudOff size={18} />
          </Botao>
        </div>
      </div>

      {feed && (
        <div className={`${classeCartao} space-y-2 p-3 text-sm`} aria-label="Assinatura do calendário">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">Assinar no Calendário do iPhone</p>
          <p className="text-neutral-500">
            No iPhone: Ajustes → Calendário → Contas → Adicionar Conta → Outra → Adicionar Calendário Assinado, e cole o endereço. Ele
            se atualiza sozinho.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-neutral-100 px-2 py-2 text-xs dark:bg-neutral-800" data-feed>
              {feed}
            </code>
            <Botao
              className="px-2"
              aria-label="Copiar endereço do calendário"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(feed);
                  toast({ texto: 'Endereço copiado' });
                } catch {
                  toast({ texto: 'Não deu para copiar; selecione o texto' });
                }
              }}
            >
              <Copy size={18} />
            </Botao>
          </div>
        </div>
      )}
    </div>
  );
}
