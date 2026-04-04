# Tasks: Migração para Firebase Functions + GraphQL Yoga

**Design**: `.specs/features/refactor-to-function/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Fundações (Sequencial)

Externalização de configs, remoção de node-cron do entry point.

```
T-01 → T-02
```

### Phase 2: Handler graphql-yoga + Firebase (Sequencial)

```
T-02 complete, then:
    T-03 (criar server.js dev) → T-04 (reescrever index.js)
```

### Phase 3: Cron + Limpeza (Sequencial)

```
T-04 complete, then:
    T-05 (cron function) → T-06 (remover Apollo + loggingPlugin)
```

---

## Task Breakdown

### T-01: Externalizar configurações hardcoded

**What**: Substituir credenciais hardcoded por `process.env.*` e criar `.env.example`
**Where**: `src/alerta_agenda.js`, `prisma/schema.prisma`, `.env.example` (novo)
**Depends on**: None
**Requirement**: RF-05

**Done when**:
- [ ] `.env.example` criado com: `DATABASE_URL`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_PASSWORD`, `NODE_ENV`
- [ ] `src/alerta_agenda.js` usa `process.env.GMAIL_USER` e `process.env.GMAIL_PASSWORD`
- [ ] `prisma/schema.prisma` datasource usa `env("DATABASE_URL")`
- [ ] Grep por credenciais no código retorna vazio

**Verify**:
```bash
grep -rn "200\.129\|smtp\|password\|secret" src/ --include="*.js" | grep -v "process\.env" | grep -v ".example"
# Deve retornar vazio
```

---

### T-02: Remover node-cron do entry point

**What**: Remover imports de `node-cron` e `alerta_agenda` do `src/index.js` atual
**Where**: `src/index.js` (modificar)
**Depends on**: T-01
**Requirement**: RF-06

**Done when**:
- [ ] `require('node-cron')` removido de `src/index.js`
- [ ] `require('./alerta_agenda')` removido de `src/index.js`
- [ ] `cron.schedule(...)` removido de `src/index.js`
- [ ] `npm uninstall node-cron` executado

**Verify**:
```bash
grep -n "node-cron\|alerta_agenda\|cron\.schedule" src/index.js
# Deve retornar vazio
```

---

### T-03: Criar server.js para desenvolvimento local

**What**: Criar wrapper HTTP server para o handler graphql-yoga (dev local)
**Where**: `src/server.js` (novo)
**Depends on**: T-02
**Reuses**: `src/schema.js` (makeSchema do Nexus)
**Requirement**: RF-02

```js
import http from 'node:http'
import { createYoga } from 'graphql-yoga'
import { schema } from './schema.js'

const yoga = createYoga({
  schema,
  context: () => ({ prisma }),
})

const server = http.createServer(yoga)
const PORT = process.env.PORT || 4000

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/graphql`)
})
```

**Done when**:
- [ ] `src/server.js` cria HTTP server com graphql-yoga na porta 4000
- [ ] `npm start` roda servidor local via `server.js`
- [ ] Queries GraphQL funcionam via browser/curl

**Verify**:
```bash
node src/server.js &
sleep 2
curl -s http://localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{__typename}"}'
# Deve retornar: {"data":{"__typename":"Query"}}
```

---

### T-04: Reescrever src/index.js como Firebase Function

**What**: Substituir Apollo Server por graphql-yoga + Firebase Function `onRequest`
**Where**: `src/index.js` (reescrever)
**Depends on**: T-03
**Reuses**: `src/schema.js` (makeSchema do Nexus — sem mudança)
**Requirement**: RF-02, RF-03

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

**Done when**:
- [ ] `src/index.js` exporta Firebase Function (sem `listen()`)
- [ ] Zero referência a `ApolloServer`, `node-cron`, `express`
- [ ] Import de `firebase-functions/v2/https` presente
- [ ] `firebase.json` configurado com source `src/index.js`
- [ ] `npm install firebase-functions firebase-admin` (se não presentes)

**Verify**:
```bash
# Verificar que não há Apollo Server no index
grep -n "ApolloServer\|listen\|node-cron\|express" src/index.js
# Deve retornar vazio

# Verificar Firebase Function export
node -e "const m = require('./src/index.js'); console.log(typeof m.graphqlHandler)"
# Deve imprimir: function
```

---

### T-05: Criar cron function separada

**What**: Extrair `verificarEEnviarEmail()` em `src/cron/alertaAgenda.js` como function exportável
**Where**: `src/cron/alertaAgenda.js` (novo)
**Depends on**: T-01, T-02
**Reuses**: Lógica de `src/alerta_agenda.js` (`verificarEEnviarEmail()`)
**Requirement**: RF-06

**Done when**:
- [ ] `src/cron/alertaAgenda.js` exporta `handleAlertaAgenda()` assíncrona
- [ ] Function usa PrismaClient existente
- [ ] Function usa `process.env.GMAIL_USER` e `process.env.GMAIL_PASSWORD`
- [ ] `handleAlertaAgenda()` pode ser chamada diretamente
- [ ] Zero dependência de `node-cron`

**Verify**:
```bash
node -e "const { handleAlertaAgenda } = require('./src/cron/alertaAgenda'); console.log(typeof handleAlertaAgenda)"
# Deve imprimir: function
```

---

### T-06: Limpeza final — remover Apollo Server e loggingPlugin

**What**: Remover Apollo Server e loggingPlugin do package.json, remover `src/plugins/loggingPlugin.js`
**Where**: `package.json`, `src/plugins/`
**Depends on**: T-04, T-05
**Requirement**: RF-01

**Done when**:
- [ ] `npm uninstall apollo-server graphql` (apollo-server específico)
- [ ] `src/plugins/loggingPlugin.js` removido (era plugin do Apollo)
- [ ] `package.json` sem Apollo Server
- [ ] `npm ls` sem erros
- [ ] `npm start` roda servidor local com graphql-yoga
- [ ] Schema responde corretamente com todas as queries/mutations

**Verify**:
```bash
# Zero Apollo Server
npm ls apollo-server 2>&1
# Deve mostrar "empty" ou "not found"

# Schema responde corretamente
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __schema { types { name } } }"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"data\"][\"__schema\"][\"types\"])} types')"
# Deve imprimir > 50 types
```

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T-01 → T-02

Phase 2 (Sequential):
  T-02 complete → T-03 (server.js dev) → T-04 (Firebase handler)

Phase 3 (Sequential):
  T-04 complete → T-05 (cron) → T-06 (cleanup)
```

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T-01: Externalizar configs | 3 files | ✅ Granular |
| T-02: Remover node-cron | 1 file | ✅ Granular |
| T-03: Criar server.js dev | 1 file | ✅ Granular |
| T-04: Firebase + yoga handler | 2 files | ✅ Granular |
| T-05: Cron function | 1 file | ✅ Granular |
| T-06: Cleanup Apollo | rm + uninstall | ✅ Granular |

---

## Estimativa de Risco

| Task | Risco | Razão | Mitigação |
|------|-------|-------|-----------|
| T-01 | Baixo | Substituir strings por env vars | Grep para verificar zero credenciais |
| T-02 | Baixo | Remover imports simples | Verificar que cron não roda mais |
| T-03 | Baixo | graphql-yoga é Fetch API nativa | Handler mínimo com http.createServer |
| T-04 | Baixo | `onRequest(yoga)` é direto | Mesmo handler, só wrap com Firebase |
| T-05 | Baixo | Lógica já existe em `alerta_agenda.js` | Wrap em function exportável |
| T-06 | Baixo | Remoção simples | Verificar que yoga funciona antes de deletar |
