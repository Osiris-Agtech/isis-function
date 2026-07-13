# Decisão — Cargo dono canônico como `Dono`

## O que foi decidido

O valor persistido canônico para o cargo dono da conta é `Dono`. Fluxos de onboarding que criam ou vinculam o usuário dono da nova conta devem usar semanticamente `Dono`.

## Por que

A documentação de descadastro de usuário/conta já usa `Dono`, e a decisão do usuário padroniza esse termo como representação de domínio. A spec de onboarding transacional deve refletir a mesma semântica para evitar divergência entre fluxos que dependem do cargo dono.

## O que foi descartado

- Usar `Owner` como nome de cargo persistido ou valor semântico canônico.
- Manter a spec de onboarding transacional com nomenclatura diferente da spec de descadastro.
