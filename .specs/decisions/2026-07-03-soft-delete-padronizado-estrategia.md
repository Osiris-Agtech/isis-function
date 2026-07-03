# Decisão: Estratégia de Soft Delete Padronizado

## O que foi decidido

1. Todas as mutações de soft delete devem validar: existência, duplo delete, tenant scope.
2. Cascade obrigatório para dependências fortes (Lote → Agenda). Sem cascade para dependências fracas (Reservatório não deleta SNutritiva).
3. Adicionar `deleted_at` nas tabelas `solucoes_contas` e `solucoes_fertilizantes_concentradas`.
4. Usar `DomainError` padronizado: `NOT_FOUND`, `ALREADY_DELETED`, `TENANT_SCOPE_VIOLATION`.
5. Usar `prisma.$transaction` em todas as operações cascade.
6. Manter mutações simples e cascade separadas.

## Por que

- Consistência com o padrão estabelecido por `softDeleteProtocoloCascade`.
- Evitar dados órfãos (Agendas sem Lote).
- Segurança multi-tenant.
- Possibilitar soft delete completo de SNutritiva sem perder rastreabilidade.

## O que foi descartado

- Hard delete: descartado por não ser compatível com a arquitetura atual (todo delete é soft).
- Unificar em uma única mutation com flag `cascade`: descartado por simplicidade e clareza de contrato.
- Middleware Prisma global para filtrar `deleted_at`: descartado por depender de atualização de bibliotecas (Prisma 4+).

## Impacto

- Migration de banco necessária.
- Mutações cascade existentes serão sobrescritas (comportamento é strict-super-set).
- `apiErrors.js` pode precisar registrar `ALREADY_DELETED` com status 409.
