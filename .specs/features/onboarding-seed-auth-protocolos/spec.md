# Feature: Onboarding com autenticação real e visibilidade segura de protocolos seed

## Contexto

Novos usuários cadastrados pelo frontend Flutter (`/home/joao/Documentos/personal/mestras/osi-solucoes`) entram na Home após `createUserAccount` com um `Usuario` salvo localmente, mas sem token persistido. O backend GraphQL (`/home/joao/Documentos/personal/mestras/isis`) usa `authUserId` derivado do token para escopar dados sensíveis, como soluções nutritivas via `solucoes_contas`. Como consequência, após cadastro, consultas autenticadas/tenant-scoped podem retornar vazias ou falhar, enquanto dados sem o mesmo escopo, como reservatórios, continuam aparecendo.

Também há inconsistência na experiência de protocolos: o seed backend cria protocolos globais com `fk_conta_id = null`, mas o frontend busca apenas protocolos cuja `conta.id` é igual ao `contaId` atual, excluindo os globais. No backend, a query CRUD de `protocolos` aplica apenas `deleted_at = null`, o que deixa a proteção contra exposição cross-tenant dependente do filtro enviado pelo cliente.

## Objetivos

- **REQ-001 — Autenticação pós-cadastro:** após cadastro bem-sucedido, o frontend deve obter e persistir token válido antes de navegar para a Home.
- **REQ-002 — Reuso do contrato de login:** a autenticação pós-cadastro deve preferencialmente chamar a mutation `login` existente com email e senha informados no cadastro.
- **REQ-003 — Preservar contrato de cadastro:** a mutation `createUserAccount` não deve ter seu contrato alterado para retornar token.
- **REQ-004 — Protocolos globais visíveis:** protocolos com `fk_conta_id = null` devem aparecer para todo usuário autenticado, junto com protocolos da(s) conta(s) autorizada(s).
- **REQ-005 — Protocolos tenant-scoped no backend:** o backend deve reduzir o risco de exposição cross-tenant em `protocolos`, não dependendo apenas do filtro enviado pelo cliente.
- **REQ-006 — Soluções nutritivas preservadas:** soluções nutritivas devem continuar tenant-scoped por `solucoes_contas`, sem mudança de seed se os vínculos existentes estiverem corretos.
- **REQ-007 — Compatibilidade de UX:** o fluxo pós-cadastro deve manter o comportamento esperado de selecionar a conta recém-criada quando houver uma única conta.

## Não objetivos / Fora de escopo

- Alterar schema de banco para protocolos ou soluções nutritivas.
- Alterar contrato GraphQL de `createUserAccount`.
- Recriar seed de soluções nutritivas quando os vínculos `solucoes_contas` já existem e estão corretos.
- Implementar migração de dados para protocolos globais já existentes.
- Reestruturar autenticação do app Flutter além do fluxo pós-cadastro.
- Criar novo mecanismo de permissões ou roles para protocolos.
- Implementar código da aplicação nesta etapa de especificação.

## Requisitos rastreáveis

| ID | Requisito | Evidência esperada |
| --- | --- | --- |
| REQ-001 | Pós-cadastro persiste token antes da Home | `LocalStorage.getToken()` retorna token não vazio após cadastro e antes das queries da Home |
| REQ-002 | Pós-cadastro usa `login` existente | fluxo chama `login(email, senha)` ou serviço/repositório equivalente já existente |
| REQ-003 | `createUserAccount` permanece sem token | mutation de cadastro não adiciona campo `token` e clientes existentes seguem compatíveis |
| REQ-004 | Globais + conta autorizada aparecem | query de protocolos retorna `fk_conta_id = null` e `fk_conta_id` autorizado |
| REQ-005 | Backend protege cross-tenant | usuário autenticado não recebe protocolo privado de conta não vinculada mesmo se enviar filtro amplo/ausente |
| REQ-006 | Soluções nutritivas não mudam de escopo | `sNutritivas` continua usando `authUserId`/`solucoes_contas` |
| REQ-007 | Conta recém-criada selecionada | usuário com uma conta navega autenticado com `selected_conta` definida |

## Critérios de aceitação

- **AC-001:** Dado um cadastro válido, quando `createUserAccount` retornar sucesso, então o frontend executa autenticação real e persiste token antes de navegar para `Home`.
- **AC-002:** Dado falha no login pós-cadastro, então o frontend não deve entrar na Home como usuário autenticado sem token; deve expor erro ou redirecionar para login.
- **AC-003:** Dado usuário recém-cadastrado com conta única, quando entrar na Home, então consultas que dependem de token usam `Authorization`/token persistido.
- **AC-004:** Dado usuário autenticado em uma conta A, quando listar protocolos, então a resposta contém protocolos globais (`fk_conta_id = null`) e protocolos da conta A.
- **AC-005:** Dado usuário autenticado em uma conta A, quando tentar listar protocolos com filtro amplo ou filtro da conta B, então protocolos privados da conta B não são retornados.
- **AC-006:** Dado protocolo soft-deleted, quando listar protocolos, então ele não é retornado, seja global ou tenant-specific.
- **AC-007:** Dado soluções nutritivas vinculadas via `solucoes_contas`, quando usuário autenticado consulta `sNutritivas`, então só recebe soluções das contas autorizadas.
- **AC-008:** O contrato de `createUserAccount` permanece compatível com a seleção atual de campos do frontend.

## Validação esperada

- Frontend: teste manual ou automatizado do fluxo cadastro → login automático → Home, verificando token em `LocalStorage` e usuário/conta selecionados.
- Frontend: teste da query de protocolos com conta recém-criada, confirmando presença de protocolos globais.
- Backend: teste GraphQL autenticado para `protocolos` sem filtro, com filtro de conta autorizada e com filtro de conta não autorizada.
- Backend: teste GraphQL autenticado para `sNutritivas` confirmando que o escopo por `solucoes_contas` permanece inalterado.
- Regressão: confirmar que `reservatorios` seguem funcionando e que não foram usados como substituto de autenticação.

## Questões em aberto

- O fluxo pós-cadastro deve reutilizar diretamente `LoginStore.login()` ou extrair um método de autenticação por credenciais para evitar dependência de controllers de tela?
- Protocolos globais devem ser somente leitura para todos os usuários ou podem ser usados como base para edição/cópia? A especificação atual trata apenas de listagem/visibilidade.
- Query singular `protocolo(id)` deve retornar protocolo global e protocolo autorizado, mas deve retornar `null` ou erro para protocolo de outra conta?
- O frontend deve continuar filtrando protocolos por `OR: [{ conta.id = contaId }, { conta: null }]` ou passar a confiar no escopo backend e enviar filtro mínimo?
