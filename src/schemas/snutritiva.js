const { objectType } = require('@nexus/schema')

const SNutritiva = objectType({
  name: 'SNutritiva',
  definition(t) {
    t.model.id()
    t.model.c_eletrica()
    t.model.created_at()
    t.model.nome()
    t.model.reservatorios()
    t.model.solucoes_contas()
    t.model.solucoes_fertilizantes_concentradas()
    t.model.deleted_at()
  }
})

module.exports = SNutritiva