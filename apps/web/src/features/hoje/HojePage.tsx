import {
  eventosDoDia,
  formatar,
  inicioDoDiaApos,
  itensDeAtencao,
  paraHoraLocal,
  posicaoNaSemana,
  type AlvoAdiamento,
  type ItemHoje,
} from '@rumo/core';
import { Check, Clock, Lock, Pause } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { haDias } from '../../app/texto';
import { useAgora } from '../../app/useAgora';
import { Botao } from '../../components/ui/Botao';
import { classeCartao, Pagina, Secao, Vazio } from '../../components/ui/Pagina';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { adiar, pausar, registrarContato, registrarSessao } from '../../db/acoes';
import { db } from '../../db/db';
import { useCalendario } from '../../db/preferencias';
import { excluir, useLista } from '../../db/repo';

type Alvo = { tipo: AlvoAdiamento; id: string; nome: string };

export function HojePage() {
  const agora = useAgora();
  const cal = useCalendario();
  const atividades = useLista(db.atividades);
  const sessoes = useLista(db.sessoes);
  const pessoas = useLista(db.pessoas);
  const adiamentos = useLista(db.adiamentos);
  const eventos = useLista(db.eventos);
  const [adiando, setAdiando] = useState<Alvo | null>(null);

  const subtitulo = formatar(agora, "EEEE, d 'de' MMMM");

  if (!atividades || !sessoes || !pessoas || !adiamentos || !eventos) {
    return <Pagina titulo="Hoje" subtitulo={subtitulo}>{null}</Pagina>;
  }

  const itens = itensDeAtencao({ atividades, sessoes, pessoas, adiamentos }, agora, cal);
  const deHoje = eventosDoDia(eventos, agora);
  const nomePessoa = (id: string | null) => pessoas.find((p) => p.id === id)?.nome;

  return (
    <Pagina titulo="Hoje" subtitulo={subtitulo}>
      {deHoje.length > 0 && (
        <Secao titulo="Agenda">
          <ul className={`${classeCartao} divide-y divide-black/5 dark:divide-white/10`}>
            {deHoje.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-neutral-500">
                  {paraHoraLocal(e.inicio)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.titulo}</span>
                  {e.pessoaId && <span className="block text-sm text-neutral-500">com {nomePessoa(e.pessoaId)}</span>}
                </span>
                {e.fixo && <Lock size={16} className="text-neutral-400" aria-label="Fixo" />}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Pede atenção">
        {itens.length === 0 ? (
          <Vazio>
            <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Tudo em dia por aqui.</p>
            <p className="mt-1 text-sm">Aproveite o dia — o que precisar de você aparece aqui.</p>
          </Vazio>
        ) : (
          <ul className="space-y-3">
            {itens.map((item) => (
              <li key={item.tipo === 'atividade' ? item.atividade.id : item.pessoa.id}>
                <CartaoHoje item={item} onAdiar={setAdiando} />
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <AdiarSheet alvo={adiando} agora={agora} diasAteProximaSemana={7 - posicaoNaSemana(agora, cal)} onFechar={() => setAdiando(null)} />
    </Pagina>
  );
}

function CartaoHoje({ item, onAdiar }: { item: ItemHoje; onAdiar: (a: Alvo) => void }) {
  const toast = useToast();

  if (item.tipo === 'atividade') {
    const { atividade: a, nuncaPraticada, diasSemSessao, progresso } = item;
    const motivos = [
      nuncaPraticada && 'Ainda não praticou',
      diasSemSessao !== null && `Última vez ${haDias(diasSemSessao)}`,
      progresso && `${progresso.feitas} de ${progresso.meta} esta semana`,
    ].filter(Boolean);
    return (
      <Cartao cor={a.cor} titulo={a.nome} motivos={motivos as string[]}>
        <Botao
          variante="primario"
          onClick={async () => {
            const s = await registrarSessao(a);
            toast({ texto: `${a.nome}: registrado`, acao: { rotulo: 'Desfazer', fn: () => excluir(db.sessoes, s.id) } });
          }}
        >
          <Check size={18} /> Feito
        </Botao>
        <Botao onClick={() => onAdiar({ tipo: 'atividade', id: a.id, nome: a.nome })}>
          <Clock size={18} /> Adiar
        </Botao>
        <Botao
          variante="fantasma"
          onClick={async () => {
            const desfazer = await pausar('atividade', a.id);
            toast({ texto: `${a.nome} pausada`, acao: { rotulo: 'Desfazer', fn: desfazer } });
          }}
        >
          <Pause size={18} /> Pausar
        </Botao>
      </Cartao>
    );
  }

  const { pessoa: p, diasSemContato } = item;
  return (
    <Cartao cor="#94a3b8" titulo={p.nome} motivos={[`Último contato ${haDias(diasSemContato)}`]}>
      <Botao
        variante="primario"
        onClick={async () => {
          const desfazer = await registrarContato(p);
          toast({ texto: `Contato com ${p.nome} registrado`, acao: { rotulo: 'Desfazer', fn: desfazer } });
        }}
      >
        <Check size={18} /> Falei
      </Botao>
      <Botao onClick={() => onAdiar({ tipo: 'pessoa', id: p.id, nome: p.nome })}>
        <Clock size={18} /> Adiar
      </Botao>
      <Botao
        variante="fantasma"
        onClick={async () => {
          const desfazer = await pausar('pessoa', p.id);
          toast({ texto: `Lembretes de ${p.nome} pausados`, acao: { rotulo: 'Desfazer', fn: desfazer } });
        }}
      >
        <Pause size={18} /> Pausar
      </Botao>
    </Cartao>
  );
}

function Cartao({
  cor,
  titulo,
  motivos,
  children,
}: {
  cor: string;
  titulo: string;
  motivos: string[];
  children: ReactNode;
}) {
  return (
    <article className={`${classeCartao} overflow-hidden`}>
      <div className="flex gap-3 px-4 pt-3.5 pb-3">
        <span className="mt-1 w-1.5 shrink-0 self-stretch rounded-full" style={{ backgroundColor: cor }} aria-hidden />
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold">{titulo}</h3>
          {motivos.map((m) => (
            <p key={m} className="text-sm text-neutral-500">
              {m}
            </p>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">{children}</div>
    </article>
  );
}

function AdiarSheet({
  alvo,
  agora,
  diasAteProximaSemana,
  onFechar,
}: {
  alvo: Alvo | null;
  agora: Date;
  diasAteProximaSemana: number;
  onFechar: () => void;
}) {
  const toast = useToast();
  const opcoes = [
    { rotulo: 'Amanhã', dias: 1 },
    { rotulo: 'Em 3 dias', dias: 3 },
    { rotulo: 'Semana que vem', dias: diasAteProximaSemana },
  ];
  return (
    <Sheet aberto={alvo !== null} onFechar={onFechar} titulo={alvo ? `Adiar ${alvo.nome}` : 'Adiar'}>
      <div className="space-y-2 pb-2">
        {opcoes.map((o) => (
          <Botao
            key={o.rotulo}
            className="w-full justify-between"
            onClick={async () => {
              if (!alvo) return;
              const desfazer = await adiar(alvo.tipo, alvo.id, o.dias);
              onFechar();
              toast({ texto: `Volta a aparecer ${o.rotulo.toLowerCase()}`, acao: { rotulo: 'Desfazer', fn: desfazer } });
            }}
          >
            <span>{o.rotulo}</span>
            <span className="text-sm text-neutral-500">{formatar(inicioDoDiaApos(agora, o.dias), 'EEE, d/MM')}</span>
          </Botao>
        ))}
      </div>
    </Sheet>
  );
}
