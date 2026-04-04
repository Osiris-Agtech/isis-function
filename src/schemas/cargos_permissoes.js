const { objectType } = require('@nexus/schema')

const Cargos_Permissoes = objectType({
  name: 'Cargos_Permissoes',
  definition(t) {
    t.model.id()
    t.model.status()
    t.model.cargo()
    t.model.permissao()
  }
})

module.exports = Cargos_Permissoes