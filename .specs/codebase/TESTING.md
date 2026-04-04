# Testing

## Situação Atual

**Sem testes configurados.** O projeto não possui:
- Framework de testes (Jest, Vitest, Mocha)
- Scripts de teste no `package.json`
- Arquivos de teste (`*.test.js`, `*.spec.js`)
- Mocks ou fixtures

## Implicações para Refatoração

- Não há suite de regressão para validar que a refatoração preserva o comportamento
- **Recomendação:** Antes de refatorar, criar testes de integração end-to-end básicos para as queries/mutations críticas (login, homeDashboard, CRUD de Lote)
- Alternativamente, usar um snapshot do schema GraphQL atual como contrato de regressão

## Estratégia Sugerida (pós-refatoração)

1. **Testes de integração** — testar resolvers contra banco de teste real (Prisma suporta banco isolado por test run)
2. **Testes unitários** — após extrair business logic para services, testar services isolados com mocks do Prisma
3. **Contract tests** — comparar SDL gerado antes/depois para garantir compatibilidade da API
