import { useSearchParams } from 'react-router';
import { Segmentado } from '../../components/ui/Campos';
import { Pagina, Vazio } from '../../components/ui/Pagina';
import { ProjetosLista } from './ProjetosLista';

type Aba = 'projetos' | 'metas';

/** Planos de longo prazo: projetos (marcos, próximas ações, itens) e metas financeiras. */
export function PlanosPage() {
  const [params, setParams] = useSearchParams();
  const aba: Aba = params.get('aba') === 'metas' ? 'metas' : 'projetos';

  return (
    <Pagina titulo="Planos">
      <div className="mb-5">
        <Segmentado
          rotulo="Planos"
          valor={aba}
          opcoes={[
            { valor: 'projetos', rotulo: 'Projetos' },
            { valor: 'metas', rotulo: 'Metas' },
          ]}
          onChange={(v) => setParams(v === 'projetos' ? {} : { aba: v }, { replace: true })}
        />
      </div>
      {aba === 'projetos' ? (
        <ProjetosLista />
      ) : (
        <Vazio>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Nenhuma meta ainda.</p>
        </Vazio>
      )}
    </Pagina>
  );
}
