# Decisão: pós-cadastro usa login existente e protocolos são escopados no backend

## O que foi decidido

- O fluxo pós-cadastro deve autenticar chamando a mutation `login` existente com email/senha informados no cadastro, persistindo token antes de navegar para Home.
- A mutation `createUserAccount` não deve ser alterada para retornar token.
- A listagem de protocolos deve ser autorizada no backend por usuário autenticado, retornando apenas protocolos globais (`fk_conta_id = null`) e protocolos de contas autorizadas.

## Por quê

- `login` já é o contrato responsável por retornar token e alimentar `LocalStorage` no frontend.
- Alterar `createUserAccount` criaria mudança de contrato desnecessária e aumentaria risco de regressão.
- Escopo tenant não deve depender apenas do filtro enviado pelo cliente, porque filtros frontend podem ser removidos, alterados ou manipulados.
- Protocolos globais são seed de sistema e devem ser compartilhados com todos os usuários autenticados.

## O que foi descartado

- Retornar token diretamente em `createUserAccount`.
- Criar uma nova mutation exclusiva para “cadastro com login”.
- Resolver a ausência de protocolos globais apenas no frontend, sem proteção backend.
- Tornar soluções nutritivas globais ou afrouxar o escopo por `solucoes_contas`.

## Consequências

- A implementação futura deve tratar falha no login pós-cadastro como bloqueio de entrada autenticada na Home.
- O backend passa a ser a autoridade para visibilidade de protocolos, independentemente do filtro do cliente.
- O frontend ainda pode enviar filtro explícito para melhorar intenção e compatibilidade, mas não deve ser a única barreira de isolamento.
