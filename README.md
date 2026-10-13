# Rumo

Calendário-assistente pessoal em PWA, em português, feito para o iPhone (Safari, instalado na tela inicial).
Local-first: os dados ficam no aparelho (IndexedDB) e o app funciona 100% offline.

## Estrutura

```
packages/core/   domínio puro em TypeScript (tipos, regras, fuso) + testes — reaproveitado pelo servidor
apps/web/        PWA: React + Vite + Tailwind + Dexie
apps/server/     (etapa 5) Fastify + SQLite + Web Push
```

## Rodar localmente

Requer Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173 (também exposto na rede local)
npm test             # testes das regras (Vitest)
npm run e2e          # build + testes de ponta a ponta (Playwright, tela de iPhone)
npm run typecheck
npm run build        # gera apps/web/dist
npm run preview      # serve o build em http://localhost:4173
```

Os testes de ponta a ponta usam o Edge instalado na máquina, com o relógio fixado numa terça-feira.
Para usar o Chrome: `PW_CHANNEL=chrome npm run e2e`.

Os ícones do PWA são gerados a partir de `apps/web/public/logo.svg`:

```bash
npm run icons -w @rumo/web
```

## Instalar na tela inicial do iPhone

O iOS só ativa o service worker (modo offline) com **HTTPS**. O servidor de desenvolvimento acessado
pelo IP da rede (`http://192.168.x.x:5173`) serve para ver a interface no celular, mas não para instalar o app de verdade.

1. Publique o conteúdo de `apps/web/dist` num endereço HTTPS. Opções simples:
   - **Cloudflare Pages / Netlify / GitHub Pages**: envie a pasta `dist`. Configure o fallback de SPA para `index.html`.
   - **Tailscale** (bom para o NAS depois): `npm run preview` + `tailscale serve 4173` dá um endereço
     `https://<máquina>.<tailnet>.ts.net` com certificado válido, acessível só pelos seus aparelhos.
2. No iPhone, abra o endereço no **Safari**.
3. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
4. Abra o Rumo pelo ícone. Ele roda em tela cheia e funciona sem internet.

Observações:
- Os dados do app instalado ficam separados dos dados do Safari. Use sempre o ícone.
- Apps instalados na tela inicial não têm os dados apagados automaticamente pelo iOS. Mesmo assim,
  o backup em JSON e a sincronização com o servidor chegam na etapa 5.
- Atualizações: o app se atualiza sozinho na próxima vez que for aberto com internet.

## Regras da tela "Hoje"

Ficam em `packages/core/src/rules`, cobertas por testes. Todas as contas usam dias de calendário no fuso
`America/Sao_Paulo`. A semana começa na segunda por padrão e pode ser trocada em **Ajustes**.
Só contam sessões **registradas** ("fiz hoje"): sessões planejadas não contam como feitas.

Uma atividade só deixa de aparecer em "Hoje" se estiver **pausada**, **adiada** ou **já feita hoje**.

| Regra | Quando aparece |
|---|---|
| Ainda não praticou | A atividade nunca teve sessão registrada. Aparece logo depois do cadastro. |
| Atividade parada | Passaram **mais de N** dias desde a última sessão. N é o limite da atividade ou, se estiver em branco, o padrão pela meta: `⌈7 / meta⌉ + 2` (meta 1 → 9, meta 3 → 5, meta 7 → 3). Sem meta, 14. |
| Meta 1x por semana | Nada feito na semana e já é **sexta ou depois**. |
| Outras metas | O ritmo ficou para trás (`feitas < ⌊meta × dias encerrados / 7⌋`) **ou** não sobra folga (o que falta exige fazer em todos os dias restantes, incluindo hoje). Ex.: meta 3 sem nada feito aparece na quinta. |
| Contato | Passaram **N dias ou mais** desde o último contato, sendo N a frequência desejada. |
| Já feito hoje | A atividade sai de "Hoje" até o dia seguinte, mesmo que a meta da semana esteja apertada. |

Cada card tem **feito**, **adiar** (amanhã, em 3 dias, semana que vem) e **pausar**, e todas as ações podem ser desfeitas.

## Decisões de arquitetura

- **Datas**: instantes em ISO UTC (`…Z`). Datas de calendário (prazos, marcos) em `YYYY-MM-DD`.
  As contas de dia e semana usam `@date-fns/tz`.
- **Pronto para sincronizar**: todo registro tem `id` (UUID), `criadoEm`, `atualizadoEm` e `excluidoEm`
  (exclusão lógica), base para o last-write-wins da etapa 5.
- **Recorrência**: strings RRULE (RFC 5545), exportáveis em `.ics` e compatíveis com CalDAV.
- **Dinheiro** (etapa 4): centavos inteiros.

## Etapas

- [x] 1. Núcleo: atividades, pessoas, "fiz hoje" / "falei com", tela Hoje
- [ ] 2. Planejador semanal com arrastar e soltar
- [ ] 3. Calendário semana/mês, recorrência, exportação .ics
- [ ] 4. Projetos e metas financeiras
- [ ] 5. Backend, sincronização, Web Push, Docker, backup
