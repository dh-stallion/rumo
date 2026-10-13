import { FUSO_PADRAO } from '@rumo/core';
import { useEffect, useState } from 'react';
import { definirTema, useTema, type Tema } from '../../app/tema';
import { Segmentado } from '../../components/ui/Campos';
import { classeCartao, Pagina, Secao } from '../../components/ui/Pagina';

const opcoesTema: { valor: Tema; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

export function AjustesPage() {
  const tema = useTema();
  const [persistente, setPersistente] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente, () => setPersistente(null));
  }, []);

  return (
    <Pagina titulo="Ajustes">
      <Secao titulo="Aparência">
        <Segmentado rotulo="Tema" valor={tema} opcoes={opcoesTema} onChange={definirTema} />
      </Secao>

      <Secao titulo="Dados">
        <dl className={`${classeCartao} divide-y divide-black/5 text-[15px] dark:divide-white/10`}>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt>Onde ficam</dt>
            <dd className="text-right text-neutral-500">Só neste aparelho</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt>Armazenamento persistente</dt>
            <dd className="text-right text-neutral-500">
              {persistente === null ? '—' : persistente ? 'Sim' : 'Não garantido'}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt>Fuso horário</dt>
            <dd className="text-right text-neutral-500">{FUSO_PADRAO.replace('_', ' ')}</dd>
          </div>
        </dl>
        <p className="mt-2 px-1 text-xs text-neutral-500">
          Instalado na tela inicial, o iPhone não apaga os dados do app. Backup e sincronização chegam numa próxima etapa.
        </p>
      </Secao>
    </Pagina>
  );
}
