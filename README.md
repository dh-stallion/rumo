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
npm test             # testes de regras e do backup (Vitest)
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
  faça backups: veja abaixo.
- Atualizações: o app se atualiza sozinho na próxima vez que for aberto com internet.

## Calendário (semana e mês)

A aba **Calendário** alterna entre **Semana** (a grade do planejador, abaixo) e **Mês**: semanas
completas com uma marca por compromisso em cada dia (eventos em cinza, sessões na cor da atividade).
Tocar num dia lista o que há nele; **Ver na semana** abre a semana daquele dia.

**Eventos recorrentes**: no formulário, **Repetir** oferece todo dia, dias úteis, toda semana (escolhendo
os dias), a cada 2 semanas, todo mês (no dia N ou na Nª segunda/terça…), todo ano. **Termina** nunca,
numa data ou após N vezes. Ao editar ou remover uma ocorrência, o app pergunta:

- **Só este evento**: vira uma exceção da série (RECURRENCE-ID) ou é pulado (EXDATE);
- **Este e os seguintes**: a série antiga termina antes dessa data e nasce uma nova (o COUNT é dividido);
- **Todos os eventos**: muda a série inteira (exceções acompanham se a regra não mudou).

Se a própria repetição mudar, "só este" não aparece. Tudo pode ser desfeito.

As regras ficam guardadas como RRULE (RFC 5545) e são expandidas por um código próprio
(`packages/core/src/calendario/recorrencia.ts`), no fuso de São Paulo. Ele suporta FREQ
DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY (com ordinal no mensal), BYMONTHDAY e WKST.
Regras de fora com outras partes (ex.: BYSETPOS) aparecem só na primeira data, com aviso na leitura.

### Levar para o Calendário do iPhone

Em **Ajustes → Calendário do iPhone → Exportar calendário (.ics)**: escolha **Salvar em Arquivos**,
abra o arquivo no app **Arquivos** e toque em **Adicionar todos**. É uma cópia: o que mudar depois no
Rumo não aparece lá. Sessões planejadas podem ir junto (categoria "Atividade").

A **assinatura** que se atualiza sozinha (feed `webcal://…/feed/<token>.ics`) depende do servidor da
etapa 5. O gerador já está pronto em `core` (`gerarICS(…, { feed: true })`).

### Pronto para CalDAV

`packages/core/src/calendario/caldav.ts` define a interface `ProvedorCalendario` (listar, baixar, salvar
com If-Match, remover) e `recursosCalDAV`, que gera um recurso `.ics` por UID (a série com suas exceções,
como o CalDAV exige). `lerICS`/`eventosDoICS` convertem de volta, inclusive de outros calendários
(UTC, DURATION, dia inteiro, alarmes). Falta o provedor HTTP (Radicale/Nextcloud) e a sincronização,
que entram com o backend.

## Planejador semanal (Calendário → Semana)

- **Grade**: no celular mostra 3 dias por vez; deslize para os lados (encaixa por dia). Em telas largas,
  os 7 dias. Abre em hoje, às 7h. ‹ › trocam de semana, respeitando o início de semana dos Ajustes.
- **Banco de afazeres** (barra inferior): atividades por categoria com "X de Y agendados" (planejadas
  + feitas na semana).
  - **Segure** um item (toque longo, ~¼ s) e arraste para um dia/hora: cria uma sessão planejada com a
    duração padrão. Pode repetir quantas vezes quiser.
  - **Toque** num item para escolher dia, horário e duração sem arrastar.
- **Blocos**: segure para mover (encostar o dedo na borda rola a grade até outros dias); arraste a
  alça de baixo para mudar a duração; toque para abrir a folha (feito, mudar dia/hora/duração, remover).
  Deslizar rápido sobre um bloco só rola a grade.
- **Eventos fixos** aparecem com cadeado e não se movem. Sessão que se sobrepõe a um fixo fica com
  contorno vermelho e aviso (encostar não conta). Eventos são criados pelo botão **+ Evento**.
- **Feito**: uma sessão planejada que já começou vira registrada no mesmo horário; uma futura passa a
  terminar agora. "Feito" em Hoje e "Fiz hoje" em Atividades convertem a planejada do dia, se houver.
- Tudo tem **Desfazer** no aviso que aparece no topo.

**Planejar a semana**: o botão **Ver semana toda** alterna para 7 colunas em tela cheia, com o banco
de afazeres, arraste por toque longo e o fluxo sem arrastar. No começo de cada semana (conforme o
início de semana dos Ajustes, virando à meia-noite de São Paulo), **Hoje** mostra um card discreto
"Semana nova: planejar?". Aceitar ou dispensar esconde o card até a semana seguinte. Dá para desligar
em **Ajustes → Calendário**.

As sessões planejadas de hoje aparecem no topo de **Hoje**, e as dos próximos 7 dias em
**Próximos compromissos**.

## Backup dos dados

Em **Ajustes → Backup**:

- **Exportar dados (JSON)**: no iPhone abre a folha de compartilhamento; escolha **Salvar em Arquivos**
  (ex.: iCloud Drive). No computador, o arquivo `rumo-backup-AAAA-MM-DD.json` é baixado.
- **Importar dados (JSON)**: valida o arquivo antes de tudo e explica o que está errado, se for o caso.
  Se for válido, mostra o que há no arquivo e no aparelho e pede confirmação antes de **substituir**
  todos os dados. A troca é feita numa única transação: ou entra tudo, ou nada muda.

O arquivo inclui todas as tabelas, inclusive registros excluídos (necessários para a sincronização futura).
O formato tem versão (`"versao": 1`), e a validação fica em `packages/core/src/backup.ts`.

Em **Ajustes → Armazenamento**, o app pede ao navegador armazenamento persistente
(`navigator.storage.persist()`) e mostra o resultado.

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
- **Recorrência**: strings RRULE (RFC 5545) com expansor próprio; exceções por EXDATE e RECURRENCE-ID.
- **Dinheiro** (etapa 4): centavos inteiros.

## Etapas

- [x] 1. Núcleo: atividades, pessoas, "fiz hoje" / "falei com", tela Hoje
- [x] 2. Planejador semanal com arrastar e soltar
- [x] 3. Calendário semana/mês, recorrência, exportação .ics (feed assinável e CalDAV dependem da etapa 5)
- [ ] 4. Projetos e metas financeiras
- [ ] 5. Backend, sincronização, Web Push, Docker, backup
