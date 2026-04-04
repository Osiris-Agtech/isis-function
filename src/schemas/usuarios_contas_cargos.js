const { objectType } = require('@nexus/schema')

const ConectaConta = objectType({
  name: 'ConectaConta',
  definition(t) {
    t.model.id()
    t.model.cargo()
    t.model.conta()
    t.model.usuario()
  }
})

module.exports = ConectaConta