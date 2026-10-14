import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/** Servidor do Rumo para os testes de sincronização (pasta de dados nova a cada execução). */
export const SERVIDOR_E2E = { url: 'http://127.0.0.1:8799', token: 'token-e2e-com-mais-de-16-caracteres' };

// Roda contra o build de produção (service worker incluso), com tela e toque de iPhone.
// Usa o navegador instalado na máquina: PW_CHANNEL=chrome para Chrome; padrão Edge.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx tsx ../server/src/main.ts',
      url: `${SERVIDOR_E2E.url}/api/saude`,
      reuseExistingServer: false,
      env: {
        RUMO_TOKEN: SERVIDOR_E2E.token,
        RUMO_PORTA: '8799',
        RUMO_HOST: '127.0.0.1',
        RUMO_DADOS: join(tmpdir(), `rumo-e2e-${Date.now()}`),
      },
    },
  ],
});
