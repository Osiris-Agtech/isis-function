# Tasks: CI/CD — Firebase Functions + Neon Postgres (Migrations + Seeds)

**Design**: `.specs/features/ci-cd-deploy/design.md`
**Status**: Draft

---

## Execution Plan

```
T-01 → T-02 → T-03 → T-04 → T-05
```

Todas sequenciais — cada task depende da anterior.

---

## Task Breakdown

### T-01: Criar configuração Firebase (`firebase.json` + `.firebaserc`)

**What**: Criar arquivos de configuração do Firebase Functions
**Where**: Raiz do projeto — `firebase.json`, `.firebaserc`
**Depends on**: None
**Requirement**: RF-01

**`firebase.json`:**

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

**`.firebaserc`:**

```json
{
  "projects": {
    "default": "osiris-api"
  }
}
```

> **Nota:** O ID `"osiris-api"` deve ser substituído pelo ID real do projeto Firebase.

**Done when**:
- [ ] `firebase.json` criado com configuração da function
- [ ] `.firebaserc` criado com ID do projeto
- [ ] `firebase.json` ignora arquivos desnecessários (reduz tamanho do deploy)

**Verify**:
```bash
node -e "console.log(JSON.stringify(require('./firebase.json'), null, 2))"
# Deve imprimir JSON válido
```

---

### T-02: Criar script de seed opcional

**What**: Criar `prisma/seed.js` com dados base idempotentes e configurar no `package.json`
**Where**: `prisma/seed.js`, `package.json`
**Depends on**: T-01
**Requirement**: RF-03

**`prisma/seed.js`:**

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Seeds idempotentes com upsert
  // Adicionar dados base conforme necessidade
  console.log('Seed executado — nenhum dado base necessário ainda');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**`package.json` — adicionar:**

```json
{
  "prisma": {
    "seed": "node prisma/seed.js"
  }
}
```

**Done when**:
- [ ] `prisma/seed.js` criado com função `main()` idempotente
- [ ] `package.json` tem seção `"prisma": { "seed": "..." }`
- [ ] `npx prisma db seed` executa sem erro

**Verify**:
```bash
npx prisma db seed
# Deve executar sem erro (ou logar aviso se vazio)
```

---

### T-03: Adaptar `cloudbuild.yaml` para Firebase + Migrations

**What**: Reescrever `cloudbuild.yaml` para deploy via Firebase CLI com etapas de migration e seed
**Where**: `cloudbuild.yaml` (reescrever)
**Depends on**: T-01, T-02
**Requirement**: RF-01, RF-02, RF-03

**Etapas da pipeline:**

1. `npm ci --omit=dev` — instala dependências
2. `npx prisma generate` — gera Prisma Client
3. `npx prisma migrate deploy` — aplica migrations pendentes
4. `npx prisma db seed` — aplica seeds (allow failure se ausente)
5. `firebase deploy --only functions` — deploy das functions

**Done when**:
- [ ] `cloudbuild.yaml` tem todas as 5 etapas
- [ ] `DATABASE_URL` vem do Secret Manager
- [ ] Etapa 4 (seed) não falha o build se seed não existir
- [ ] Deploy usa `firebase deploy --only functions` com service account auth
- [ ] Ambas functions são deployadas (`graphqlHandler` + `alertaAgendaHandler`)

**Verify**:
```bash
# Validar YAML
python3 -c "import yaml; yaml.safe_load(open('cloudbuild.yaml'))"
# Deve imprimir sem erro
```

---

### T-04: Criar GitHub Actions como alternativa (`.github/workflows/deploy.yml`)

**What**: Criar workflow GitHub Actions como alternativa ao Cloud Build
**Where**: `.github/workflows/deploy.yml`
**Depends on**: T-03
**Requirement**: RF-01

**Etapas do workflow:**

1. Checkout
2. Setup Node.js 20
3. `npm ci --omit=dev`
4. `npx prisma generate` (com `DATABASE_URL` secret)
5. `npx prisma migrate deploy` (com `DATABASE_URL` secret)
6. `npx prisma db seed || true` (com `DATABASE_URL` secret)
7. Firebase deploy via `FirebaseExtended/action-hosting-deploy` ou `w9jlos/firebase-action`

**Done when**:
- [ ] `.github/workflows/deploy.yml` criado com workflow completo
- [ ] Secrets referenciados: `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT`
- [ ] Workflow trigger em push para `main`
- [ ] Seed é opcional (`|| true`)
- [ ] Workflow documentado no README

**Verify**:
```bash
# Validar YAML
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
```

---

### T-05: Documentar setup de secrets e deploy manual

**What**: Criar seção no README ou doc separado com instruções de setup inicial
**Where**: `README.md` ou `.specs/deploy/SETUP.md`
**Depends on**: T-04
**Requirement**: RF-04

**Conteúdo:**

1. Criar projeto Firebase (`firebase init`)
2. Configurar secrets no GCP Secret Manager ou Firebase Config
3. Primeiro deploy manual (`firebase deploy --only functions`)
4. Configurar Cloud Scheduler para cron
5. Verificar conexão com Neon Postgres

**Done when**:
- [ ] Documentação criada com passos de setup
- [ ] Comandos de setup de secrets documentados
- [ ] Instruções de deploy manual incluídas
- [ ] Instruções de Cloud Scheduler para cron incluídas

---

## Parallel Execution Map

```
Sequencial:
  T-01 → T-02 → T-03 → T-04 → T-05
```

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T-01: firebase.json + .firebaserc | 2 files | ✅ Granular |
| T-02: seed.js + package.json | 2 files | ✅ Granular |
| T-03: cloudbuild.yaml | 1 file | ✅ Granular |
| T-04: GitHub Actions workflow | 1 file | ✅ Granular |
| T-05: Documentação | 1 file | ✅ Granular |

---

## Estimativa de Risco

| Task | Risco | Razão | Mitigação |
|------|-------|-------|-----------|
| T-01 | Baixo | Arquivos JSON simples | Validar com node -e |
| T-02 | Baixo | Seed é opcional e idempotente | upsert pattern |
| T-03 | Médio | Firebase CLI auth no Cloud Build | Service account key via ADC |
| T-04 | Baixo | GitHub Actions com action oficial | w9jlos/firebase-action é maintido |
| T-05 | Baixo | Documentação | Baseado em passos testados |
