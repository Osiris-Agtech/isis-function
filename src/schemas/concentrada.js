const { objectType } = require('@nexus/schema')

const Concentrada = objectType({
  name: 'Concentrada',
  definition(t) {
    t.model.id()
    t.model.volume()
    t.model.nome()
    t.model.fator_concentracao()
    t.model.created_at()
    t.model.solucoes_fertilizantes_concentradas()
  }
})

module.exports = Concentrada