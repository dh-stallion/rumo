import { combinarDataHora, paraDataLocal, type Pessoa } from '@rumo/core';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput, Interruptor, Stepper } from '../../components/ui/Campos';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';
import { atualizar, criar, excluir, type Dados } from '../../db/repo';

export function PessoaForm({ pessoa, onFechar }: { pessoa?: Pessoa; onFechar: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [frequencia, setFrequencia] = useState(pessoa?.frequenciaDias ?? 14);
  const [ultimo, setUltimo] = useState(pessoa?.ultimoContato ? paraDataLocal(pessoa.ultimoContato) : '');
  const [notas, setNotas] = useState(pessoa?.notas ?? '');
  const [pausada, setPausada] = useState(pessoa?.pausada ?? false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    // Se a data não mudou, preserva a hora exata do último contato.
    const mesmaData = pessoa?.ultimoContato && paraDataLocal(pessoa.ultimoContato) === ultimo;
    const dados: Dados<Pessoa> = {
      nome: nome.trim(),
      frequenciaDias: frequencia,
      ultimoContato: mesmaData ? pessoa!.ultimoContato : ultimo ? combinarDataHora(ultimo, '12:00').toISOString() : null,
      notas,
      pausada,
    };
    if (pessoa) await atualizar(db.pessoas, pessoa.id, dados);
    else await criar(db.pessoas, dados);
    onFechar();
  }

  async function remover() {
    if (!pessoa) return;
    const desfazer = await excluir(db.pessoas, pessoa.id);
    onFechar();
    toast({ texto: `${pessoa.nome} removida`, acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo="Nome">
        <input className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus={!pessoa} required />
      </Campo>

      <Campo rotulo="Falar a cada" dica="Aparece em Hoje quando chegar a hora de dar um oi.">
        <Stepper
          rotulo="Falar a cada"
          valor={frequencia}
          onChange={setFrequencia}
          max={365}
          formatar={(v) => (v === 0 ? 'Sem lembrete' : `${v} ${v === 1 ? 'dia' : 'dias'}`)}
        />
      </Campo>

      <Campo rotulo="Último contato">
        <input
          type="date"
          className={classeInput}
          value={ultimo}
          max={paraDataLocal(new Date())}
          onChange={(e) => setUltimo(e.target.value)}
        />
      </Campo>

      <Campo rotulo="Notas">
        <textarea
          className={`${classeInput} min-h-24 py-2`}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Aniversário, assuntos pendentes, ideias de presente…"
        />
      </Campo>

      {pessoa && (
        <Interruptor rotulo="Pausar lembretes" dica="Não aparece em Hoje até você retomar." marcado={pausada} onChange={setPausada} />
      )}

      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!nome.trim()}>
          Salvar
        </Botao>
        {pessoa && (
          <Botao variante="perigo" aria-label="Remover pessoa" onClick={remover}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>
    </form>
  );
}
