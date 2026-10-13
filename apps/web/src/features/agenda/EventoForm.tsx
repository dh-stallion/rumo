import { combinarDataHora, paraDataLocal, paraHoraLocal, type Evento, type Pessoa } from '@rumo/core';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Botao } from '../../components/ui/Botao';
import { Campo, classeInput, Interruptor } from '../../components/ui/Campos';
import { useToast } from '../../components/ui/Toast';
import { db } from '../../db/db';
import { atualizar, criar, excluir, type Dados } from '../../db/repo';

function proximaHoraCheia() {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return d;
}

export function EventoForm({
  evento,
  pessoas,
  onFechar,
}: {
  evento?: Evento;
  pessoas: Pessoa[];
  onFechar: () => void;
}) {
  const toast = useToast();
  const base = evento ? new Date(evento.inicio) : proximaHoraCheia();
  const fimBase = evento ? new Date(evento.fim) : new Date(base.getTime() + 3_600_000);
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [data, setData] = useState(paraDataLocal(base));
  const [inicio, setInicio] = useState(paraHoraLocal(base));
  const [fim, setFim] = useState(paraHoraLocal(fimBase));
  const [fixo, setFixo] = useState(evento?.fixo ?? true);
  const [pessoaId, setPessoaId] = useState(evento?.pessoaId ?? '');

  const ini = data && inicio ? combinarDataHora(data, inicio) : null;
  let fimData = data && fim ? combinarDataHora(data, fim) : null;
  // "23:00–01:00" termina no dia seguinte.
  if (ini && fimData && fimData <= ini) fimData = new Date(fimData.getTime() + 86_400_000);
  const valido = titulo.trim() && ini && fimData && fimData > ini;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const dados: Dados<Evento> = {
      titulo: titulo.trim(),
      inicio: ini!.toISOString(),
      fim: fimData!.toISOString(),
      fixo,
      pessoaId: pessoaId || null,
      rrule: evento?.rrule ?? null,
    };
    if (evento) await atualizar(db.eventos, evento.id, dados);
    else await criar(db.eventos, dados);
    onFechar();
  }

  async function remover() {
    if (!evento) return;
    const desfazer = await excluir(db.eventos, evento.id);
    onFechar();
    toast({ texto: 'Evento removido', acao: { rotulo: 'Desfazer', fn: desfazer } });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Campo rotulo="Título">
        <input className={classeInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus={!evento} required />
      </Campo>

      <Campo rotulo="Data">
        <input type="date" className={classeInput} value={data} onChange={(e) => setData(e.target.value)} required />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Início">
          <input type="time" className={classeInput} value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </Campo>
        <Campo rotulo="Fim">
          <input type="time" className={classeInput} value={fim} onChange={(e) => setFim(e.target.value)} required />
        </Campo>
      </div>

      <Campo rotulo="Com quem (opcional)">
        <select className={classeInput} value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
          <option value="">Ninguém</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Interruptor
        rotulo="Horário fixo"
        dica="No planejador, aparece travado e avisa sobre conflitos."
        marcado={fixo}
        onChange={setFixo}
      />

      <div className="flex gap-2 pt-1">
        <Botao type="submit" variante="primario" className="flex-1" disabled={!valido}>
          Salvar
        </Botao>
        {evento && (
          <Botao variante="perigo" aria-label="Remover evento" onClick={remover}>
            <Trash2 size={18} />
          </Botao>
        )}
      </div>
    </form>
  );
}
