# Design: Migração para Firebase Functions + GraphQL Yoga

**Spec**: `.specs/features/refactor-to-function/spec.md`
**Status**: Approved

---

## Arquitetura Alvo

A abordagem é **simples**: trocar o runtime HTTP (Apollo Server → graphql-yoga), mantendo Nexus intacto para geração do schema.

```
┌───────────────────────────────────────────────────┐
│  Firebase Function (src/index.js)                 │
│  onRequest(yoga)                                  │
└──────────────────────┬────────────────────────────┘
                       ↓
┌───────────────────────────────────────────────────┐
│  graphql-yoga handler                             │
│  createYoga({ schema, context })                  │
└──────────────────────┬────────────────────────────┘
                       ↓
┌───────────────────────────────────────────────────┐
│  Schema (src/schema.js) — SEM MUDANÇA             │
│  makeSchema({ types: [...schemas] }) — Nexus      │
└──────────────────────┬────────────────────────────┘
                       ↓
┌───────────────────────────────────────────────────┐
│  src/schemas/ (36 arquivos Nexus) — SEM MUDANÇA   │
│  ├── query.js (queries)                           │
│  ├── mutation.js (mutations)                      │
│  └── <entity>.js (type definitions)               │
└──────────────────────┬────────────────────────────┘
                       ↓
                ┌───────────────┐
                │ PrismaClient  │
                └───────┬───────┘
                        ↓
                ┌───────────────┐
                │  Neon PG      │
                └───────────────┘

── Cron (separado) ──
Firebase Scheduler trigger
    ↓
src/cron/alertaAgenda.js → handleAlertaAgenda()
    ↓
prisma.agenda.findMany(...)
    ↓
nodemailer (Gmail SMTP via env vars)
```

---

## Análise de Reuso de Código

### Componentes Mantidos (SEM MUDANÇA)

| Componente | Localização | Situação |
|------------|-------------|----------|
| `schema.js` | `src/schema.js` | **Mantido** — makeSchema do Nexus, sem alteração |
| `src/schemas/` (36 arquivos) | `src/schemas/` | **Mantidos** — todos os tipos, queries e mutations Nexus |
| `src/plugins/loggingPlugin.js` | `src/plugins/` | **Remover** — é plugin do Apollo, não compatível com yoga |
| `src/utils/logger.js` | `src/utils/` | **Mantido** — lógica de logging independe do framework |
| `prisma/schema.prisma` | `prisma/` | **Mantido** — zero mudanças |

### Componentes Substituídos

| Componente | De | Para |
|------------|----|----|
| Entry point HTTP | `src/index.js` (Apollo Server) | `src/index.js` (Firebase + graphql-yoga) |
| Cron | `node-cron` no entry point | `src/cron/alertaAgenda.js` (function isolada) |

### Pontos de Integração

| Sistema | Método de Integração |
|---------|---------------------|
| PostgreSQL (Neon) | PrismaClient — reusar a instância atual |
| Firebase Functions Gen 2 | `onRequest(yoga)` no `src/index.js` |
| Firebase Scheduler | Function `handleAlertaAgenda()` exportada de `src/cron/alertaAgenda.js` |
| GraphQL Clients | Contrato idêntico — zero mudança no SDL |

---

## Componentes

### `src/index.js` — Firebase Function Handler

- **Propósito**: Entry point principal — Firebase Function com graphql-yoga
- **Localização**: `src/index.js` (substitui conteúdo atual)
- **Dependências**: `firebase-functions/v2/https`, `graphql-yoga`, `./schema.js`
- **Reusa**: `src/schema.js` (makeSchema do Nexus — sem mudança)

```js
import { onRequest } from 'firebase-functions/v2/https'
import { createYoga } from 'graphql-yoga'
import { schema } from './schema.js'

const yoga = createYoga({
  schema,
  context: () => ({ prisma }),
})

export const graphqlHandler = onRequest(yoga)
```

### `src/cron/alertaAgenda.js` — Cron Function

- **Propósito**: Exportar `handleAlertaAgenda()` — lógica de verificação e envio de emails
- **Localização**: `src/cron/alertaAgenda.js` (novo)
- **Dependências**: `nodemailer`, PrismaClient, variáveis de ambiente
- **Reusa**: Lógica de `src/alerta_agenda.js` (`verificarEEnviarEmail()`)

### `src/server.js` — Servidor Dev Local

- **Propósito**: Wrapping do handler em `http.createServer` para desenvolvimento local
- **Localização**: `src/server.js` (novo/ajustar)
- **Dependências**: `node:http`, `./index.js` (handler yoga)

---

## Estratégia de Error Handling

| Cenário | Handling | Impacto |
|---------|----------|---------|
| `DATABASE_URL` não definida | Prisma falha na inicialização com erro claro | Dev sabe imediatamente o que fazer |
| `JWT_SECRET` não definida | Login lança erro | Impede auth silenciosa sem secret |
| Query GraphQL inválida | graphql-yoga retorna `errors` array (GraphQL spec) | Cliente recebe erro padrão |
| Soft delete em entidade sem `deleted_at` | Prisma error → propagada como GraphQL error | Fail fast |

---

## Decisões Técnicas

| Decisão | Escolha | Racional |
|---------|---------|----------|
| Manter Nexus | Sim | Descontinuado mas funcional. Zero break changes no frontend. |
| Manter Prisma 3 | Sim | Nexus é incompatível com Prisma 4+ |
| graphql-yoga no lugar de Apollo | Sim | Fetch API nativa, funciona em qualquer runtime |
| Firebase Functions `onRequest` v2 | Sim | Gen 2 usa `firebase-functions/v2/https` |
| PrismaClient singleton | Sim | Reusar instância existente, evitar múltiplas conexões |

---

## Diagrama de Fluxo

```
Request HTTP (Firebase Function)
    ↓
src/index.js → onRequest(yoga)
    ↓
createYoga({ schema, context })
    ↓
src/schema.js → makeSchema() — Nexus
    ↓
src/schemas/ (36 arquivos)
    ├── query.js (Queries)
    ├── mutation.js (Mutations)
    └── <entity>.js (Types)
    ↓
ctx.prisma (PrismaClient)
    ↓
PostgreSQL (Neon)

── Cron (separado) ──
Firebase Scheduler trigger
    ↓
src/cron/alertaAgenda.js → handleAlertaAgenda()
    ↓
prisma.agenda.findMany(...)
    ↓
nodemailer (Gmail SMTP via env vars)
```
