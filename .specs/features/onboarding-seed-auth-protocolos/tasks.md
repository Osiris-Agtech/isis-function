Agent: architect
Rules: AGENTS.md

# Tasks: Onboarding seed auth protocolos

## Contexto

Esta lista transforma a especificação em tarefas verificáveis para implementação futura. A tarefa atual é apenas escrever/refinar spec; não implementar código da aplicação.

## Objetivos e não objetivos

### Objetivos

- Corrigir fluxo pós-cadastro para persistir token via login real antes da Home.
- Exibir protocolos globais (`fk_conta_id = null`) e protocolos autorizados.
- Aplicar escopo backend para reduzir risco cross-tenant em protocolos.
- Manter soluções nutritivas escopadas por `solucoes_contas` sem alterar seed quando vínculos estiverem corretos.

### Não objetivos

- Alterar contrato de `createUserAccount`.
- Alterar schema de banco.
- Implementar edição/cópia de protocolos globais.

## Plano de execução

### Tarefa 1 — Mapear pontos exatos do fluxo de cadastro no frontend

- **Tipo:** frontend
- **Pode rodar em paralelo:** não, bloqueia Tarefa 2
- **Requisitos:** REQ-001, REQ-002, REQ-007
- **Arquivos prováveis:**
  - `osi-solucoes/lib/features/presenter/viewmodels/cadastro_store.dart`
  - `osi-solucoes/lib/features/data/datasources/cadastro/cadastro_datasource.dart`
- **Ação:** confirmar onde o cadastro navega para Home e onde `LocalStorage.storageUser` é chamado sem token.
- **Verificação:** evidência do ponto único de alteração do fluxo pós-cadastro.

### Tarefa 2 — Autenticar após cadastro usando login existente

- **Tipo:** frontend
- **Pode rodar em paralelo:** não, depende da Tarefa 1
- **Requisitos:** REQ-001, REQ-002, REQ-003, REQ-007
- **Arquivos prováveis:**
  - `osi-solucoes/lib/features/presenter/viewmodels/cadastro_store.dart`
  - `osi-solucoes/lib/features/data/repositories/login/login_repository.dart`
  - `osi-solucoes/lib/features/presenter/viewmodels/login_store.dart` se houver extração de lógica comum
- **Ação:** após `createUserAccount` bem-sucedido, chamar login com email/senha do cadastro; persistir token e usuário antes de navegar para Home.
- **Verificação:** cadastro válido resulta em token não vazio em `LocalStorage`; falha de login não navega para Home autenticada.

### Tarefa 3 — Ajustar query frontend de protocolos para incluir globais

- **Tipo:** frontend
- **Pode rodar em paralelo:** sim, após entendimento do contrato backend; pode avançar em paralelo com Tarefa 4 se o contrato for confirmado
- **Requisitos:** REQ-004
- **Arquivos prováveis:**
  - `osi-solucoes/lib/features/data/datasources/protocolo/protocolo_datasource.dart`
  - `osi-solucoes/lib/features/presenter/models/protocolo/protocolo_model.dart` se parsing de `conta` nula for necessário
- **Ação:** alterar filtro de `buscarProtocolos(contaId)` para incluir `fk_conta_id = null` além da conta atual, ou remover filtro de conta se backend assumir escopo completo.
- **Verificação:** usuário autenticado vê protocolos globais em lista/detalhe sem erro de parse.

### Tarefa 4 — Escopar `protocolos` no backend

- **Tipo:** backend
- **Pode rodar em paralelo:** sim, com Tarefa 3 após contrato definido
- **Requisitos:** REQ-004, REQ-005
- **Arquivos prováveis:**
  - `isis/src/schemas/query.js`
- **Ação:** substituir resolver genérico de `t.crud.protocolos` por resolver que injeta `deleted_at = null AND (fk_conta_id = null OR fk_conta_id IN authorizedContaIds)` usando `authUserId`.
- **Verificação:** filtros amplos ou maliciosos do cliente não retornam protocolos de contas não autorizadas.

### Tarefa 5 — Escopar `protocolo` singular no backend

- **Tipo:** backend
- **Pode rodar em paralelo:** sim, com Tarefa 4 se comportamento fora de escopo for decidido
- **Requisitos:** REQ-005
- **Arquivos prováveis:**
  - `isis/src/schemas/query.js`
- **Ação:** validar que `protocolo(id)` retorna apenas global ou conta autorizada, preservando `deleted_at = null`.
- **Verificação:** protocolo de outra conta não é retornado para usuário não autorizado.

### Tarefa 6 — Validar soluções nutritivas sem alterar seed

- **Tipo:** backend/frontend validação
- **Pode rodar em paralelo:** sim, após Tarefa 2 para cenário pós-cadastro autenticado
- **Requisitos:** REQ-006
- **Arquivos prováveis:**
  - `isis/src/schemas/query.js`
  - `isis/prisma/seed.js` apenas leitura/diagnóstico
- **Ação:** confirmar que `sNutritivas` depende de token/`authUserId` e vínculos `solucoes_contas`; não alterar seed se vínculos existem.
- **Verificação:** consultas retornam somente soluções de contas autorizadas; ausência de resultado deve ser diagnosticada como falta de vínculo, não bypass de escopo.

### Tarefa 7 — Testes e validação integrada

- **Tipo:** validação
- **Pode rodar em paralelo:** não, depende das tarefas de implementação
- **Requisitos:** todos
- **Ação:** executar validações existentes nos dois projetos e cenários manuais GraphQL/Flutter.
- **Verificação:** critérios AC-001 a AC-008 atendidos; registrar comandos executados e resultados.

## Critérios de aceitação rastreados

- AC-001/REQ-001: token persistido antes da Home após cadastro.
- AC-002/REQ-001: falha de login pós-cadastro bloqueia Home autenticada sem token.
- AC-003/REQ-007: conta única selecionada e usuário persistido com token.
- AC-004/REQ-004: protocolos globais aparecem para usuário autenticado.
- AC-005/REQ-005: protocolos de outra conta não aparecem mesmo com filtro amplo/indevido.
- AC-006/REQ-005: protocolos soft-deleted continuam ocultos.
- AC-007/REQ-006: soluções nutritivas permanecem tenant-scoped.
- AC-008/REQ-003: contrato `createUserAccount` não muda.

## Riscos

- Acoplamento indevido entre `CadastroStore` e `LoginStore`.
- Incompatibilidade de modelo/tela com protocolo sem conta.
- Resolver CRUD do Nexus combinar filtros de cliente de forma inesperada se escopo não for aplicado com `AND`.
- Decisão pendente sobre retorno de `protocolo(id)` fora de escopo.

## Questões em aberto

- Preferir extração de método de autenticação com credenciais ou uso direto de `LoginStore.login()`?
- `protocolo(id)` fora de escopo deve retornar `null` ou erro tipado?
- Protocolos globais devem ser sinalizados visualmente como templates/sistema?
