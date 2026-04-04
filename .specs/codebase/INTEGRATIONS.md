# Integrations

## PostgreSQL
- **Host:** 200.129.247.244:5432 (hardcoded no `prisma/schema.prisma`)
- **Database:** osiris_dev
- **Acesso:** Prisma ORM
- **Migrações:** `prisma/migrations/` (gitignored)
- ⚠️ Credenciais hardcoded no schema — precisam mover para variável de ambiente

## Gmail SMTP (Nodemailer)
- **Arquivo:** `src/alerta_agenda.js`
- **Conta:** osiris.agitech.dev@gmail.com
- **Trigger:** Cron às 07:00 diariamente
- **Propósito:** Enviar lembretes de agendas não finalizadas
- ⚠️ Senha hardcoded no código-fonte

## Cron (node-cron)
- **Schedule:** `00 07 * * *` (07:00 todos os dias)
- **Ação:** `verificarEEnviarEmail()` — busca agendas abertas e notifica responsáveis
- **Acoplamento:** Iniciado junto com o servidor em `src/index.js`
- ⚠️ Em formato serverless, precisa ser substituído por scheduler externo (ex: AWS EventBridge, Vercel Cron, Upstash QStash)

## APIs Externas
- Nenhuma integração com APIs externas além do Gmail SMTP

## Sem Integrações
- Sem Firebase/Auth
- Sem SMS/Twilio
- Sem storage (S3, GCS)
- Sem message queue
- Sem Redis/cache
