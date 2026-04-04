const { objectType } = require('@nexus/schema')

const Fertilizantes_Nutrientes = objectType({
  name: 'Fertilizantes_Nutrientes',
  definition(t) {
    t.model.id()
    t.model.teor_nutriente()
    t.model.fertilizante()
    t.model.nutriente()
  }
})

module.exports = Fertilizantes_Nutrientes