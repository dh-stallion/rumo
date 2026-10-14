import { ativo, formatarReais, paraDataLocal, totalItens, type MetaFinanceira } from '@rumo/core';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Botao } from '../../components/ui/Botao';
import { CampoReais } from '../../components/ui/CampoReais';
import { Campo, classeInput, Interruptor } from '../../components/ui/Campos';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';
import { novaMeta } from '../../db/metas';
import { atualizar, excluir, useLista } from '../../db/repo';

/** Fim do ano corrente: um prazo inicial razoável para uma meta nova. */
const fimDoAno = () => `${paraDataLocal(new Date()).slice(0, 4)}-12-31`;

export function MetaForm({ meta, projetoInicial, onFechar }: { meta?: MetaFinanceira; projetoInicial?: string; onFechar: () => void }) {
  const toast = useToast();
  const navegar = useNavigate();
  const projetos = (useLista(db.projetos) ?? []).filter((p) => ativo(p));
  const [nome, setNome] = useState(meta?.nome ?? '');
  const [projetoId, setProjetoId] = useState(meta?.projetoId ?? projetoInicial ?? '');
  const [pelaSoma, setPelaSoma] = useState(meta ? meta.valorAlvoCentavos === null : !!projetoInicial);
  const [alvo, setAlvo] = useState<number | null>(meta?.valorAlvoCentavos ?? null);
  const [prazo, setPrazo] = useState(meta?.prazo ?? fimDoAno());
  const [saldo, setSaldo] = useState<number | null>(meta?.saldoInicialCentavos ?? 0);

  const projeto = projetos.find((p) => p.id === projetoId);
  const usaSoma = !!projeto && pelaSoma;
  const valido = nome.trim() !== '' && !!prazo && saldo !== null && (usaSoma || (alvo !== null && alvo > 0));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const dados = {
      nome: nome.trim(),
      valorAlvoCentavos: usaSoma ? null : alvo,
      prazo,
      saldoInicialCentavos: saldo!,
      projetoId: projeto ? projeto.id : null,
    };
    if (meta) {
      await atualizar(db.metas, meta.id, dados);
      onFechar();
    } else {
      const m = await novaMeta(dados);
      onFechar();
      navegar(`/planos/meta/${m.id}`);
    }
  }

  async function remover() {
    if (!meta) return;
    const desfazer = await excluir(db.metas, meta.id);
    onFechar();
    navegar('/planos?aba=metas');
    toast({ texto: `${meta.nome} excluída`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo="Nome">
        <input className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Euros para a viagem" autoFocus={!meta} required />
      </Campo>

      <Campo rotulo="Projeto (opcional)">
        <select className={classeInput} value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
          <option value="">Nenhum</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      {projeto && (
        <Interruptor
          rotulo="Alvo = soma dos itens do projeto"
          dica={`Hoje: ${formatarReais(totalItens(projeto))}. Acompanha os preços que você atualizar no projeto.`}
          marcado={pelaSoma}
          onChange={setPelaSoma}
        />
      )}

      {!usaSoma && (
        <Campo rotulo="Quanto quer juntar" dica="Sempre em reais. Para comprar euros, use quanto pretende gastar em reais.">
          <CampoReais rotulo="Quanto quer juntar" valor={alvo} onChange={setAlvo} />
        </Campo>
      )}

      <Campo rotulo="Até quando">
        <input type="date" className={classeInput} value={prazo} onChange={(e) => setPrazo(e.target.value)} required />
      </Campo>

      <Campo rotulo="Já tenho guardado" dica="O que já existe antes dos aportes que você vai registrar.">
        <CampoReais rotulo="Já tenho guardado" valor={saldo} onChange={setSaldo} />
      </Campo>

      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!valido}>
          {meta ? 'Salvar' : 'Criar meta'}
        </Botao>
        {meta && (
          <Botao variante="perigo" aria-label="Excluir meta" onClick={remover}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>
    </form>
  );
}
