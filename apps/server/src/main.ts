import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { criarApp } from './app';
import { Banco } from './banco';
import { salvarBackupDiario } from './backupDiario';
import { lerConfig } from './config';
import { chavesVapid, enviadorWebPush } from './push';

const config = lerConfig();
mkdirSync(config.dados, { recursive: true });
const banco = new Banco(join(config.dados, 'rumo.db'));
const push = enviadorWebPush(chavesVapid(config.dados), config.contatoPush);
const app = criarApp({ config, banco, push });

/** Tarefas periódicas (a cada minuto): backup do dia. */
function tarefas() {
  try {
    const criado = salvarBackupDiario(banco, config.dados, new Date(), config.fuso);
    if (criado) console.log(`Backup salvo: ${criado}`);
  } catch (e) {
    console.error('Falha nas tarefas periódicas:', e);
  }
}

await app.listen({ port: config.porta, host: config.host });
console.log(`Rumo ouvindo em http://${config.host}:${config.porta} (dados em ${config.dados})`);
tarefas();
const relogio = setInterval(tarefas, 60_000);

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => {
    clearInterval(relogio);
    await app.close();
    banco.fechar();
    process.exit(0);
  });
}
