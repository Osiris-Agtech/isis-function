const { objectType } = require('@nexus/schema')

const Log = objectType({
  name: 'Log',
  definition(t) {
    t.model.id()
    t.model.data()
    t.model.descricao()
    t.model.usuario()
  }
})

module.exports = Log