# Spec — Descadastro de usuário por conta (Backend `isis`)

## Contexto

Hoje não existe, no backend `isis`, uma operação explícita para **descadastrar um usuário de uma conta específica**.  
Há `updateUsuario`, porém essa operação é de manutenção do usuário e **não representa** a remoção de vínculo com conta.  
O vínculo entre usuário e conta é modelado por `ConectaConta`, e `Usuario` não possui `deleted_at`, reforçando a distinção entre:

- **Descadastrar da conta**: remover vínculo em `ConectaConta` (escopo da feature).
- **Inativar usuário global**: status/remoção do usuário no sistema inteiro (fora de escopo).

A direção recomendada é criar uma **mutation dedicada** para remover vínculo usuário-conta, sem uso de transaction.

---

## Goals / Non-Goals

### Goals
1. Disponibilizar mutation dedicada para remover vínculo `Usuario` ↔ `Conta`.
2. Garantir semântica explícita de descadastro por conta (sem afetar usuário global).
3. Preservar consistência de regras de negócio (incluindo proteção para “último Dono”, se aplicável).
4. Entregar comportamento idempotente e previsível para vínculos inexistentes.
5. Implementar sem alteração de schema e sem transaction.

### Non-Goals
1. Não implementar inativação/exclusão global de `Usuario`.
2. Não alterar schema de banco (colunas/tabelas/constraints), exceto como alternativa futura documentada.
3. Não refatorar `updateUsuario` para absorver esse comportamento.
4. Não introduzir fluxos de auditoria complexos fora do necessário para rastreabilidade básica.

---

## Escopo funcional

1. Expor mutation específica (ex.: `descadastrarUsuarioDaConta`) no backend.
2. Entrada mínima: identificador da conta + identificador do usuário-alvo.
3. Validar existência do vínculo em `ConectaConta`.
4. Remover vínculo quando existir e permitido pelas regras de negócio.
5. Tratar casos:
   - usuário com múltiplas contas;
   - usuário com conta única;
   - vínculo inexistente;
   - tentativa de remover último Dono (dependente de decisão de negócio).
6. Retornar resultado explícito para consumo do frontend (sucesso, não encontrado, bloqueio por regra).

---

## Abordagem técnica

### Decisão principal
- Criar **mutation dedicada** para descadastro por conta, operando diretamente sobre `ConectaConta`.
- **Não usar transaction** (restrição obrigatória).

### Implicações da decisão de não usar transaction
Sem transaction, leituras e escrita podem sofrer concorrência entre validação e remoção (TOCTOU), especialmente na regra de “último Dono”.

#### Mitigações
1. **Operação de remoção atômica no vínculo** (delete por chave do vínculo), com checagem de linhas afetadas.
2. **Pré-validação objetiva e curta** (existência do vínculo e regra de papel).
3. **Erros de regra explícitos** para permitir reação do cliente (ex.: recarregar estado).
4. **Idempotência funcional** para vínculo inexistente (retorno estável).
5. Se regra “último Dono” for mandatória e não houver garantia forte sem transação, registrar limitação conhecida e orientar fallback de negócio.

### Fluxo resumido
1. Autoriza caller para gestão de usuários da conta.
2. Busca vínculo usuário-conta.
3. Se inexistente, responde conforme contrato (idempotente ou erro de domínio acordado).
4. Se existir, aplica validações de regra (inclui “último Dono”, conforme decisão).
5. Remove vínculo.
6. Retorna payload com status final e metadados mínimos.

---

## Estruturas/interfaces

> Nomes ilustrativos; alinhar com convenções GraphQL existentes no `isis`.

### Mutation (conceitual)
- `descadastrarUsuarioDaConta(input): DescadastroUsuarioContaPayload`

### Input (conceitual)
- `contaId`
- `usuarioId`

