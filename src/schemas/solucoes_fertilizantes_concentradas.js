const { objectType } = require('@nexus/schema')

const Solucoes_Fertilizantes_Concentradas = objectType({
  name: 'Solucoes_Fertilizantes_Concentradas',
  definition(t) {
    t.model.id()
    t.model.concentrada()
    t.model.fertilizante()
    t.model.solucao()
    t.model.quantidade()
    t.model.deleted_at()
  }
})

module.exports = Solucoes_Fertilizantes_Concentradas