# Deploy: GCP Cloud Functions + Neon Postgres

## Visão Geral

A API é implantada como duas **Cloud Functions Gen 2** no GCP:

| Function | Entry Point | Trigger | Auth |
|----------|-------------|---------|------|
| `osiris-api` | `graphqlHandler` | HTTP | Public |
| `osiris-alerta-agenda` | `alertaAgendaHandler` | HTTP (via Cloud Scheduler) | Privada |

O banco de dados é **Neon Postgres** (serverless, conexão via SSL).

---

## Pré-requisitos

### 1. GCP Project
```bash
gcloud projects create osiris-api --name="Osiris API"
gcloud config set project osiris-api

# Habilitar APIs necessárias
gcloud services enable cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  run.googleapis.com
```

### 2. Neon Database
1. Criar projeto em [neon.tech](https://neon.tech)
2. Criar database `osiris_prod`
3. Copiar connection string: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/osiris_prod?sslmode=require`
4. Rodar migration: `DATABASE_URL=<url> npx prisma db push`

### 3. Secrets no Secret Manager
```bash
# Criar os secrets (substitua os valores)
echo -n "postgresql://user:pass@ep-xxx.aws.neon.tech/osiris_prod?sslmode=require" \
  | gcloud secrets create DATABASE_URL --data-file=-

echo -n "seu-jwt-secret-aqui" \
  | gcloud secrets create JWT_SECRET --data-file=-

echo -n "osiris.agitech.dev@gmail.com" \
  | gcloud secrets create GMAIL_USER --data-file=-

echo -n "sua-app-password-gmail" \
  | gcloud secrets create GMAIL_PASSWORD --data-file=-
```

### 4. Permissões do Cloud Build
```bash
PROJECT_NUMBER=$(gcloud projects describe osiris-api --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding osiris-api \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding osiris-api \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding osiris-api \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser"
```

---

## CI/CD com Cloud Build

O arquivo `cloudbuild.yaml` na raiz do projeto define o pipeline.

### Conectar repositório
1. Acesse [Cloud Build > Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. **Connect Repository** → selecione o repositório Git
3. **Create Trigger**:
   - Event: Push to branch `main`
   - Configuration: `cloudbuild.yaml`

### Deploy manual (sem CI/CD)
```bash
# GraphQL handler
gcloud functions deploy osiris-api \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-east1 \
  --entry-point=graphqlHandler \
  --trigger-http \
  --allow-unauthenticated \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GMAIL_USER=GMAIL_USER:latest,GMAIL_PASSWORD=GMAIL_PASSWORD:latest

# Alerta agenda handler
gcloud functions deploy osiris-alerta-agenda \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-east1 \
  --entry-point=alertaAgendaHandler \
  --trigger-http \
  --no-allow-unauthenticated \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,GMAIL_USER=GMAIL_USER:latest,GMAIL_PASSWORD=GMAIL_PASSWORD:latest
```

---

## Cloud Scheduler (Cron)

Substituição do `node-cron` interno — executa `alertaAgendaHandler` diariamente às 07:00 BRT (10:00 UTC):

```bash
# Criar conta de serviço para o scheduler invocar a function
gcloud iam service-accounts create osiris-scheduler \
  --display-name="Osiris Scheduler"

SA_EMAIL="osiris-scheduler@osiris-api.iam.gserviceaccount.com"
FUNCTION_URL=$(gcloud functions describe osiris-alerta-agenda \
  --gen2 --region=us-east1 --format='value(serviceConfig.uri)')

# Permissão para invocar a function privada
gcloud functions add-invoker-policy-binding osiris-alerta-agenda \
  --region=us-east1 \
  --member="serviceAccount:${SA_EMAIL}"

# Criar o job
gcloud scheduler jobs create http osiris-alerta-diaria \
  --location=us-east1 \
  --schedule="0 10 * * *" \
  --uri="${FUNCTION_URL}" \
  --oidc-service-account-email="${SA_EMAIL}" \
  --time-zone="UTC"
```

---

## Desenvolvimento Local

```bash
# Copiar .env.example e preencher
cp .env.example .env

# Rodar localmente (após refatoração estar completa)
npm run dev        # inicia src/server.js (wrapper HTTP do handler)

# Simular Cloud Function localmente
npx @google-cloud/functions-framework --target=graphqlHandler
```

---

## Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `DATABASE_URL` | Connection string Neon Postgres com `?sslmode=require` | Sim |
| `JWT_SECRET` | Secret para assinar/verificar tokens JWT | Sim |
| `GMAIL_USER` | E-mail Gmail para envio de alertas | Sim |
| `GMAIL_PASSWORD` | App Password do Gmail (não a senha normal) | Sim |
| `NODE_ENV` | `development` ou `production` | Não (default: production em GCP) |

---

## Observações Neon

- Neon usa **connection pooling** via PgBouncer — recomendado para serverless
- Use a URL de **pooled connection** (porta 5432 via pooler) para Cloud Functions
- URL direta (porta 5432 no host principal) para migrations/prisma db push
- Neon hiberna instâncias idle — first request pode ser ~1s mais lento (cold start do banco)
