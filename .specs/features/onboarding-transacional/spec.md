# Spec — Onboarding transacional com culturas iniciais

## Contexto

As mutations GraphQL `createUserAccount` e `inviteContributor` no ramo de novo usuário executam o onboarding criando múltiplos registros relacionados: localização opcional, pessoa, conta, culturas iniciais, usuário, vínculos `ConectaConta`, soluções nutritivas, área, reservatórios e setores. Atualmente essas criações são feitas como operações independentes no Prisma. Se uma etapa intermediária falhar, parte dos dados pode permanecer persistida, gerando contas incompletas, usuários sem todos os vínculos ou dados iniciais inconsistentes.

O onboarding também já deve manter as culturas iniciais `Alface Crespa` e `Rúcula`, necessárias para que a nova conta tenha culturas disponíveis para lotes, protocolos e relatórios desde o primeiro acesso.

Esta especificação transforma o bloco de criação de dados iniciais em uma operação transacional, preservando o contrato GraphQL atual e mantendo o envio/agendamento de e-mail fora da transação.

---

## Goals e non-goals

### Goals

- **REQ-001 — Atomicidade do onboarding:** criar todos os dados iniciais de `createUserAccount` em uma única transação de banco.
- **REQ-002 — Atomicidade do novo usuário convidado:** criar todos os dados iniciais do ramo de novo usuário de `inviteContributor` em uma única transação de banco.
- **REQ-003 — Rollback completo em falha de banco:** se qualquer escrita ou leitura necessária dentro do onboarding transacional falhar, nenhum dado parcial criado pela operação deve permanecer persistido.
- **REQ-004 — Culturas iniciais preservadas:** manter a criação de `Cultura` com nomes exatamente `Alface Crespa` e `Rúcula`, vinculadas à nova conta.
- **REQ-005 — Contrato GraphQL inalterado:** preservar nomes, argumentos, tipos de retorno e formato de resposta das mutations `createUserAccount` e `inviteContributor`.
- **REQ-006 — E-mail fora da transação:** envio ou enfileiramento de e-mail deve ocorrer somente após commit bem-sucedido da transação e não deve manter a transação aberta.
- **REQ-007 — Escopo mínimo:** alterar apenas o fluxo de persistência do onboarding; manter os dados seedados e nomes atuais dos itens iniciais.
- **REQ-008 — Cargo dono canônico:** usar `Dono` como valor semântico e persistido canônico do cargo dono da conta; `Owner` não deve ser criado nem usado pelo onboarding.

### Non-goals

- Não alterar schema do banco, migrations Prisma ou modelos existentes.
- Não alterar contrato GraphQL, criar nova mutation/query ou adicionar campos de retorno.
- Não criar culturas retroativamente para contas existentes.
- Não alterar o seed base (`prisma/seed.js`) ou templates de soluções nutritivas.
- Não redesenhar permissões, autenticação, seleção de conta ou fluxo de login pós-cadastro.
- Não fazer refatoração ampla do arquivo de mutations além do necessário para delimitar a transação.
- Não tornar envio de e-mail transacional; efeitos externos não devem participar da transação de banco.

---

## Abordagem técnica e decisões de design

### Boundary transacional

Usar uma transação Prisma para encapsular todas as operações de banco que compõem a criação de dados iniciais do onboarding.

#### `createUserAccount`

Devem ficar dentro da transação:

1. criação de `localizacao`, quando houver dados de localização;
2. criação de `pessoa`;
3. criação de `conta`;
4. criação das culturas `Alface Crespa` e `Rúcula` vinculadas à nova conta;
5. criação de `usuario`;
6. busca/criação do cargo `Dono`, se o fluxo atual precisar garantir sua existência;
7. criação de `ConectaConta` da nova conta com o usuário como `Dono`;
8. criação das soluções nutritivas iniciais e vínculos com fertilizantes/conta;
9. criação de área, reservatórios e setores iniciais.

Operações não relacionadas a banco, como hash de senha, podem ocorrer antes da transação ou dentro dela apenas se não introduzirem I/O externo. A decisão recomendada é calcular o hash antes de abrir a transação para reduzir tempo de lock.

#### `inviteContributor` — ramo de novo usuário

Devem ficar dentro da transação apenas quando `buscarUsuario.length === 0`:

1. criação de `pessoa`;
2. criação da nova `conta` própria do usuário convidado;
3. criação das culturas `Alface Crespa` e `Rúcula` vinculadas à nova conta;
4. criação de `usuario` com senha temporária já hasheada;
5. criação do vínculo `ConectaConta` com a conta que enviou o convite (`args.contaId`) e `args.cargoId`;
6. busca/criação do cargo `Dono`, se necessário;
7. criação do vínculo `ConectaConta` da nova conta própria com cargo `Dono`;
8. criação das soluções nutritivas iniciais da nova conta;
9. criação de área, reservatórios e setores iniciais da nova conta;
10. leituras necessárias para montar o retorno e o payload de e-mail, quando dependerem de dados consistentes da operação.

