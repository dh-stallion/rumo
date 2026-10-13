import { contarRegistros, diasEntre, formatar, FUSO_PADRAO, validarBackup, type Backup } from '@rumo/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { haDias, plural } from '../../app/texto';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Secao } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { entregarBackup, exportarBackup, importarBackup } from '../../db/backup';

type Persistencia = 'concedida' | 'negada' | 'indisponivel' | 'verificando';

const CHAVE_ULTIMO = 'rumo:ultimoBackup';

function lerUltimoBackup(): string | null {
  try {
    return localStorage.getItem(CHAVE_ULTIMO);
  } catch {
    return null;
  }
}

function resumo(backup: Backup) {
  const c = contarRegistros(backup.tabelas);
  return [
    plural(c.atividades, 'atividade', 'atividades'),
    plural(c.sessoes, 'sessão', 'sessões'),
    plural(c.pessoas, 'pessoa', 'pessoas'),
    plural(c.eventos, 'compromisso', 'compromissos'),
  ].join(', ');
}

export function DadosSecao() {
  const toast = useToast();
  const [persistencia, setPersistencia] = useState<Persistencia>('verificando');
  const [uso, setUso] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState(lerUltimoBackup);
  const [erros, setErros] = useState<string[] | null>(null);
  const [aImportar, setAImportar] = useState<Backup | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // Backup sempre pronto: o compartilhamento no iPhone precisa acontecer direto no toque.
  const atual = useLiveQuery(() => exportarBackup());

  async function pedirPersistencia() {
    if (!navigator.storage?.persist) return setPersistencia('indisponivel');
    try {
      setPersistencia((await navigator.storage.persist()) ? 'concedida' : 'negada');
    } catch {
      setPersistencia('indisponivel');
    }
    const est = await navigator.storage.estimate?.().catch(() => null);
    if (est?.usage != null) setUso(`${Math.max(1, Math.round(est.usage / 1024)).toLocaleString('pt-BR')} KB`);
  }

  useEffect(() => {
    void pedirPersistencia();
  }, []);

  async function exportar() {
    if (!atual) return;
    const r = await entregarBackup(atual);
    if (r === 'cancelado') return;
    const agora = new Date().toISOString();
    try {
      localStorage.setItem(CHAVE_ULTIMO, agora);
    } catch {
      // Só serve para exibir "último backup"; sem storage, segue sem.
    }
    setUltimo(agora);
    toast({ texto: r === 'compartilhado' ? 'Backup pronto' : 'Backup baixado' });
  }

  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    let json: unknown;
    try {
      json = JSON.parse(await arquivo.text());
    } catch {
      return setErros(['O arquivo não é um JSON válido.']);
    }
    const r = validarBackup(json);
    if (r.ok) setAImportar(r.backup);
    else setErros(r.erros);
  }

  async function confirmarImportacao() {
    if (!aImportar) return;
    try {
      await importarBackup(aImportar);
      setAImportar(null);
      toast({ texto: 'Dados importados' });
    } catch (e) {
      setAImportar(null);
      setErros([`Não foi possível importar; nada foi alterado. (${e instanceof Error ? e.message : String(e)})`]);
    }
  }

  const textoPersistencia: Record<Persistencia, string> = {
    verificando: 'Verificando…',
    concedida: 'Concedido',
    negada: 'Não concedido',
    indisponivel: 'Indisponível',
  };

  return (
    <>
      <Secao titulo="Backup">
        <div className={`${classeCartao} space-y-2 p-3`}>
          <Botao variante="primario" className="w-full" disabled={!atual} onClick={exportar}>
            <Download size={18} /> Exportar dados (JSON)
          </Botao>
          <Botao className="w-full" onClick={() => entrada.current?.click()}>
            <Upload size={18} /> Importar dados (JSON)
          </Botao>
          <input
            ref={entrada}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Arquivo de backup"
            onChange={escolherArquivo}
          />
        </div>
        <p className="mt-2 px-1 text-xs text-neutral-500">
          {ultimo ? `Último backup ${haDias(diasEntre(new Date(ultimo), new Date()))}.` : 'Nenhum backup feito neste aparelho ainda.'}{' '}
          No iPhone, escolha "Salvar em Arquivos" para guardar no iCloud Drive.
        </p>
      </Secao>

      <Secao titulo="Armazenamento">
        <dl className={`${classeCartao} divide-y divide-black/5 text-[15px] dark:divide-white/10`}>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt>Armazenamento persistente</dt>
            <dd className="text-right text-neutral-500" data-testid="persistencia">
              {textoPersistencia[persistencia]}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt>Dados</dt>
            <dd className="text-right text-neutral-500">Só neste aparelho</dd>
          </div>
          {uso && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt>Espaço usado pelo app</dt>
              <dd className="text-right text-neutral-500">{uso}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt>Fuso horário</dt>
            <dd className="text-right text-neutral-500">{FUSO_PADRAO.replace('_', ' ')}</dd>
          </div>
        </dl>
        <p className="mt-2 px-1 text-xs text-neutral-500">
          {persistencia === 'concedida'
            ? 'O navegador não vai apagar os dados por falta de espaço.'
            : 'Sem a garantia, o navegador pode apagar os dados se faltar espaço. Instalar o app na tela inicial costuma resolver; exporte backups com frequência.'}
        </p>
        {persistencia === 'negada' && (
          <Botao variante="fantasma" className="mt-1 text-indigo-600 dark:text-indigo-400" onClick={pedirPersistencia}>
            Pedir de novo
          </Botao>
        )}
      </Secao>

      <Sheet aberto={erros !== null} onFechar={() => setErros(null)} titulo="Não deu para importar">
        <p className="mb-3 text-[15px] text-neutral-600 dark:text-neutral-400">Seus dados atuais não foram alterados.</p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
          {erros?.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
          {erros && erros.length > 8 && <li>…e mais {plural(erros.length - 8, 'problema', 'problemas')}.</li>}
        </ul>
        <Botao className="w-full" onClick={() => setErros(null)}>
          Entendi
        </Botao>
      </Sheet>

      <Sheet aberto={aImportar !== null} onFechar={() => setAImportar(null)} titulo="Substituir os dados?">
        {aImportar && (
          <div className="space-y-4 text-[15px]">
            <p>
              O arquivo foi exportado em {formatar(aImportar.exportadoEm, "dd/MM/yyyy 'às' HH:mm")} e tem{' '}
              <strong>{resumo(aImportar)}</strong>.
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">
              Tudo o que está neste aparelho agora{atual ? ` (${resumo(atual)})` : ''} será apagado e substituído. Isso não pode
              ser desfeito.
            </p>
            <div className="space-y-2">
              <Botao variante="perigo" className="w-full" onClick={confirmarImportacao}>
                Substituir dados
              </Botao>
              <Botao className="w-full" disabled={!atual} onClick={exportar}>
                <Download size={18} /> Exportar os dados atuais antes
              </Botao>
              <Botao variante="fantasma" className="w-full" onClick={() => setAImportar(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
