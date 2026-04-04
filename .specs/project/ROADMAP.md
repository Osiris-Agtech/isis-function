# Roadmap

## Feature 1: Migração para Firebase Functions + GraphQL Yoga
**Status:** ✅ Implementada
**Spec:** [features/refactor-to-function/spec.md](../features/refactor-to-function/spec.md)

Substituir Apollo Server por graphql-yoga como handler de Firebase Functions, mantendo Nexus para geração do schema e zero breaking changes.

### Fases Concluídas

| Fase | Descrição | Status |
|------|-----------|--------|
| **F1** | Config e ambiente (dotenv, `.env.example`, secrets externalizados) | ✅ |
| **F2** | Adaptar Nexus makeSchema para funcionar com graphql-yoga | ✅ |
| **F3** | Substituir Apollo Server por graphql-yoga (handler Fetch API) | ✅ |
| **F4** | Adaptar entry point como Firebase Function exportável (`onRequest`) | ✅ |
| **F5** | Separar cron em function dedicada (Firebase Scheduler) | ✅ |
| **F6** | Limpeza final (remover Apollo Server, node-cron, dependências antigas) | ✅ |

---

## Feature 2: CI/CD — Deploy Firebase + Neon (Migrations + Seeds)
**Status:** ✅ Implementada
**Spec:** [features/ci-cd-deploy/spec.md](../features/ci-cd-deploy/spec.md)

Pipeline de CI/CD para deploy automático das Firebase Functions com aplicação de migrations e seeds no Neon Postgres.

### Fases Concluídas

| Fase | Descrição | Status |
|------|-----------|--------|
| **F1** | Criar `firebase.json` + `.firebaserc` | ✅ |
| **F2** | Criar script de seed opcional (`prisma/seed.js`) | ✅ |
| **F3** | Adaptar `cloudbuild.yaml` para Firebase + Migrations | ✅ |
| **F4** | Criar GitHub Actions como alternativa (`.github/workflows/deploy.yml`) | ✅ |
| **F5** | Documentar setup de secrets e deploy manual | ✅ |

---

## Features Futuras (fora de escopo atual)

- **Migrar Nexus → Pothos** — substituir Nexus abandonado por Pothos (feature separada, alto risco)
- **Auth completo** — verificação JWT em todas as queries/mutations protegidas
- **Soft delete automático** — middleware Prisma para filtrar `deleted_at: null` globalmente
- **Testes** — suite de integração e unitários
- **TypeScript** — migração gradual do código-fonte
- **Logs estruturados** — usar pino ou winston com log levels por ambiente
