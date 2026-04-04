const { objectType } = require('@nexus/schema')

const Cargo = objectType({
  name: 'Cargo',
  definition(t) {
    t.model.id()
    t.model.cargo()
    t.model.permissoes()
    t.model.usuarios()
  }
})

module.exports = Cargo