### Payload (conceitual)
- `status`: `REMOVIDO | VINCULO_INEXISTENTE | BLOQUEADO_REGRA_NEGOCIO`
- `mensagem` (opcional, semântico para UI)
- `usuarioId`
- `contaId`

### Erros de domínio (conceitual)
- `PERMISSAO_NEGADA`
- `USUARIO_NAO_ENCONTRADO` (se aplicável ao contrato)
- `CONTA_NAO_ENCONTRADA` (se aplicável)
- `ULTIMO_DONO_NAO_PODE_SER_REMOVIDO` (condicional à regra)

---

## Critérios de aceite (WHEN / THEN)

1. **Usuário com múltiplas contas**
   - **WHEN** o usuário possui vínculo com mais de uma conta e é descadastrado de uma conta específica  
   - **THEN** apenas o vínculo da conta alvo é removido e os demais vínculos permanecem intactos.

2. **Usuário com conta única**
   - **WHEN** o usuário possui apenas um vínculo de conta e ocorre descadastro dessa conta  
   - **THEN** o vínculo é removido e o registro global de `Usuario` permanece ativo/inalterado.

3. **Vínculo inexistente**
   - **WHEN** a mutation é chamada para par usuário-conta sem vínculo em `ConectaConta`  
   - **THEN** a resposta segue contrato idempotente definido (`VINCULO_INEXISTENTE` ou equivalente), sem efeitos colaterais.

4. **Tentativa de remover último Dono**
   - **WHEN** o usuário alvo é o último Dono da conta  
   - **THEN** a remoção é bloqueada com erro/status de regra de negócio, **se** esta política for confirmada.

5. **Sem transaction**
   - **WHEN** ocorrer concorrência no momento do descadastro  
   - **THEN** o sistema deve retornar resultado consistente ao contrato (sucesso, inexistente, bloqueio), sem corrupção de vínculo.

---

## Edge cases

1. Chamada repetida para mesmo vínculo (deve ser estável/idempotente).
2. Usuário já removido da conta entre leitura e escrita (concorrência).
3. Conta inválida ou fora de escopo de permissão do caller.
4. Papel do usuário alterado simultaneamente durante tentativa de remoção.
5. Regra de “último Dono” com dados desatualizados sem transação (necessita mensagem de erro clara e recomendação de retry/reload).

---

## Open questions

1. **Regra de negócio**: remover último Dono deve ser sempre proibido?
2. Em vínculo inexistente, o contrato desejado é sucesso idempotente ou erro de domínio?
3. Qual taxonomia de erro/status o frontend já espera para ações administrativas?
4. É necessário registrar trilha de auditoria formal (quem removeu, quando), além de logs operacionais?
5. Há cenários permitidos para auto-descadastro (usuário removendo a si mesmo)?

---

## Rastreabilidade

- Necessidade: descadastro por conta sem inativar usuário global.
- Evidências atuais:
  - ausência de mutation dedicada no `isis`;
  - presença de `updateUsuario` insuficiente para o caso;
  - vínculo modelado em `ConectaConta`;
  - inexistência de `deleted_at` em `Usuario`.
- Decisão arquitetural:
  - mutation dedicada;
  - sem transaction;
  - sem alteração de schema.

---

## Dependências / impacto

### Dependências
1. Camada GraphQL/resolver do `isis`.
2. Repositório/acesso a `ConectaConta`.
3. Política de autorização de gestão de usuários por conta.
4. Definição de regra de “último Dono” (negócio/produto).

### Impacto
1. Novo contrato de API consumido pelo frontend `osi-solucoes`.
2. Necessidade de alinhar mensagens/status para UX.
3. Sem impacto de migração de banco no escopo atual.

### Alternativa futura (fora do escopo atual)
- Caso o produto exija garantias transacionais fortes para regra de “último Dono”, avaliar:
  - mudança de estratégia de consistência (ex.: lock otimista/pessimista), ou
  - ajustes de schema/constraint para reforço de invariantes.
