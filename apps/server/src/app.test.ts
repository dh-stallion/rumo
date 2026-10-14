import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerICS, validarBackup, type RespostaSync } from '@rumo/core';
import { describe, expect, it } from 'vitest';
import { salvarBackupDiario } from './backupDiario';
import { lerConfig, tokenDoFeed } from './config';
import { atividade, auth, evento, inscricao, montar, TOKEN } from './teste/apoio';

const sync = async (app: ReturnType<typeof montar>['app'], cursor: number, mudancas: object = {}) => {
  const r = await app.inject({ method: 'POST', url: '/api/sync', headers: auth, payload: { cursor, mudancas } });
  expect(r.statusCode).toBe(200);
  return r.json() as RespostaSync;
};

describe('acesso', () => {
  it('saúde é aberta; o resto exige o token', async () => {
    const { app } = montar();
    expect((await app.inject({ url: '/api/saude' })).json()).toMatchObject({ ok: true, servico: 'rumo' });
    expect((await app.inject({ method: 'POST', url: '/api/sync', payload: { cursor: 0 } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/backup', headers: { authorization: 'Bearer errado' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/backup', headers: auth })).statusCode).toBe(200);
  });

  it('CORS responde ao preflight do app (outra origem)', async () => {
    const { app } = montar();
    const r = await app.inject({
      method: 'OPTIONS',
      url: '/api/sync',
      headers: { origin: 'https://rumo.netlify.app', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' },
    });
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('https://rumo.netlify.app');
  });

  it('exige um token de pelo menos 16 caracteres', () => {
    expect(() => lerConfig({ RUMO_TOKEN: 'curto' })).toThrow(/RUMO_TOKEN/);
    expect(lerConfig({ RUMO_TOKEN: TOKEN, RUMO_ORIGENS: 'https://a.app, https://b.app' }).origens).toEqual(['https://a.app', 'https://b.app']);
  });
});

describe('sincronização', () => {
  it('um aparelho envia, outro recebe; cursor avança', async () => {
    const { app } = montar();
    const a = await sync(app, 0, { atividades: [atividade()] });
    expect(a.rejeitados).toEqual([]);
    expect(a.cursor).toBe(1);
    const b = await sync(app, 0);
    expect(b.mudancas.atividades).toEqual([atividade()]);
    expect(await sync(app, b.cursor)).toEqual({ cursor: 1, mudancas: {}, rejeitados: [] });
  });

  it('last-write-wins: o mais novo vence, o antigo é ignorado, reenviar não muda nada', async () => {
    const { app } = montar();
    await sync(app, 0, { atividades: [atividade({ nome: 'Violão', atualizadoEm: '2026-10-14T12:00:00.000Z' })] });
    await sync(app, 0, { atividades: [atividade({ nome: 'Guitarra', atualizadoEm: '2026-10-14T13:00:00.000Z' })] });
    await sync(app, 0, { atividades: [atividade({ nome: 'Antigo', atualizadoEm: '2026-10-14T11:00:00.000Z' })] });
    const r = await sync(app, 0, { atividades: [atividade({ nome: 'Guitarra', atualizadoEm: '2026-10-14T13:00:00.000Z' })] });
    expect(r.mudancas.atividades!.map((a) => a.nome)).toEqual(['Guitarra']);
    expect(r.cursor).toBe(2);
  });

  it('exclusão (excluidoEm) também sincroniza', async () => {
    const { app } = montar();
    await sync(app, 0, { eventos: [evento()] });
    const r = await sync(app, 1, { eventos: [evento({ excluidoEm: '2026-10-14T14:00:00.000Z', atualizadoEm: '2026-10-14T14:00:00.000Z' })] });
    expect(r.mudancas.eventos![0]!.excluidoEm).toBe('2026-10-14T14:00:00.000Z');
  });

  it('recusa registros inválidos sem perder os válidos', async () => {
    const { app } = montar();
    const r = await sync(app, 0, { atividades: [atividade(), { ...atividade({ id: 'a2' }), categoria: 'x' }], planilha: [{}] });
    expect(r.mudancas.atividades!.map((a) => a.id)).toEqual(['a1']);
    expect(r.rejeitados).toEqual([
      { tabela: 'atividades', id: 'a2', erro: 'campo "categoria": valor inválido' },
      { tabela: 'planilha', id: null, erro: 'tabela desconhecida' },
    ]);
  });

  it('pedido malformado dá 400', async () => {
    const { app } = montar();
    expect((await app.inject({ method: 'POST', url: '/api/sync', headers: auth, payload: { mudancas: {} } })).statusCode).toBe(400);
  });
});

describe('backup e feed', () => {
  it('backup completo no mesmo formato do app', async () => {
    const { app } = montar();
    await sync(app, 0, { atividades: [atividade()], eventos: [evento()] });
    const r = await app.inject({ url: '/api/backup', headers: auth });
    expect(r.headers['content-disposition']).toBe('attachment; filename="rumo-backup-2026-10-14.json"');
    const v = validarBackup(r.json());
    expect(v.ok && v.backup.tabelas.atividades).toHaveLength(1);
  });

  it('feed .ics só com o token derivado, nunca com o token principal', async () => {
    const { app } = montar();
    await sync(app, 0, { eventos: [evento()] });
    const { caminho } = (await app.inject({ url: '/api/feed', headers: auth })).json() as { caminho: string };
    expect(caminho).toBe(`/feed/${tokenDoFeed(TOKEN)}.ics`);
    expect(caminho).not.toContain(TOKEN);
    const r = await app.inject({ url: caminho });
    expect(r.headers['content-type']).toContain('text/calendar');
    expect(r.body).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
    expect(lerICS(r.body).eventos.map((e) => e.titulo)).toEqual(['Dentista']);
    expect((await app.inject({ url: `/feed/${TOKEN}.ics` })).statusCode).toBe(404);
  });

  it('backup diário: um por dia, guarda os 14 mais recentes', () => {
    const { banco } = montar();
    const pasta = mkdtempSync(join(tmpdir(), 'rumo-'));
    try {
      for (let d = 1; d <= 16; d++) salvarBackupDiario(banco, pasta, new Date(`2026-10-${String(d).padStart(2, '0')}T15:00:00Z`), 'America/Sao_Paulo');
      expect(salvarBackupDiario(banco, pasta, new Date('2026-10-16T18:00:00Z'), 'America/Sao_Paulo')).toBeNull();
      const arquivos = readdirSync(join(pasta, 'backups')).sort();
      expect(arquivos).toHaveLength(14);
      expect(arquivos[0]).toBe('rumo-2026-10-03.json');
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});

describe('inscrições de push', () => {
  it('salva, envia teste e remove', async () => {
    const { app, banco, enviados } = montar();
    expect((await app.inject({ url: '/api/push/chave', headers: auth })).json()).toEqual({ chavePublica: 'chave-publica-de-teste' });
    const ok = await app.inject({ method: 'POST', url: '/api/push/inscricao', headers: auth, payload: { inscricao: inscricao() } });
    expect(ok.statusCode).toBe(200);
    expect(banco.inscricoes()).toHaveLength(1);
    expect((await app.inject({ method: 'POST', url: '/api/push/teste', headers: auth })).json()).toEqual({ enviados: 1 });
    expect(enviados[0]!.mensagem.corpo).toBe('Notificações funcionando.');
    await app.inject({ method: 'DELETE', url: '/api/push/inscricao', headers: auth, payload: { endpoint: inscricao().endpoint } });
    expect(banco.inscricoes()).toEqual([]);
  });

  it('recusa inscrição inválida (endpoint precisa ser https)', async () => {
    const { app } = montar();
    const r = await app.inject({ method: 'POST', url: '/api/push/inscricao', headers: auth, payload: { inscricao: { endpoint: 'http://x', keys: {} } } });
    expect(r.statusCode).toBe(400);
  });
});
