# Architecture

## Visão Geral

API GraphQL code-first com Apollo Server standalone + Nexus. **Não usa NestJS** — o stack é Apollo Server + Nexus + Prisma. A lógica de negócio está acoplada diretamente nos resolvers (sem camada de serviço).

**Objetivo:** Trocar Apollo Server por graphql-yoga, deploy como Firebase Functions Gen 2, **mantendo Nexus** para geração do schema.

```
── ATUAL ──
Client → Apollo Server (porta 4000)
              ↓
         schema.js (makeSchema do Nexus)
              ↓
         schemas/ (36 arquivos Nexus)
         ├── query.js        (786 linhas — todas as queries)
         ├── mutation.js     (800+ linhas — todas as mutations)
         └── <entity>.js     (type definitions por entidade)
              ↓
         ctx.prisma (PrismaClient)
              ↓
         PostgreSQL

── ALVO ──
Client → Firebase Function (HTTP trigger)
              ↓
         graphql-yoga handler (Fetch API Request/Response)
              ↓
         schema.js (makeSchema do Nexus — MESMO)
              ↓
         schemas/ (36 arquivos Nexus — MESMOS)
              ↓
         ctx.prisma (PrismaClient — MESMO)
              ↓
         PostgreSQL (Neon serverless)
```

## Bootstrap Atual (src/index.js)

1. Inicializa `PrismaClient` com query logging
2. Registra cron job (07:00 diário para alertas)
3. Cria `ApolloServer` com schema, context `{ prisma }`, CORS, logging plugin
4. Escuta na porta 4000

## Bootstrap Alvo (Firebase Function)

1. Carregar schema do Nexus (`makeSchema`) — **mesmo processo**
2. Criar handler graphql-yoga com o schema gerado
3. Exportar como Firebase Function (`onRequest`)
4. Cron separado em function independente (Firebase Scheduler)

## Schema Generation (INALTERADO)

- Usa `makeSchema()` do `@nexus/schema` — **sem mudança**
- Carrega todos os tipos/resolvers de `src/schemas/`
- Gera arquivos em runtime (SDL em `src/schema.graphql`, tipos em `prisma/generated/nexus.ts`)

## Padrão de Resolver (INALTERADO)

Resolvers continuam definidos inline com `t.field()` e `t.crud()`:

```js
// src/schemas/query.js ou mutation.js — SEM MUDANÇA
t.field('login', {
  type: 'LoginResponse',
  args: { email: stringArg(), senha: nonNull(stringArg()) },
  resolve: async (_, { email, senha }, ctx) => {
    const usuario = await ctx.prisma.usuario.findFirst({ where: { email } })
    // lógica inline no resolver — SEM MUDANÇA
  }
})
```

## Camadas

| Camada | Situação Atual | Situação Alvo |
|--------|---------------|---------------|
| **HTTP** | Apollo Server standalone | Firebase Functions Gen 2 (`onRequest`) |
| **GraphQL** | Apollo Server | graphql-yoga (Fetch API) |
| **Schema** | Nexus makeSchema | Nexus makeSchema (igual) |
| **Business Logic** | Embutida nos resolvers | Embutida nos resolvers (igual) |
| **Data Access** | Prisma direto nos resolvers via `ctx.prisma` | Igual |
| **Auth** | JWT gerado no login, sem verificação | Igual |
| **Email/Cron** | `alerta_agenda.js` acoplado ao servidor | Function separada (Firebase Scheduler) |

## Multi-tenancy

Todas as entidades raiz têm `contaId` — os dados são isolados por conta (empresa/fazenda). As queries customizadas recebem `contaId` como argumento obrigatório. **Sem mudança.**

## Soft Delete

A maioria das entidades tem campo `deleted_at`. Implementado manualmente nos resolvers customizados — o CRUD automático do Nexus **não filtra** registros deletados. **Sem mudança.**
