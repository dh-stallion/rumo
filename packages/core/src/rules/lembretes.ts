import { chaveEvento, expandirEventos } from '../calendario/eventos';
import { ativo, PREFERENCIAS_PADRAO, type Adiamento, type Atividade, type Evento, type Pessoa, type PreferenciasNotificacao, type Projeto, type Sessao } from '../model';
import { CALENDARIO_PADRAO, combinarDataHora, paraDataLocal, paraHoraLocal, type Calendario } from '../time';
import { compromissosDeHoje } from './compromissos';
import { contatoPendente, diasSemContato } from './contato';
import { estaAdiado } from './adiamento';
import { itensDeAtencao } from './hoje';

/** Uma notificação a enviar. `chave` identifica o lembrete para nunca repetir. */
export interface Lembrete {
  chave: string;
  titulo: string;
  corpo: string;
  /** Tela que abre ao tocar. */
  url: string;
}

export interface DadosLembretes {
  atividades: readonly Atividade[];
  sessoes: readonly Sessao[];
  pessoas: readonly Pessoa[];
  adiamentos: readonly Adiamento[];
  eventos: readonly Evento[];
  projetos?: readonly Projeto[];
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Lembretes devidos em `agora` que ainda não foram enviados (`enviados` tem as chaves).
 * O tom é leve: o resumo só sai se houver algo; contato sai uma vez por vez que vence,
 * e só a partir do horário do resumo, para não chegar de madrugada. Pausar e adiar no app
 * também silenciam os lembretes.
 */
export function lembretesDevidos(
  dados: DadosLembretes,
  prefs: PreferenciasNotificacao = PREFERENCIAS_PADRAO.notificacoes,
  agora: Date,
  enviados: ReadonlySet<string>,
  cal: Calendario = CALENDARIO_PADRAO,
): Lembrete[] {
  const hoje = paraDataLocal(agora, cal.fuso);
  const depoisDoResumo = agora >= combinarDataHora(hoje, prefs.horaResumo, cal.fuso);
  const lembretes: Lembrete[] = [];

  if (prefs.resumo && depoisDoResumo && !enviados.has(`resumo:${hoje}`)) {
    const itens = itensDeAtencao(dados, agora, cal);
    const compromissos = compromissosDeHoje({ ...dados, projetos: dados.projetos ?? [] }, agora, cal.fuso).filter(
      (c) => new Date(c.fim) > agora,
    );
    const partes = [
      itens.length > 0 && `${plural(itens.length, 'coisa pede', 'coisas pedem')} atenção`,
      compromissos.length > 0 &&
        `${plural(compromissos.length, 'compromisso', 'compromissos')} (${compromissos
          .slice(0, 2)
          .map((c) => `${c.titulo} às ${paraHoraLocal(c.inicio, cal.fuso)}`)
          .join(', ')}${compromissos.length > 2 ? '…' : ''})`,
    ].filter(Boolean);
    if (partes.length) lembretes.push({ chave: `resumo:${hoje}`, titulo: 'Seu dia', corpo: partes.join(' · '), url: '/' });
  }

  if (prefs.eventos) {
    const limite = new Date(agora.getTime() + prefs.minutosAntes * 60_000);
    for (const e of expandirEventos(dados.eventos, agora, limite, cal.fuso)) {
      const inicio = new Date(e.inicio);
      const chave = `evento:${chaveEvento(e)}:${e.inicio}`;
      if (!e.fixo || inicio <= agora || inicio > limite || enviados.has(chave)) continue;
      const minutos = Math.round((inicio.getTime() - agora.getTime()) / 60_000);
      lembretes.push({
        chave,
        titulo: e.titulo,
        corpo: `Às ${paraHoraLocal(e.inicio, cal.fuso)} (em ${plural(minutos, 'minuto', 'minutos')})`,
        url: '/semana',
      });
    }
  }

  if (prefs.contatos && depoisDoResumo) {
    for (const p of dados.pessoas) {
      if (!ativo(p) || !contatoPendente(p, agora, cal.fuso) || estaAdiado('pessoa', p.id, dados.adiamentos, agora)) continue;
      // Uma vez por "vencimento": muda quando você registra um contato novo.
      const chave = `contato:${p.id}:${p.ultimoContato ?? p.criadoEm}`;
      if (enviados.has(chave)) continue;
      const dias = diasSemContato(p, agora, cal.fuso);
      lembretes.push({ chave, titulo: `Que tal falar com ${p.nome}?`, corpo: `Último contato há ${plural(dias, 'dia', 'dias')}.`, url: '/semana?visao=pessoas' });
    }
  }

  return lembretes;
}
