const { objectType } = require('@nexus/schema')

const Fertilizante = objectType({
  name: 'Fertilizante',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.c_eletrica()
    t.model.compatibilidade()
    t.model.solubilidade()
    t.model.created_at()
    t.model.fertilizantes_nutrientes()
    t.model.solucoes_fertilizantes_concentradas()
  }
})

module.exports = Fertilizante