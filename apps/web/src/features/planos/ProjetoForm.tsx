import type { Projeto } from '@rumo/core';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput, Interruptor } from '../../components/ui/Campos';
import { CORES, SeletorCor } from '../../components/ui/SeletorCor';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';
import { novoProjeto } from '../../db/projetos';
import { atualizar, excluir } from '../../db/repo';

export function ProjetoForm({ projeto, onFechar }: { projeto?: Projeto; onFechar: () => void }) {
  const toast = useToast();
  const navegar = useNavigate();
  const [nome, setNome] = useState(projeto?.nome ?? '');
  const [descricao, setDescricao] = useState(projeto?.descricao ?? '');
  const [cor, setCor] = useState(projeto?.cor ?? CORES[1]!);
  const [arquivado, setArquivado] = useState(projeto?.arquivado ?? false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    if (projeto) {
      await atualizar(db.projetos, projeto.id, { nome: nome.trim(), descricao, cor, arquivado });
      onFechar();
    } else {
      const p = await novoProjeto({ nome: nome.trim(), descricao, cor });
      onFechar();
      navegar(`/planos/projeto/${p.id}`);
    }
  }

  async function remover() {
    if (!projeto) return;
    const desfazer = await excluir(db.projetos, projeto.id);
    onFechar();
    navegar('/planos');
    toast({ texto: `${projeto.nome} excluído`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo="Nome">
        <input className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Montar um NAS" autoFocus={!projeto} required />
      </Campo>
      <Campo rotulo="Descrição (opcional)">
        <textarea className={`${classeInput} min-h-20 py-2`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>
      <SeletorCor valor={cor} onChange={setCor} />
      {projeto && (
        <Interruptor rotulo="Arquivado" dica="Sai da lista principal e as ações deixam o banco de afazeres." marcado={arquivado} onChange={setArquivado} />
      )}
      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!nome.trim()}>
          {projeto ? 'Salvar' : 'Criar projeto'}
        </Botao>
        {projeto && (
          <Botao variante="perigo" aria-label="Excluir projeto" onClick={remover}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>
    </form>
  );
}
