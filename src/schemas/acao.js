const { objectType } = require('@nexus/schema')

const Acao = objectType({
  name: 'Acao',
  definition(t) {
    t.model.id()
    t.model.titulo()
    t.model.descricao()
    t.model.alerta()
    t.model.duracao_dias()
    t.model.duracao_dias_real()
    t.model.created_at()
    t.model.updated_at()
    t.model.deleted_at()
    t.model.fase()
    t.model.protocolo()
  }
})

module.exports = Acao