import { Pagina } from '../../components/ui/Pagina';
import { MetasLista } from './MetasLista';
import { ProjetosLista } from './ProjetosLista';

/** Planos de longo prazo: projetos (marcos, próximas ações, itens) e metas financeiras, numa página só. */
export function PlanosPage() {
  return (
    <Pagina titulo="Planos">
      <ProjetosLista />
      <MetasLista />
    </Pagina>
  );
}
