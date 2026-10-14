import { timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import { ativo, criarBackup, gerarICS, paraDataLocal, validarMudancas, type PedidoSync, type RespostaSync } from '@rumo/core';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Banco, InscricaoPush } from './banco';
import { tokenDoFeed, type Config } from './config';
import type { EnviadorPush } from './push';

export interface Dependencias {
  config: Config;
  banco: Banco;
  push: EnviadorPush;
  agora?: () => Date;
}

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const ehInscricao = (v: unknown): v is InscricaoPush => {
  const i = v as InscricaoPush | null;
  return (
    !!i &&
    typeof i.endpoint === 'string' &&
    /^https:\/\//.test(i.endpoint) &&
    typeof i.keys?.p256dh === 'string' &&
    typeof i.keys?.auth === 'string'
  );
};

export function criarApp({ config, banco, push, agora = () => new Date() }: Dependencias): FastifyInstance {
  // A primeira sincronização de um aparelho pode trazer anos de histórico.
  const app = Fastify({ bodyLimit: 20 * 1024 * 1024, logger: false });

  app.register(cors, {
    origin: config.origens === '*' ? true : config.origens,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86_400,
  });

  // Tudo em /api exige o token, menos a verificação de saúde.
  app.addHook('onRequest', async (req, res) => {
    if (!req.url.startsWith('/api/') || req.url === '/api/saude' || req.method === 'OPTIONS') return;
    const [tipo, valor] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !valor || !iguais(valor, config.token)) {
      return res.code(401).send({ erro: 'Token inválido ou ausente.' });
    }
  });

  app.get('/api/saude', async () => ({ ok: true, servico: 'rumo', versao: 1 }));

  app.post<{ Body: PedidoSync }>('/api/sync', async (req, res): Promise<RespostaSync | void> => {
    const corpo = req.body;
    if (!corpo || typeof corpo !== 'object' || typeof corpo.cursor !== 'number' || corpo.cursor < 0) {
      return res.code(400).send({ erro: 'Pedido inválido: esperado { cursor, mudancas }.' });
    }
    const { validos, rejeitados } = validarMudancas(corpo.mudancas ?? {});
    banco.aplicar(validos);
    return { ...banco.desde(corpo.cursor), rejeitados };
  });

  app.get('/api/backup', async (_req, res) => {
    const backup = criarBackup(banco.todas(), agora());
    res.header('Content-Disposition', `attachment; filename="rumo-backup-${paraDataLocal(agora(), config.fuso)}.json"`);
    return backup;
  });

  app.get('/api/feed', async () => ({ caminho: `/feed/${tokenDoFeed(config.token)}.ics` }));

  // Feed assinável pelo Calendário do iPhone: protegido pelo token derivado na própria URL.
  app.get<{ Params: { arquivo: string } }>('/feed/:arquivo', async (req, res) => {
    if (!iguais(req.params.arquivo, `${tokenDoFeed(config.token)}.ics`)) return res.code(404).send();
    const t = banco.todas();
    const ics = gerarICS(
      {
        eventos: t.eventos,
        sessoes: t.sessoes.filter((s) => ativo(s) && s.origem === 'planejada'),
        atividades: t.atividades,
        pessoas: t.pessoas,
        projetos: t.projetos,
      },
      { feed: true, nome: 'Rumo', agora: agora(), fuso: config.fuso },
    );
    return res.type('text/calendar; charset=utf-8').header('Cache-Control', 'no-cache').send(ics);
  });

  app.get('/api/push/chave', async () => ({ chavePublica: push.chavePublica }));

  app.post<{ Body: { inscricao?: unknown } }>('/api/push/inscricao', async (req, res) => {
    const i = req.body?.inscricao;
    if (!ehInscricao(i)) return res.code(400).send({ erro: 'Inscrição de push inválida.' });
    banco.salvarInscricao({ endpoint: i.endpoint, keys: { p256dh: i.keys.p256dh, auth: i.keys.auth } }, agora());
    return { ok: true };
  });

  app.delete<{ Body: { endpoint?: string } }>('/api/push/inscricao', async (req, res) => {
    if (typeof req.body?.endpoint !== 'string') return res.code(400).send({ erro: 'Informe o endpoint.' });
    banco.removerInscricao(req.body.endpoint);
    return { ok: true };
  });

  app.post('/api/push/teste', async () => {
    let enviados = 0;
    for (const i of banco.inscricoes()) {
      const r = await push.enviar(i, { titulo: 'Rumo', corpo: 'Notificações funcionando.', url: '/ajustes', tag: 'teste' });
      if (r === 'expirada') banco.removerInscricao(i.endpoint);
      if (r === 'ok') enviados++;
    }
    return { enviados };
  });

  return app;
}
