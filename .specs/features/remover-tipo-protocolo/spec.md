# Spec: remover tipo do protocolo

## Objetivo

Remover o campo `tipo_cultura` do contrato GraphQL de `Protocolo` para que criacao, atualizacao e leitura de protocolo nao exponham mais esse atributo.

## Escopo

- Remover `tipo_cultura` do type `Protocolo` no schema Nexus.
- Remover `tipo_cultura` do parse e persistencia de `createProtocoloEstruturado` e `updateProtocolo`.
- Remover `tipo_cultura` dos inputs relacionados no schema gerado.

## Criterios de aceitacao

1. `Protocolo` nao possui `tipo_cultura` no schema.
2. `createProtocoloEstruturado` e `updateProtocolo` ignoram completamente `tipo_cultura`.
3. Nao existem referencias a `tipo_cultura` em `isis/src`.
