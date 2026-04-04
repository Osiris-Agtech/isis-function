# Project: Osiris API — Migração para Firebase Functions + GraphQL Yoga

## Visão

Transformar a API GraphQL do Osiris Agtech — atualmente Apollo Server standalone — em uma **Firebase Function** com **graphql-yoga**, mantendo **Nexus** para geração do schema e zero breaking changes para os clientes frontend.

## Contexto

A API gerencia operações de fazendas/empresas agrícolas (Osiris Agtech):
- Multi-tenant por `contaId`
- 28 modelos Prisma cobrindo: áreas, lotes, culturas, protocolos, agendas, nutrição, usuários, permissões
- 40+ queries e 50+ mutations
- Alertas de agenda via e-mail (cron diário)

## Decisão Estratégica

**Nexus foi descontinuado, mas será mantido.** A prioridade é **não gerar break changes no frontend**. O objetivo principal é transformar a API em uma **Firebase Function** usando **graphql-yoga** no lugar do Apollo Server, mantendo Nexus como gerador do schema GraphQL.

## Objetivos da Refatoração

1. **Remover Apollo Server** — substituir por graphql-yoga (Fetch API `Request/Response`)
2. **Firebase Functions** — handler exportável como Firebase Function Gen 2
3. **Preservar o contrato GraphQL** — mesmas entidades, mesmas queries/mutations, zero breaking changes
4. **Manter Nexus** — Nexus continua gerando o schema (makeSchema), sem migração para Pothos
5. **Separar o cron** — o alerta de agenda como function independente (Firebase Scheduler)
6. **Externalizar configurações** — remover credenciais hardcoded; usar variáveis de ambiente

## Fora de Escopo

- Migração do Nexus para Pothos (manter Nexus como está)
- Migração do banco de dados (schema Prisma permanece igual)
- Mudança na lógica de negócio (cálculos de relatórios, etc.)
- Implementação de autenticação completa (JWT verification era ausente antes, pode ser mantida assim inicialmente)
- Adição de novos recursos ou endpoints
- Migração para TypeScript

## Stack

| Camada | Atual | Alvo |
|--------|-------|------|
| GraphQL Server | Apollo Server 3 | graphql-yoga |
| Schema | Nexus + nexus-plugin-prisma | Nexus + nexus-plugin-prisma (mantido) |
| ORM | Prisma 3 | Prisma 3 (mantido) |
| Runtime | Servidor HTTP porta 4000 | Firebase Functions Gen 2 |
| Config | Hardcoded | dotenv / variáveis de ambiente |
| Cron | node-cron acoplado | Firebase Scheduler (function separada) |

## Plataforma Alvo de Deploy

**Firebase Functions Gen 2** (Node.js 20, us-central1) + **Neon Postgres** (serverless PostgreSQL).

- CI/CD: Firebase CLI (`firebase deploy`)
- Cron: Firebase Scheduler chamando function de alerta-agenda às 10:00 UTC (07:00 BRT)
- Secrets: Firebase App Configuration + GCP Secret Manager (`DATABASE_URL`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_PASSWORD`)

## Sucesso

- Schema GraphQL idêntico ao atual (gerado pelo mesmo Nexus — SDL diff zero)
- Todos os resolvers funcionando via handler graphql-yoga
- Handler exportável como Firebase Function (sem `node:http` no entry point)
- Zero credenciais no código
- Cron isolado em function dedicada
