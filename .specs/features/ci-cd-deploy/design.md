# Design: CI/CD — Firebase Functions + Neon Postgres (Migrations + Seeds)

**Spec**: `.specs/features/ci-cd-deploy/spec.md`
**Status**: Approved

---

## Arquitetura de Deploy

```
┌────────────────────────────────────────────────────────────┐
│  CI/CD Pipeline (GitHub Actions ou Cloud Build)            │
│                                                            │
│  1. checkout → 2. npm ci → 3. prisma generate              │
│  4. prisma migrate deploy → 5. prisma db seed (optional)   │
│  6. firebase deploy --only functions                       │
└───────────────────────┬────────────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  Firebase Functions Gen 2     │
        │  us-central1                  │
        │                               │
        │  ┌─────────────────────────┐ │
        │  │ graphqlHandler          │ │  ← HTTP (público)
        │  │ onRequest(yoga)         │ │
        │  └─────────────────────────┘ │
        │  ┌─────────────────────────┐ │
        │  │ alertaAgendaHandler     │ │  ← HTTP (privado, via Scheduler)
        │  │ onSchedule / onRequest  │ │
        │  └─────────────────────────┘ │
        └───────────┬───────────────────┘
                    ↓
        ┌───────────────────────┐
        │  Neon Postgres        │
        │  (serverless, SSL)    │
        │  sslmode=require      │
        └───────────────────────┘
```

---

## Arquivos a Criar

### `firebase.json`

```json
{
  "functions": [
    {
      "source": ".",
      "codebase": "default",
      "ignore": [
        "node_modules/.cache",
        ".git",
        ".github",
        ".specs",
        ".claude",
        ".qwen",
        "dockerfile",
        "docker-compose.yml",
        "README.md"
      ],
      "runtime": "nodejs20"
    }
  ],
  "emulators": {
    "functions": {
      "port": 5001
    }
  }
}
```

> **Nota:** O entry point das functions é definido em `src/index.js` com exports nomeados (`graphqlHandler`, `alertaAgendaHandler`). O Firebase detecta automaticamente os exports.

### `.firebaserc`

```json
{
  "projects": {
    "default": "osiris-api"
  }
}
```

> **Nota:** Substituir `"osiris-api"` pelo ID real do projeto Firebase.

---

## Firebase Function — Entry Point

O `src/index.js` já exporta ambas functions:

```js
// Firebase Function: graphqlHandler (HTTP, público)
exports.graphqlHandler = onRequest(yoga)

// Firebase Function: alertaAgendaHandler (HTTP, privado)
// Para usar Firebase Scheduler:
// exports.alertaAgendaHandler = onSchedule("0 10 * * *", handler)
```

### Opção A: Scheduler via onRequest + HTTP trigger

Manter `alertaAgendaHandler` como `onRequest` e usar Firebase Scheduler (Cloud Scheduler) para fazer HTTP trigger. Mais simples, sem dependência extra.

### Opção B: Scheduler nativo v2

Usar `onSchedule` do `firebase-functions/v2/scheduler`. Requer billing Blaze no Firebase.

**Decisão:** Usar **Opção A** (onRequest + Cloud Scheduler) — mais compatível e não requer billing upgrade imediato.

---

## Pipeline CI/CD

### Opção escolhida: Cloud Build (já configurado, adaptar para Firebase)

O projeto já tem `cloudbuild.yaml`. Vamos adaptá-lo para deploy via Firebase CLI em vez de `gcloud functions deploy`.

```yaml
# cloudbuild.yaml — adaptado para Firebase
steps:
  # 1. Instalar dependências
  - name: 'node:20'
    entrypoint: npm
    args: ['ci', '--omit=dev']

  # 2. Gerar Prisma Client
  - name: 'node:20'
    entrypoint: npx
    args: ['prisma', 'generate']
    secretEnv: ['DATABASE_URL']

  # 3. Aplicar migrations
  - name: 'node:20'
    entrypoint: npx
    args: ['prisma', 'migrate', 'deploy', '--schema=prisma/schema.prisma']
    secretEnv: ['DATABASE_URL']

  # 4. Aplicar seeds (se existir)
  - name: 'node:20'
    entrypoint: npx
    args: ['prisma', 'db', 'seed']
    secretEnv: ['DATABASE_URL']
    # Não falhar se seed não existir
    allowFailure: true

  # 5. Instalar Firebase CLI e fazer deploy
  - name: 'node:20'
    entrypoint: bash
    args:
      - '-c'
      - |
        npm install -g firebase-tools
        # Autenticar via service account (ADC)
        export GOOGLE_APPLICATION_CREDENTIALS="${_FIREBASE_SA_KEY}"
        firebase deploy --only functions --non-interactive --project ${_FIREBASE_PROJECT_ID}

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/DATABASE_URL/versions/latest
      env: DATABASE_URL

options:
  logging: CLOUD_LOGGING_ONLY
```

