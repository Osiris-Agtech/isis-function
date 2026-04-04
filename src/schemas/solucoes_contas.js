const { objectType } = require('@nexus/schema')

const Solucoes_Contas = objectType({
  name: 'Solucoes_Contas',
  definition(t) {
    t.model.id()
    t.model.created_at()
    t.model.conta_original()
    t.model.conta()
    t.model.solucao()
  }
})

module.exports = Solucoes_Contas