# Migração para Firebase Functions + GraphQL Yoga — Especificação

## Problema

A API GraphQL do Osiris Agtech atualmente usa Apollo Server standalone com `listen()` na porta 4000 e node-cron acoplado. O objetivo é transformá-la em uma **Firebase Function** usando **graphql-yoga** como handler HTTP, **mantendo Nexus** para geração do schema.

**Nexus foi descontinuado, mas será mantido.** A prioridade é não gerar break changes no frontend — o schema GraphQL gerado pelo Nexus permanece idêntico.

## Metas

- [ ] Handler graphql-yoga exportável como Firebase Function (`onRequest`) — mensurável: handler responde a `Request/Response` sem `node:http`
- [ ] Zero breaking changes no contrato GraphQL — mensurável: SDL gerado pelo Nexus é idêntico ao atual
- [ ] Código limpo sem Apollo Server — mensurável: `npm ls apollo-server` retorna vazio
- [ ] Cron separado em function dedicada — mensurável: entry point sem imports de `node-cron`
- [ ] Configurações externalizadas — mensurável: zero credenciais hardcoded no código

## Fora de Escopo

| Feature | Razão |
|---------|-------|
| Migrar Nexus → Pothos | Fora de escopo — manter Nexus para evitar break changes |
| Atualizar Prisma 3 → 5 | Nexus é incompatível com Prisma 4+ — manter Prisma 3 |
| Migrar para TypeScript | Fora de escopo definido pelo usuário |
| Implementar verificação JWT | Feature separada; ausência confirmada |
| Adicionar novos endpoints ou lógica | Apenas refatoração, sem mudança funcional |
| Testes automatizados | Fora de escopo desta feature |
| Configuração de deploy Firebase | Handler apenas; infra em feature separada |

---

## User Stories

### P1: Handler graphql-yoga funcional ⭐ MVP

**User Story**: Como desenvolvedor, quero que a API GraphQL seja um handler graphql-yoga (Fetch API `Request/Response`) exportável como Firebase Function, para que possa ser deployada no Firebase Functions Gen 2.

**Why P1**: Este é o core da migração — sem isso, a API não é serverless nem compatível com Firebase.

**Critérios de Aceitação**:

1. WHEN um cliente envia um POST com uma query GraphQL ao handler THEN o handler SHALL retornar uma response JSON com o resultado da query
2. WHEN o handler é importado como módulo THEN ele SHALL ser exportável sem iniciar um servidor HTTP
3. WHEN uma query é enviada ao handler THEN o schema respondido SHALL ser idêntico ao schema atual (gerado pelo mesmo Nexus)
4. WHEN o handler é executado em Node.js puro THEN ele SHALL funcionar sem `node:http` (apenas como função)

**Teste Independente**: Pode ser demonstrado criando um `new Request('http://localhost/graphql', { method: 'POST', body: JSON.stringify({ query: '{ __typename }' }) })` e recebendo resposta válida.

---

### P2: Schema GraphQL preservado ⭐

**User Story**: Como consumidor da API, quero que o schema GraphQL resultante seja idêntico ao atual, para que meus clientes GraphQL não quebrem.

**Why P2**: Sem contrato preservado, a migração é um breaking change para todos os consumidores.

**Critérios de Aceitação**:

1. WHEN o SDL gerado pelo Nexus é comparado com o SDL atual THEN eles SHALL ser idênticos
2. WHEN os tipos de modelo do schema atual são verificados THEN todos SHALL estar presentes
3. WHEN as queries customizadas são invocadas THEN elas SHALL retornar dados no mesmo formato
4. WHEN as mutations são invocadas THEN elas SHALL ter o mesmo comportamento

**Teste Independente**: Gerar SDL antes e depois da migração e rodar `diff`.

---

### P3: Lógica de negócio preservada ⭐

**User Story**: Como usuário do sistema, quero que as regras de negócio (login com bcrypt+JWT, soft delete, cálculos de dashboard e relatórios) funcionem exatamente como antes, para que minha operação não seja afetada.

**Why P3**: Sem isso, a API funciona mas retorna dados errados ou não autentica.

**Critérios de Aceitação**:

1. WHEN `login(email, senha)` é chamado com credenciais válidas THEN SHALL retornar um JWT assinado com `process.env.JWT_SECRET`
2. WHEN qualquer mutation `softDelete*` é chamada THEN o campo `deleted_at` SHALL ser atualizado para o timestamp atual
3. WHEN `homeDashboard(contaId)` é chamado THEN SHALL retornar `{ resumo, tarefas, producao, cultura }` com os mesmos cálculos

**Teste Independente**: Chamar cada resolver com inputs conhecidos e comparar outputs com o comportamento atual.

---

### P3: Configurações externalizadas

**User Story**: Como devops, quero que todas as configurações venham de variáveis de ambiente, para que o deploy em diferentes ambientes seja seguro e configurável.

**Critérios de Aceitação**:

1. WHEN o código é verificado THEN nenhuma credencial SHALL estar hardcoded
2. WHEN `DATABASE_URL` não está definida THEN o Prisma SHALL falhar com mensagem clara
3. WHEN `.env.example` é consultado THEN SHALL conter: `DATABASE_URL`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_PASSWORD`, `NODE_ENV`

---

### P3: Cron separado em function dedicada

**User Story**: Como operador de infra, quero o job de alertas de agenda como uma function independente, para que possa ser agendada pelo Firebase Scheduler.

**Critérios de Aceitação**:

1. WHEN o entry point é analisado THEN NÃO SHALL ter imports de `node-cron`
2. WHEN `src/cron/alertaAgenda.js` é chamado THEN SHALL executar a lógica de verificação e envio de emails
3. WHEN a function de cron é importada THEN SHALL ser exportável como função assíncrona invocável diretamente

---

## Edge Cases

- WHEN `DATABASE_URL` não está definida THEN o Prisma SHALL falhar com erro claro na inicialização
- WHEN `JWT_SECRET` não está definida THEN login SHALL falhar (não silently ignorar)
- WHEN uma query GraphQL contém erros de sintaxe THEN graphql-yoga SHALL retornar errors array no formato GraphQL spec
- WHEN `homeDashboard` é chamado com `contaId` inexistente THEN SHALL retornar estrutura com valores zerados
- WHEN o cron de alertas é executado sem e-mails pendentes THEN SHALL logar "nenhum alerta pendente" sem enviar e-mail

---

## Rastreabilidade de Requisitos

| ID | Story | Fase | Status |
|----|-------|------|--------|
| RF-01 | P2: Schema preservado | Design | Pending |
| RF-02 | P1: Handler graphql-yoga | Design | Pending |
| RF-03 | P1: Handler funcional | Design | Pending |
| RF-04 | P3: Lógica preservada | Design | Pending |
| RF-05 | P3: Config externalizada | Design | Pending |
| RF-06 | P3: Cron separado | Design | Pending |

---

## Critérios de Sucesso

- [ ] Handler graphql-yoga responde a queries GraphQL com schema idêntico ao atual
- [ ] Zero breaking changes no contrato GraphQL (SDL diff vazio)
- [ ] `npm ls apollo-server node-cron` retorna vazio
- [ ] Entry point não contém `ApolloServer` nem `node-cron`
- [ ] Login retorna JWT válido para credenciais corretas
- [ ] Soft deletes atualizam `deleted_at` no banco
- [ ] `.env.example` criado com todas as variáveis necessárias
- [ ] Handler exportável como Firebase Function (`onRequest`)
