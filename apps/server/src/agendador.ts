import { ID_PREFERENCIAS, lembretesDevidos, PREFERENCIAS_PADRAO, type Lembrete } from '@rumo/core';
import type { Banco } from './banco';
import type { EnviadorPush } from './push';

/**
 * Uma rodada do agendador (roda a cada minuto): calcula os lembretes devidos com os dados
 * sincronizados e as preferências do app, envia para todos os aparelhos inscritos e marca
 * como enviado o que chegou a pelo menos um. Inscrições canceladas (404/410) são apagadas.
 * Sem nenhum aparelho inscrito, não faz nada (e não "gasta" lembretes).
 */
export async function executarLembretes(banco: Banco, push: EnviadorPush, agora: Date, fuso: string): Promise<Lembrete[]> {
  if (banco.inscricoes().length === 0) return [];
  const t = banco.todas();
  const prefs = t.preferencias.find((p) => p.id === ID_PREFERENCIAS && !p.excluidoEm);
  const devidos = lembretesDevidos(
    { atividades: t.atividades, sessoes: t.sessoes, pessoas: t.pessoas, adiamentos: t.adiamentos, eventos: t.eventos, projetos: t.projetos },
    prefs?.notificacoes ?? PREFERENCIAS_PADRAO.notificacoes,
    agora,
    banco.enviados(agora),
    { fuso, inicioSemana: prefs?.inicioSemana ?? PREFERENCIAS_PADRAO.inicioSemana },
  );

  const enviados: Lembrete[] = [];
  for (const l of devidos) {
    let chegou = false;
    for (const i of banco.inscricoes()) {
      const r = await push.enviar(i, { titulo: l.titulo, corpo: l.corpo, url: l.url, tag: l.chave });
      if (r === 'expirada') banco.removerInscricao(i.endpoint);
      if (r === 'ok') chegou = true;
    }
    // Falha temporária: tenta de novo na próxima rodada (um aviso de evento perde a validade sozinho).
    if (chegou) {
      banco.marcarEnviado(l.chave, agora);
      enviados.push(l);
    }
  }
  return enviados;
}
