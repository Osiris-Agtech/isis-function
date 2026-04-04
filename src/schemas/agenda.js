const { objectType } = require('@nexus/schema')

const Agenda = objectType({
  name: 'Agenda',
  definition(t) {
    t.model.id()
    t.model.titulo()
    t.model.descricao()
    t.model.alerta()
    t.model.ativo()
    t.model.finalizado()
    t.model.data()
    t.model.created_at()
    t.model.updated_at()
    t.model.deleted_at()
    t.model.conta()
    t.model.lote()
    t.model.usuario()
  }
})

module.exports = Agenda