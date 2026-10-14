import type { Atividade, Evento } from '@rumo/core';
import { criarApp } from '../app';
import { Banco, type InscricaoPush } from '../banco';
import type { Config } from '../config';
import type { EnviadorPush, MensagemPush, ResultadoEnvio } from '../push';

export const TOKEN = 'token-de-teste-com-mais-de-16';

export const config = (p: Partial<Config> = {}): Config => ({
  token: TOKEN,
  porta: 0,
  host: '127.0.0.1',
  dados: './dados-teste',
  origens: '*',
  fuso: 'America/Sao_Paulo',
  contatoPush: 'mailto:teste@localhost',
  ...p,
});

/** Envio de push falso: guarda o que seria enviado e responde o que o teste mandar. */
export function pushFalso(resposta: (i: InscricaoPush) => ResultadoEnvio = () => 'ok') {
  const enviados: { endpoint: string; mensagem: MensagemPush }[] = [];
  const push: EnviadorPush = {
    chavePublica: 'chave-publica-de-teste',
    async enviar(i, mensagem) {
      const r = resposta(i);
      if (r === 'ok') enviados.push({ endpoint: i.endpoint, mensagem });
      return r;
    },
  };
  return { push, enviados };
}

export function montar(agora = new Date('2026-10-14T15:00:00.000Z')) {
  const banco = new Banco();
  const { push, enviados } = pushFalso();
  const app = criarApp({ config: config(), banco, push, agora: () => agora });
  return { app, banco, enviados };
}

export const auth = { authorization: `Bearer ${TOKEN}` };

const T = '2026-10-14T12:00:00.000Z';
export const atividade = (p: Partial<Atividade> = {}): Atividade => ({
  id: 'a1',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  nome: 'Violão',
  categoria: 'hobby',
  duracaoPadraoMin: 30,
  metaSemanal: 3,
  cor: '#6366f1',
  pausada: false,
  limiteDias: null,
  ...p,
});

export const evento = (p: Partial<Evento> = {}): Evento => ({
  id: 'e1',
  criadoEm: T,
  atualizadoEm: T,
  excluidoEm: null,
  titulo: 'Dentista',
  inicio: '2026-10-14T18:00:00.000Z',
  fim: '2026-10-14T19:00:00.000Z',
  fixo: true,
  pessoaId: null,
  rrule: null,
  exdatas: [],
  serieId: null,
  ocorrenciaOriginal: null,
  ...p,
});

export const inscricao = (n = 1): InscricaoPush => ({
  endpoint: `https://web.push.apple.com/aparelho-${n}`,
  keys: { p256dh: 'p256dh', auth: 'auth' },
});