Os ramos de `inviteContributor` para usuário já existente não fazem parte do onboarding inicial de nova conta e não precisam ser redesenhados nesta spec, exceto para preservar o comportamento atual e manter e-mail fora da transação quando aplicável.

### Cliente Prisma transacional

Todas as operações dentro do boundary devem usar o cliente transacional recebido pela callback (`tx`) ou abstração equivalente. Não deve haver mistura de `prisma` global com `tx` dentro do mesmo bloco transacional, para evitar escritas fora da transação por engano.

### E-mail fora da transação

O envio ou enfileiramento de e-mail deve ocorrer depois que a transação retornar com sucesso:

- em `createUserAccount`, caso exista ou venha a existir notificação externa, ela deve ser disparada somente após commit;
- em `inviteContributor`, `enqueueInviteEmailDispatch` deve continuar fora do bloco transacional;
- falha no envio/enfileiramento de e-mail após commit não deve fazer rollback dos dados de onboarding já persistidos;
- a transação não deve aguardar SMTP, fila externa ou qualquer recurso externo não-DB.

### Comportamento de rollback

Em falha dentro da transação:

- nenhum `pessoa`, `localizacao`, `conta`, `cultura`, `usuario`, `ConectaConta`, `sNutritiva`, `area`, `reservatorio` ou `setor` criado pela tentativa deve permanecer no banco;
- a mutation deve propagar erro conforme o padrão atual do resolver;
- nenhum e-mail deve ser enviado ou enfileirado para uma tentativa que sofreu rollback;
- não deve ser necessário executar compensação manual para recursos criados dentro da transação.

No ramo de novo usuário de `inviteContributor`, o mecanismo atual de compensação manual deve ser removido ou tornado desnecessário para recursos cobertos pela transação. Se permanecer por compatibilidade temporária, não deve tentar apagar dados que já foram revertidos pela transação nem mascarar o erro original.

### Culturas iniciais

As culturas iniciais fazem parte do conjunto atômico de onboarding:

| Campo | Valor esperado |
| --- | --- |
| `nome` | `Alface Crespa` |
| `fk_contas_id` / `conta.connect.id` | id da nova conta |
| `privado` | default do schema, atualmente `true`, salvo se o modelo exigir preenchimento explícito |

| Campo | Valor esperado |
| --- | --- |
| `nome` | `Rúcula` |
| `fk_contas_id` / `conta.connect.id` | id da nova conta |
| `privado` | default do schema, atualmente `true`, salvo se o modelo exigir preenchimento explícito |

### Decisões de design

- A transação deve cobrir apenas persistência em banco porque Prisma consegue garantir atomicidade nesse boundary; SMTP/fila/e-mail são efeitos externos e não são reversíveis pelo banco.
- O contrato GraphQL permanece inalterado para evitar breaking change em clientes existentes.
- `Alface Crespa` e `Rúcula` permanecem como dados iniciais da nova conta e devem ser revertidas junto com os demais dados em caso de falha.
- O cargo dono da conta deve ser tratado semanticamente como `Dono`, alinhando onboarding ao valor canônico persistido esperado pelo domínio.
- A implementação deve evitar uma refatoração arquitetural ampla nesta etapa; extração posterior de um serviço de onboarding pode ser considerada, mas não é requisito desta spec.

---

## Data structures e interfaces envolvidas

### Mutations GraphQL preservadas

#### `createUserAccount`

- Nome da mutation: `createUserAccount`.
- Argumentos: permanecem os mesmos já definidos no schema atual.
- Tipo de retorno: `Usuario`.
- Campos retornáveis: permanecem compatíveis com a seleção atual do cliente.

#### `inviteContributor`

- Nome da mutation: `inviteContributor`.
- Argumentos: `nome`, `sobrenome`, `email`, `cargoId`, `contaId` permanecem inalterados.
- Tipo de retorno: `Usuario`.
- Comportamento dos ramos de usuário existente permanece compatível.

### Modelos Prisma tocados pelo onboarding

- `Localizacao` — opcional em `createUserAccount`.
- `Pessoa` — identidade civil do usuário.
- `Conta` — conta criada no onboarding.
- `Cultura` — culturas iniciais `Alface Crespa` e `Rúcula`.
- `Usuario` — credenciais e vínculo com pessoa.
- `Cargo` — garantia de cargo `Dono` quando ausente.
- `ConectaConta` — vínculos usuário-conta-cargo.
- `SNutritiva` e relações de soluções/fertilizantes/contas — soluções iniciais.
- `Area`, `Reservatorio`, `Setor` — estrutura inicial da conta.

### Interface interna esperada

A implementação pode permanecer no resolver ou extrair funções internas, desde que respeite:

```text
executarOnboarding(tx, dados) -> dados necessários para retorno GraphQL e payload de e-mail
```

Essa interface é conceitual, não obrigatória. Se houver extração, ela deve receber cliente transacional e nunca instanciar/acessar cliente Prisma global para operações do onboarding.

---

## Critérios de aceite

