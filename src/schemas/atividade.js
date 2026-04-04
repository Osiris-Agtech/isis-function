const { objectType } = require('@nexus/schema')

const Atividade = objectType({
  name: 'Atividade',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.descricao()
    t.model.privado()
    t.model.created_at()
    t.model.conta()
    t.model.lotes_atividades()
  }
})

module.exports = Atividade