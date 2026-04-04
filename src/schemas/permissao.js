const { objectType } = require('@nexus/schema')

const Permissao = objectType({
  name: 'Permissao',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.created_at()
    t.model.cargos_permissoes()
  }
})

module.exports = Permissao