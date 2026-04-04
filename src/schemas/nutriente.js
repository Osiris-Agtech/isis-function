const { objectType } = require('@nexus/schema')

const Nutriente = objectType({
  name: 'Nutriente',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.sigla()
    t.model.fertilizantes_nutrientes()
  }
})

module.exports = Nutriente