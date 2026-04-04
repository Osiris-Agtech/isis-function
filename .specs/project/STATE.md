# State

## Decisões

| ID | Decisão | Razão | Data |
|----|---------|-------|------|
| D-01 | **Manter Nexus** para geração do schema | Nexus descontinuado mas funcional. Migrar para Pothos geraria risco desnecessário de break changes no frontend. Manter como está. | 2026-04-04 |
| D-02 | Substituir Apollo Server por graphql-yoga | graphql-yoga é projetado para qualquer runtime (serverless, edge, Firebase Functions); suporte nativo à Fetch API | 2026-04-03 |
| D-03 | Manter schema Prisma intacto | Zero mudança no banco de dados — contrato preservado | 2026-04-03 |
| D-04 | Manter JavaScript (sem migrar para TypeScript) | Fora de escopo definido pelo usuário | 2026-04-03 |
| D-05 | **Firebase Functions Gen 2** como plataforma de deploy | Usuário confirmou mudança de GCP Cloud Functions para Firebase Functions — mesma região (us-central1), CI/CD via Firebase CLI | 2026-04-04 |
| D-06 | **Zero breaking changes no frontend** | Contrato GraphQL 100% preservado — SDL idêntico (Nexus continua gerando o mesmo schema) | 2026-04-04 |
| D-07 | **Manter Prisma 3** (downgrade de 5→3) | nexus-plugin-prisma é incompatível com Prisma 4+. Funciona com Prisma 3.15.2. | 2026-04-04 |
| D-08 | **Downgrade graphql 16→15** | @nexus/schema é incompatível com graphql@16. graphql-yoga funciona com v15. | 2026-04-04 |
| D-09 | **Remover Pothos** (@pothos/core, @pothos/plugin-prisma) | Mantemos Nexus. Pothos foi scaffoldado mas nunca implementado. | 2026-04-04 |
| D-10 | **UserInputError/AuthenticationError custom** | Substituir erros do Apollo Server por classes próprias com mesma interface. | 2026-04-04 |

## Feature Status: IMPLEMENTADA ✅

Todas as 6 tasks concluídas. Handler Firebase Function exportável, dev local funcionando via server.js, cron separado, zero dependências abandonadas.

## Bloqueadores

| ID | Bloqueador | Impacto | Status |
|----|-----------|---------|--------|
| B-01 | ~~Plataforma serverless não definida~~ | — | Resolvido: Firebase Functions Gen 2 |

## Perguntas em Aberto

- **Q-02:** Manter a verificação JWT ausente inicialmente, ou implementar agora?
- **Q-03:** Nexus é descontinuado — quando (ou se) migrar para Pothos no futuro?

## Breaking Changes Prisma 3→5 — NÃO APLICÁVEL

Prisma 3 **não será atualizado** nesta migração. Nexus + nexus-plugin-prisma são incompatíveis com Prisma 4+. Manter Prisma 3 até que uma migração Nexus → Pothos seja feita (feature futura separada).

## Lições

- O projeto **não usa NestJS** — usa Apollo Server + Nexus. A percepção do usuário de "NestJS" pode ter vindo da estrutura modular de arquivos similar.
- O stack atual já é bastante leve (sem framework MVC), então a migração para Firebase Function é menos disruptiva do que parece.
- **Nexus descontinuado** mas funcional — manter até que haja necessidade real de migrar.

## SDL Diff — Zero Breaking Changes

**Nexus continua sendo o gerador do schema.** O SDL resultante do `makeSchema()` deve ser **idêntico** ao atual — a única mudança é o runtime HTTP (Apollo → graphql-yoga).

## Preferências (Model Guidance)

- Tarefas leves como atualizações de state e validação funcionam bem com modelos mais rápidos (Haiku)
