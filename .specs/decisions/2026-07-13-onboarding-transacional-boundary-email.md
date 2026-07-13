# Decisão — Boundary transacional do onboarding e e-mail fora da transação

## O que foi decidido

O onboarding de `createUserAccount` e do ramo de novo usuário de `inviteContributor` deve persistir dados iniciais dentro de uma transação Prisma única, incluindo as culturas `Alface Crespa` e `Rúcula`. O envio ou enfileiramento de e-mail deve ocorrer somente após commit bem-sucedido e fora da transação.

## Por que

As mutations criam vários registros relacionados. Sem transação, falhas intermediárias podem deixar dados parciais. Prisma consegue garantir rollback apenas para operações de banco; e-mail é efeito externo e não pode ser revertido atomicamente junto ao banco.

## O que foi descartado

- Manter compensação manual como principal mecanismo de rollback para onboarding.
- Enviar e-mail dentro da transação.
- Alterar o contrato GraphQL para expor novo status transacional ou dados adicionais.
- Alterar schema de banco, seeds ou criar culturas retroativamente.
