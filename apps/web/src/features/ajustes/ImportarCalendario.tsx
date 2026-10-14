import { lerICS, planoImportacao, type PlanoImportacao } from '@rumo/core';
import { FileUp } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { plural } from '../../app/texto';
import { Botao } from '../../components/ui/Botao';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { importarEventos } from '../../db/acoes';
import { db } from '../../db/db';

interface Previa {
  plano: PlanoImportacao;
  avisos: string[];
  nome: string;
}

/** Importa eventos de um arquivo .ics (de outro calendário ou exportado pelo próprio Rumo). */
export function ImportarCalendario() {
  const toast = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    const texto = await arquivo.text();
    if (!/BEGIN:VCALENDAR/i.test(texto)) return setErro('Este arquivo não é um calendário (.ics).');
    const { eventos: lidos, avisos } = lerICS(texto);
    const [existentes, pessoas] = await Promise.all([db.eventos.toArray(), db.pessoas.toArray()]);
    const plano = planoImportacao(lidos, existentes, pessoas);
    if (!plano.novos.length && !plano.atualizar.length) {
      return setErro(plano.sessoesIgnoradas ? 'O arquivo só tem sessões de atividades, que não são importadas.' : 'Nenhum evento encontrado no arquivo.');
    }
    setPrevia({ plano, avisos, nome: arquivo.name });
  }

  async function confirmar() {
    if (!previa) return;
    const desfazer = await importarEventos(previa.plano);
    const total = previa.plano.novos.length + previa.plano.atualizar.length;
    setPrevia(null);
    toast({ texto: `${plural(total, 'evento importado', 'eventos importados')}`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <>
      <Botao className="w-full" onClick={() => entrada.current?.click()}>
        <FileUp size={18} /> Importar .ics
      </Botao>
      <input ref={entrada} type="file" accept=".ics,text/calendar" className="hidden" aria-label="Arquivo de calendário" onChange={escolher} />

      <Sheet aberto={previa !== null} onFechar={() => setPrevia(null)} titulo="Importar eventos?">
        {previa && (
          <div className="space-y-4 text-[15px]">
            <p>
              <strong>{previa.nome}</strong>: {plural(previa.plano.novos.length, 'evento novo', 'eventos novos')}
              {previa.plano.atualizar.length > 0 && `, ${plural(previa.plano.atualizar.length, 'já existe e será atualizado', 'já existem e serão atualizados')}`}
              {previa.plano.series > 0 && ` (${plural(previa.plano.series, 'com repetição', 'com repetição')})`}.
            </p>
            {previa.plano.sessoesIgnoradas > 0 && (
              <p className="text-sm text-neutral-500">
                {plural(previa.plano.sessoesIgnoradas, 'sessão de atividade não será importada', 'sessões de atividades não serão importadas')}.
              </p>
            )}
            {previa.avisos.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200" aria-label="Avisos">
                {previa.avisos.slice(0, 5).map((a) => (
                  <li key={a}>{a}</li>
                ))}
                {previa.avisos.length > 5 && <li>…e mais {previa.avisos.length - 5}.</li>}
              </ul>
            )}
            <div className="space-y-2">
              <Botao variante="primario" className="w-full" onClick={confirmar}>
                Importar
              </Botao>
              <Botao variante="fantasma" className="w-full" onClick={() => setPrevia(null)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet aberto={erro !== null} onFechar={() => setErro(null)} titulo="Não deu para importar">
        <p className="mb-4 text-[15px]">{erro}</p>
        <Botao className="w-full" onClick={() => setErro(null)}>
          Entendi
        </Botao>
      </Sheet>
    </>
  );
}
