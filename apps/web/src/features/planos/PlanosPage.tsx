import { useSearchParams } from 'react-router';
import { Segmentado } from '../../components/ui/Campos';
import { Pagina } from '../../components/ui/Pagina';
import { MetasLista } from './MetasLista';
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
        <MetasLista />
      )}
    </Pagina>
  );
}