- **AC-001:** Dado cadastro válido via `createUserAccount`, quando a mutation concluir com sucesso, então a nova conta possui todos os dados iniciais esperados, incluindo `Alface Crespa` e `Rúcula`.
- **AC-002:** Dado falha em qualquer etapa de banco de `createUserAccount` após iniciar a criação, quando a mutation falhar, então não existe resíduo parcial de nova localização, pessoa, conta, culturas, usuário, vínculos, soluções, área, reservatórios ou setores da tentativa.
- **AC-003:** Dado convite para e-mail sem usuário existente, quando `inviteContributor` concluir com sucesso, então o usuário convidado possui vínculo com a conta convidante e uma nova conta própria com culturas `Alface Crespa` e `Rúcula`.
- **AC-004:** Dado falha em qualquer etapa de banco do ramo novo usuário de `inviteContributor`, quando a mutation falhar, então não existe resíduo parcial dos registros criados para a tentativa.
- **AC-005:** Dado falha transacional em `inviteContributor`, então nenhum e-mail de convite é enviado ou enfileirado para a tentativa com rollback.
- **AC-006:** Dado commit bem-sucedido em `inviteContributor`, então o e-mail é enviado/enfileirado fora da transação; se o e-mail falhar depois do commit, os dados persistidos não sofrem rollback.
- **AC-007:** O contrato GraphQL de `createUserAccount` e `inviteContributor` permanece inalterado em introspection/schema gerado e nas chamadas existentes do cliente.
- **AC-008:** O ramo de `inviteContributor` para usuário já existente continua sem criar nova conta, culturas ou dados iniciais.
- **AC-009:** A implementação não usa `prisma` global para escritas de onboarding dentro de uma transação que deveria usar `tx`.
- **AC-010:** Dado cadastro ou convite que crie uma nova conta própria, quando o vínculo dono for persistido, então o cargo usado é `Dono` e nenhum cargo/vínculo `Owner` é criado pelo onboarding.

---

## Validação manual

1. Executar cadastro real via fluxo cliente ou GraphQL para `createUserAccount`.
   - Verificar no banco que há uma nova `Conta`, `Usuario`, vínculo `ConectaConta`, soluções iniciais, área/reservatórios/setores e culturas `Alface Crespa` e `Rúcula` vinculadas à nova conta.
2. Executar `inviteContributor` com e-mail ainda inexistente.
   - Verificar que o usuário foi criado, vinculado à conta convidante e à nova conta própria, e que a nova conta própria recebeu `Alface Crespa` e `Rúcula`.
3. Executar `inviteContributor` com e-mail já existente.
   - Verificar que nenhuma nova cultura ou conta própria é criada por esse ramo, preservando o comportamento atual.
4. Simular falha dentro do onboarding após a criação da conta, por exemplo usando ambiente de desenvolvimento com dado/template obrigatório ausente ou erro controlado temporário.
   - Verificar que não há registros órfãos/parciais da tentativa.
   - Verificar que e-mail não foi enviado/enfileirado quando a transação sofreu rollback.
5. Simular falha de e-mail/enfileiramento após commit em `inviteContributor`.
   - Verificar que os dados permanecem persistidos e que a falha é tratada conforme o padrão atual de infraestrutura/notificação.
6. Comparar o schema GraphQL antes/depois ou executar chamadas existentes dos clientes.
   - Verificar que argumentos, nome da mutation e tipo de retorno não mudaram.

---

## Riscos

- `src/schemas/mutation.js` concentra muitas responsabilidades e é um arquivo grande; há risco de aumentar acoplamento se a transação for adicionada sem separar claramente o bloco de onboarding.
- Transações longas podem segurar locks por mais tempo. Hash de senha e preparação de payload de e-mail devem ocorrer fora da transação quando possível.
- Misturar cliente Prisma global e cliente transacional dentro do mesmo fluxo pode quebrar a atomicidade esperada.
- Falhas de e-mail após commit passam a ser explicitamente não reversíveis; o usuário pode existir sem receber e-mail, exigindo reenvio ou suporte operacional.
- A criação condicional do cargo `Dono` dentro da transação pode sofrer corrida se múltiplos cadastros ocorrerem quando o cargo não existe; a implementação deve tratar erro de unicidade ou preferir bootstrap pré-existente.
- Testar rollback manualmente pode exigir injeção controlada de falha em ambiente de desenvolvimento; isso não deve ser levado para produção.

---

## Questões em aberto

- A implementação deve extrair um helper interno de onboarding para reduzir duplicação entre `createUserAccount` e `inviteContributor`, ou manter mudanças locais no resolver para minimizar escopo?
- Em caso de falha de e-mail após commit no `inviteContributor`, o comportamento atual de notificação/log é suficiente ou deve haver uma rotina explícita de reenvio?
- A garantia/criação do cargo `Dono` deve permanecer no onboarding ou deve ser tratada exclusivamente como dado obrigatório de seed/bootstrap?
- A validação automatizada será adicionada posteriormente ou a primeira entrega aceitará apenas validação manual e inspeção de banco?
