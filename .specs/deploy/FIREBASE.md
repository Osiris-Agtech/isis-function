# Deploy: Firebase Functions + Neon Postgres

## Visão Geral

A API é implantada como duas **Firebase Functions Gen 2** no projeto `osiris-api`:

| Function | Entry Point | Trigger | Auth |
|----------|-------------|---------|------|
| `graphqlHandler` | `src/index.js` → `exports.graphqlHandler` | HTTP | Público |
| `alertaAgendaHandler` | `src/cron/alertaAgenda.js` | HTTP (via Cloud Scheduler) | Privado |

O banco de dados é **Neon Postgres** (serverless, conexão via SSL).

---

## Pré-requisitos

### 1. Projeto Firebase

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Verificar projeto
firebase projects:list
```

O projeto `osiris-api` deve existir no Firebase Console.

### 2. Neon Database

1. Criar projeto em [neon.tech](https://neon.tech)
2. Criar database `osiris_prod`
3. Copiar connection string: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/osiris_prod?sslmode=require`
4. Aplicar migrations localmente para validar:
   ```bash
   DATABASE_URL="sua-connection-string" npx prisma migrate deploy
   ```

### 3. Secrets no Firebase

```bash
# Configurar variáveis de ambiente via Firebase CLI
firebase functions:config:set \
  gmail.user="osiris.agitech.dev@gmail.com" \
  gmail.password="seu-app-password" \
  jwt.secret="seu-jwt-secret-aqui"

# Verificar config
firebase functions:config:get
```

> **Nota:** Para produção, usar **GCP Secret Manager** em vez de Firebase Config para dados sensíveis (`DATABASE_URL`, `JWT_SECRET`).

### 4. GCP Secret Manager (Recomendado para Produção)

```bash
# Criar secrets no Secret Manager (mesmo projeto do Firebase)
echo -n "postgresql://user:pass@ep-xxx.aws.neon.tech/osiris_prod?sslmode=require" \
  | gcloud secrets create DATABASE_URL --data-file=-

echo -n "seu-jwt-secret-aqui" \
  | gcloud secrets create JWT_SECRET --data-file=-

echo -n "osiris.agitech.dev@gmail.com" \
  | gcloud secrets create GMAIL_USER --data-file=-

echo -n "seu-app-password-gmail" \
  | gcloud secrets create GMAIL_PASSWORD --data-file=-
```

---

## Deploy Manual

### Primeiro Deploy

```bash
# Garantir que .env existe localmente
cp .env.example .env
# Editar .env com valores reais

# Gerar Prisma Client
npx prisma generate

# Aplicar migrations
npx prisma migrate deploy

# Aplicar seeds (opcional)
npx prisma db seed

# Deploy
firebase deploy --only functions --project osiris-api
```

### Deploy Apenas de uma Function

```bash
# Apenas API GraphQL
firebase deploy --only functions:graphqlHandler --project osiris-api

# Apenas cron
firebase deploy --only functions:alertaAgendaHandler --project osiris-api
```

---

## CI/CD — Deploy Automático

### Opção A: Cloud Build (cloudbuild.yaml)

Pipeline já configurada na raiz do projeto. Requisitos:

1. **Secret Manager** com `DATABASE_URL` e `FIREBASE_SA_KEY`
2. **Service Account Key** do Firebase armazenada como secret:
   ```bash
   # Criar SA key no GCP Console → IAM → Service Accounts
   # Fazer download do JSON
   # Armazenar como secret:
   cat /path/to/firebase-sa-key.json | gcloud secrets create FIREBASE_SA_KEY --data-file=-
   ```
3. **Trigger** configurado no Cloud Build para push em `main`

### Opção B: GitHub Actions (.github/workflows/deploy.yml)

Workflow já criado. Requisitos:

1. **GitHub Secrets** configurados no repositório:
   - `DATABASE_URL` — connection string Neon
   - `FIREBASE_TOKEN` — token de deploy do Firebase

2. **Gerar Firebase Token**:
   ```bash
   firebase login:ci
   # Copiar o token gerado e adicionar como GitHub Secret
   ```

3. O workflow executa automaticamente em push para `main`.

---

## Cloud Scheduler (Cron)

Substituição do `node-cron` interno — executa `alertaAgendaHandler` diariamente às 07:00 BRT (10:00 UTC):

```bash
# Criar Cloud Scheduler job
gcloud scheduler jobs create http osiris-alerta-diaria \
  --location=us-central1 \
  --schedule="0 10 * * *" \
  --uri="https://us-central1-osiris-api.cloudfunctions.net/alertaAgendaHandler" \
  --http-method=GET \
  --time-zone="UTC"
```

> **Nota:** A URL da function pode ser obtida no Firebase Console → Functions → `alertaAgendaHandler`.

---

## Variáveis de Ambiente

| Variável | Descrição | Obrigatória | Onde Configurar |
|----------|-----------|-------------|-----------------|
| `DATABASE_URL` | Connection string Neon Postgres com `?sslmode=require` | Sim | Secret Manager / GitHub Secrets |
| `JWT_SECRET` | Secret para assinar/verificar tokens JWT | Sim | Firebase Config / Secret Manager |
| `GMAIL_USER` | E-mail Gmail para envio de alertas | Sim | Firebase Config |
| `GMAIL_PASSWORD` | App Password do Gmail (não senha normal) | Sim | Firebase Config |
| `NODE_ENV` | `development` ou `production` | Não | Automático (production no Firebase) |

---

## Observações Neon

- Neon usa **connection pooling** via PgBouncer — recomendado para serverless
- Use a URL de **pooled connection** (porta 5432 via pooler) para Firebase Functions
- URL direta para migrations locais e `prisma db push`
- Neon hiberna instâncias idle — first request pode ser ~1s mais lento (cold start do banco + function)

---

## Troubleshooting

### `DATABASE_URL not found`
Verificar se a secret está configurada:
```bash
firebase functions:config:get
# Ou no GCP Secret Manager
gcloud secrets list
```

### Function não responde
Verificar logs:
```bash
firebase functions:log --only graphqlHandler
```

### Migration falha
Verificar se o banco está acessível:
```bash
DATABASE_URL="sua-url" npx prisma migrate status
```

### Deploy falha no Cloud Build
Verificar se a Service Account Key é válida e tem permissões:
```bash
gcloud iam service-accounts list
gcloud projects get-iam-policy osiris-api
```
