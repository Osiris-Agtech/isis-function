# Concerns

Problemas identificados que impactam a refatoração para function serverless.

## CRÍTICO — Segurança

### C-01: Credenciais hardcoded
- **Onde:** `src/alerta_agenda.js` (senha Gmail), `prisma/schema.prisma` (URL do PostgreSQL)
- **Impacto:** Credenciais expostas no repositório; bloqueador para produção
- **Ação:** Mover para variáveis de ambiente com `dotenv` ou equivalente

### C-02: JWT sem verificação
- **Onde:** Todas as queries/mutations (exceto `login`)
- **Impacto:** Qualquer cliente pode acessar dados de qualquer conta sem autenticação
- **Ação:** Implementar verificação de JWT no contexto da function

## ALTO — Dependências Abandonadas

### C-03: nexus-plugin-prisma descontinuado
- **Versão:** 0.35.0 (última release: 2022)
- **Impacto:** Incompatível com Prisma 4+; bloqueia atualização do ORM
- **Ação:** Migrar para Pothos GraphQL + plugin Prisma do Pothos, ou reescrever resolvers manualmente

### C-04: @nexus/schema descontinuado
- **Versão:** 0.20.1 (sem manutenção ativa)
- **Impacto:** Vulnerabilidades não corrigidas; sem suporte a novas versões do GraphQL
- **Ação:** Substituir por graphql-yoga + Pothos (code-first) ou schema SDL + graphql-js

### C-05: Prisma 3 defasado
- **Versão:** 3.15.2 (atual: 5.x)
- **Impacto:** Breaking changes entre v3→v4 e v4→v5; sem suporte a recursos novos
- **Ação:** Migrar para Prisma 5 após substituir nexus-plugin-prisma

## ALTO — Arquitetura

### C-06: Schema gerado em runtime
- **Onde:** `src/schema.js` — `makeSchema()` gera arquivos SDL ao iniciar
- **Impacto:** Cold start mais lento em serverless; arquivos gerados poluem o repositório
- **Ação:** Pre-build do schema (gerar SDL uma vez, não em runtime)

### C-07: Cron acoplado ao servidor
- **Onde:** `src/index.js` — cron iniciado junto com o servidor HTTP
- **Impacto:** Em serverless stateless, o cron nunca executa (função dorme entre requests)
- **Ação:** Separar em function dedicada com trigger agendado (EventBridge, Vercel Cron, Upstash)

### C-08: Arquivos monolíticos de query/mutation
- **Onde:** `src/schemas/query.js` (786 linhas), `src/schemas/mutation.js` (800+ linhas)
- **Impacto:** Difícil de manter; não aproveitam tree-shaking em serverless
- **Ação:** Refatorar por domínio (ex: `resolvers/lote.js`, `resolvers/usuario.js`)

### C-09: Business logic nos resolvers
- **Onde:** `query.js` — 150+ linhas de cálculo para `homeDashboard`, `relatorioCiclo`, `relatorioDesempenho`
- **Impacto:** Impossível testar a lógica isoladamente; violação de separação de responsabilidades
- **Ação:** Extrair para camada de services (`src/services/`)

## MÉDIO — Qualidade

### C-10: Soft delete inconsistente
- **Impacto:** CRUD automático do Nexus retorna registros deletados; queries manuais filtram — comportamento divergente
- **Ação:** Middleware Prisma para filtrar `deleted_at: null` globalmente, ou garantir filtragem nos resolvers novos

### C-11: Query logging em produção
- **Onde:** `src/index.js` — `log: ['query']` ativado sempre
- **Impacto:** Floods de log em produção; dados sensíveis nos logs
- **Ação:** Condicionar ao `NODE_ENV`

### C-12: Sem tratamento de erros consistente
- **Impacto:** Alguns resolvers têm try/catch, outros não; erros do Prisma vazam para o cliente
- **Ação:** Definir tipos de erro GraphQL e handler global

### C-13: Sem validação de input
- **Impacto:** Mutações aceitam dados inválidos; sem sanitização
- **Ação:** Adicionar validação nos resolvers ou usar diretivas GraphQL

## BAIXO — Manutenibilidade

### C-14: Sem TypeScript no código-fonte
- **Impacto:** Sem suporte a IDE completo; erros de tipo em runtime
- **Nota:** Nexus já gera tipos `.ts` para Prisma — migrar para TS seria baixo custo relativo

### C-15: Logger criado mas não usado
- **Onde:** `src/utils/logger.js` — classe Logger sem uso nos resolvers
- **Ação:** Usar ou remover
