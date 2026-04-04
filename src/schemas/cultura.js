const { objectType } = require('@nexus/schema')

const Cultura = objectType({
  name: 'Cultura',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.privado()
    t.model.created_at()
    t.model.conta()
    t.model.lotes()
    t.model.deleted_at()
    t.model.protocolos()
  }
})

module.exports = Cultura