### Opção alternativa: GitHub Actions

Se o repositório está no GitHub, GitHub Actions pode ser mais simples:

```yaml
# .github/workflows/deploy.yml
name: Deploy Firebase Functions

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --omit=dev
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npx prisma db seed || true
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: osiris-api
```

**Decisão:** Oferecer **ambas as opções** no design. Cloud Build é o atual (adaptar). GitHub Actions é mais simples para repositórios GitHub.

---

## Strategy de Migrations

### `prisma migrate deploy` vs `prisma db push`

| Comando | Uso | Produ? |
|---------|-----|--------|
| `prisma migrate deploy` | Aplica migrations do diretório `prisma/migrations/` | Sim — recomendado |
| `prisma db push` | Sincroniza schema sem criar migration | Não — apenas dev |

**Decisão:** Usar `prisma migrate deploy` na pipeline. Aplicará todas as 5 migrations existentes na primeira execução.

### Migrations existentes

| Migration | Data | Descrição |
|-----------|------|-----------|
| `20231124021826_new_tables` | 2023-11-24 | Tabelas iniciais |
| `20240405024854_removed_default_for_deleted_at_agenda` | 2024-04-05 | Remove default de deleted_at |
| `20240412025015_removido_default_now_para_deleted_at` | 2024-04-12 | Ajuste em deleted_at |
| `20240416025239_adicionado_protocolo_em_lote` | 2024-04-16 | Protocolo em Lote |
| `20240511191443_added_duracao_dias_real_for_acao_table` | 2024-05-11 | Duracao dias real |

Na primeira execução, todas serão aplicadas. Execuções subsequentes serão no-op.

---

## Strategy de Seeds

### Criação do arquivo de seed

```js
// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Exemplo: criar conta padrão se não existir
  const conta = await prisma.conta.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: 'Conta Demo',
      nivel: '1',
    },
  });
  console.log('Seed executado:', conta);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Configuração no package.json

```json
{
  "prisma": {
    "seed": "node prisma/seed.js"
  }
}
```

> **Nota:** O arquivo de seed é **opcional**. Se não existir, `prisma db seed` loga aviso e prossegue.

---

## Secrets Management

### Firebase App Configuration

No Firebase Functions Gen 2, secrets são configurados via:

```bash
# Via CLI
firebase functions:config:set gmail.user="osiris.agitech.dev@gmail.com"
firebase functions:config:set gmail.password="app-password"
firebase functions:config:set jwt.secret="seu-secret"
```

### GCP Secret Manager (recomendado para produção)

O `DATABASE_URL` e outros secrets sensíveis devem ficar no GCP Secret Manager e serem acessados via ADC (Application Default Credentials).

### Variáveis de ambiente necessárias

| Variável | Descrição | Onde configurar |
|----------|-----------|----------------|
| `DATABASE_URL` | Connection string Neon com SSL | Secret Manager |
| `JWT_SECRET` | Secret para assinar JWT | Secret Manager |
| `GMAIL_USER` | Email Gmail | Firebase Config / Secret Manager |
| `GMAIL_PASSWORD` | App Password Gmail | Secret Manager |
| `NODE_ENV` | `production` | Automático no Firebase |

---

## Diagrama de Fluxo da Pipeline

```
push para main
    ↓
GitHub Actions / Cloud Build trigger
    ↓
┌─────────────────────────┐
│ 1. npm ci --omit=dev    │ ← Instala dependências
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ 2. prisma generate      │ ← Gera Prisma Client
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ 3. prisma migrate deploy│ ← Aplica migrations pendentes
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ 4. prisma db seed       │ ← Aplica seeds (optional)
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ 5. firebase deploy      │ ← Deploy das functions
│    --only functions     │
└───────────┬─────────────┘
            ↓
    ✅ Deploy completo
```

---

## Decisões Técnicas

| Decisão | Escolha | Racional |
|---------|---------|----------|
| Pipeline | Cloud Build (existente) + opção GitHub Actions | Cloud Build já configurado; Actions é alternativa mais simples |
| Migrations | `prisma migrate deploy` | Aplica migrations existentes de forma idempotente |
| Seeds | Arquivo `prisma/seed.js` opcional | Idempotente com upsert; não bloqueia pipeline se ausente |
| Scheduler | onRequest + Cloud Scheduler (não onSchedule nativo) | Mais compatível, não requer billing Blaze |
| Secrets | GCP Secret Manager para DATABASE_URL + JWT_SECRET; Firebase Config para Gmail | Secret Manager é mais seguro para dados sensíveis |
| Runtime | Node.js 20 | Compatível com Firebase Functions Gen 2 |
