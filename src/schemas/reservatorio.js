const { objectType } = require('@nexus/schema')

const Reservatorio = objectType({
  name: 'Reservatorio',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.volume()
    t.model.created_at()
    t.model.conta()
    t.model.solucao()
    t.model.lotes()
    t.model.setores()
    t.model.deleted_at()
  }
})

module.exports = Reservatorio