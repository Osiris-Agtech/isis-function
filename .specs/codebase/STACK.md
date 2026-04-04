# Stack

## Runtime
- **Node.js** (node:lts in Docker, sem versão pinada)
- **Linguagem:** JavaScript (sem TypeScript)

## GraphQL Layer
- **graphql-yoga** — handler serverless Fetch API (`Request/Response`), substituto do Apollo Server
- **@nexus/schema** — schema code-first (MANTIDO — descontinuado mas funcional)
- **nexus-plugin-prisma** — plugin Prisma do Nexus (MANTIDO)
- **graphql** — mesma versão

> ⚠️ Nexus está descontinuado mas funcional. Sem migração para Pothos nesta fase.

## ORM / Database
- **Prisma** v3 + **@prisma/client** v3 (MANTIDO — Nexus é incompatível com Prisma 4+)
- **PostgreSQL** (Neon serverless — conexão via SSL)
- Binary targets: `native` + `darwin-arm64` + `linux-musl-openssl-3.0.x` + `debian-openssl-3.0.x`

## Autenticação
- **jsonwebtoken** — geração de JWT no login
- **bcrypt** — hash de senha

> ⚠️ JWT gerado no login mas **não verificado** em nenhuma query/mutation protegida.

## Serviços Auxiliares
- **nodemailer** — envio de e-mail via Gmail SMTP
- **dotenv** — configuração via variáveis de ambiente

> ✅ `node-cron` removido. Cron será externalizado para Firebase Scheduler.

## Tooling
- **Docker** (Dockerfile + docker-compose)
- **Firebase CLI** — deploy de Functions Gen 2
- Sem eslint, sem prettier, sem testes configurados
- Sem TypeScript

## Estado da Migração

| Componente | Status |
|------------|--------|
| Dependências | ⚠️ Parcial — graphql-yoga instalada, Apollo Server ainda presente |
| `schema.js` | ✅ makeSchema do Nexus já existe |
| `src/schemas/` | ✅ 36 arquivos Nexus funcionais |
| `src/index.js` | ❌ Ainda Apollo Server + node-cron |
| `src/cron/` | ❌ Vazio — cron function pendente |
| `firebase.json` | ❌ Não criado — configuração Firebase Functions pendente |
