# Conventions

## Linguagem e Estilo
- **JavaScript** (sem TypeScript no código-fonte)
- Sem configuração de linter ou formatter
- Mix de `async/await` e callbacks (especialmente no nodemailer)

## Nomenclatura

### Arquivos
- Entidades: `lowercase` sem separador (ex: `usuario.js`, `snutritiva.js`)
- Compostos: `underscore` para junction tables (ex: `usuarios_contas_cargos.js`)

### GraphQL Types
- PascalCase para tipos: `Usuario`, `Conta`, `SNutritiva`
- camelCase para queries/mutations: `homeDashboard`, `softDeleteLote`
- Plurais em português (às vezes inconsistente): `localizacaos` em vez de `localizacoes`

### Campos de Banco
- snake_case no banco: `deleted_at`, `fase_dias`, `semeadura_data`
- O nexus-plugin-prisma mapeia automaticamente para camelCase no GraphQL

## Padrão de Type Definition (Nexus)

```js
// src/schemas/<entity>.js
import { objectType } from '@nexus/schema'

export const NomeEntidade = objectType({
  name: 'NomeEntidade',
  definition(t) {
    t.model.id()
    t.model.campo()
    // ... campos do model Prisma
    t.model.relacao()
  }
})
```

## Padrão de Query/Mutation

```js
// src/schemas/query.js ou mutation.js
t.field('nomeDaOperacao', {
  type: 'TipoRetorno',
  args: { contaId: nonNull(intArg()) },
  resolve: async (_, { contaId }, ctx) => {
    return ctx.prisma.entidade.findMany({
      where: { contaId, deleted_at: null }
    })
  }
})
```

## Context
- Único objeto de contexto: `{ prisma }`
- Sem autenticação no contexto (JWT não verificado)
- Sem user session no contexto

## Soft Delete
- Campo `deleted_at` (DateTime, nullable)
- Filtragem manual com `where: { deleted_at: null }` nas queries customizadas
- CRUD automático do Nexus **não aplica** esse filtro automaticamente

## CRUD Automático vs Custom
- `t.crud.<entidade>()` — delega para o nexus-plugin-prisma (filtros e ordenação automáticos)
- `t.field()` com `resolve` manual — para lógica customizada
- Mistura dos dois padrões no mesmo arquivo
