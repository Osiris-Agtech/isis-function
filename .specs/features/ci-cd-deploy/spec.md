# CI/CD: Deploy Firebase Functions + Neon Postgres (Migrations + Seeds)

## Problema

A API GraphQL do Osiris Agtech já foi migrada para Firebase Functions com graphql-yoga (Nexus mantido). Agora é necessário criar a pipeline de CI/CD para:
1. Deploy automático das functions no Firebase Functions Gen 2
2. Conexão com Neon Postgres
3. Aplicação de migrations e seeds quando necessário

O projeto atualmente tem um `cloudbuild.yaml` para GCP Cloud Functions (legado) mas **nenhuma configuração Firebase** (`firebase.json`, `.firebaserc`).

## Metas

- [ ] `firebase.json` configurado com ambas as functions (API + cron)
- [ ] `.firebaserc` com projeto Firebase configurado
- [ ] Pipeline CI/CD (GitHub Actions ou Cloud Build) que faz deploy automático
- [ ] Migrations aplicadas automaticamente antes do deploy (`prisma migrate deploy`)
- [ ] Seeds aplicados quando necessário (`prisma db seed`)
- [ ] Secrets gerenciados (Firebase App Configuration / GCP Secret Manager)

## Fora de Escopo

| Feature | Razão |
|---------|-------|
| Migração para Pothos | Feature separada |
| Testes automatizados | Fora de escopo desta feature |
| TypeScript | Fora de escopo |
| Multi-ambiente (staging/prod) | Focar em um ambiente primeiro |

---

## User Stories

### P1: Pipeline CI/CD funcional ⭐ MVP

**User Story**: Como desenvolvedor, quero que um push para `main` dispare deploy automático das Firebase Functions, para que eu não precise fazer deploy manual.

**Critérios de Aceitação**:
1. WHEN push para `main` THEN a pipeline SHALL build, gerar Prisma Client, aplicar migrations e deploy das functions
2. WHEN a pipeline falhar em qualquer etapa THEN o deploy SHALL ser abortado (fail-fast)
3. WHEN o deploy completar THEN a API GraphQL SHALL responder no endpoint Firebase
4. WHEN migrations existirem THEN `prisma migrate deploy` SHALL rodar antes do deploy

**Teste Independente**: Push para branch feature → merge em main → verificar Cloud Build/Firebase deploy log.

---

### P2: Migrations aplicadas automaticamente ⭐

**User Story**: Como DBA/desenvolvedor, quero que as migrations do Prisma sejam aplicadas automaticamente antes do deploy, para que o banco esteja sempre em sync com o schema.

**Critérios de Aceitação**:
1. WHEN `prisma/migrations/` contém migrations pendentes THEN `prisma migrate deploy` SHALL aplicar todas antes do deploy
2. WHEN não há migrations pendentes THEN o comando SHALL completar sem erro (no-op)
3. WHEN uma migration falhar THEN o deploy SHALL abortar

---

### P3: Seeds aplicados quando necessário

**User Story**: Como desenvolvedor, quero que seeds de dados essenciais sejam aplicados quando o ambiente precisar, para que a aplicação tenha dados base para funcionar.

**Critérios de Aceitação**:
1. WHEN `prisma/seed.js` existir THEN `prisma db seed` SHALL ser executável na pipeline
2. WHEN seeds falharem em dados existentes THEN SHALL ser idempotente (upsert, não crash)
3. WHEN seeds não existirem THEN a pipeline SHALL prosseguir sem erro

---

### P3: Conexão com Neon Postgres

**User Story**: Como operador, quero que as Firebase Functions se conectem ao Neon Postgres via `DATABASE_URL` configurada como secret, para que a conexão seja segura e configurável por ambiente.

**Critérios de Aceitação**:
1. WHEN a function é deployada THEN `DATABASE_URL` SHALL vir de Firebase Config / Secret Manager
2. WHEN `DATABASE_URL` não está definida THEN a function SHALL falhar com mensagem clara
3. WHEN conexão com Neon usa SSL THEN SHALL funcionar com `sslmode=require` na connection string

---

## Edge Cases

- WHEN `prisma migrate deploy` é executado sem migrations pendentes THEN exit code 0 (no-op)
- WHEN `prisma db seed` é executado sem arquivo de seed THEN logar aviso e prosseguir
- WHEN secrets não estão configurados no Firebase THEN a pipeline SHALL falhar com mensagem clara sobre qual secret falta
- WHEN deploy falha no meio THEN Firebase Functions SHALL reverter para versão anterior (rollback automático)
- WHEN Cold Start após período idle THEN primeiro request pode ser ~1s mais lento (Neon hiberna)

---

## Rastreabilidade de Requisitos

| ID | Story | Fase | Status |
|----|-------|------|--------|
| RF-01 | P1: Pipeline CI/CD | Design | Pending |
| RF-02 | P2: Migrations auto | Design | Pending |
| RF-03 | P3: Seeds | Design | Pending |
| RF-04 | P3: Conexão Neon | Design | Pending |

---

## Critérios de Sucesso

- [ ] `firebase.json` configurado com `graphqlHandler` e `alertaAgendaHandler`
- [ ] `.firebaserc` com projeto Firebase configurado
- [ ] Pipeline CI/CD roda em push para `main`
- [ ] `prisma migrate deploy` roda antes do deploy
- [ ] `prisma db seed` roda quando seed existe
- [ ] Secrets configurados via Firebase App Configuration
- [ ] Zero deploy manual necessário
