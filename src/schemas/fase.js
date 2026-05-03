const { objectType } = require('@nexus/schema')

const Fase = objectType({
  name: 'Fase',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.descricao()
    t.model.duracao_dias()
    t.model.created_at()
    t.model.updated_at()
    t.model.deleted_at()
    t.model.conta()
    t.model.acaos()
  }
})

module.exports = Fase
