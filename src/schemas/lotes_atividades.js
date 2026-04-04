const { objectType } = require('@nexus/schema')

const Lotes_Atividades = objectType({
  name: 'Lotes_Atividades',
  definition(t) {
    t.model.id()
    t.model.atividade()
    t.model.conta()
    t.model.lote()
    t.model.usuario()
  }
})

module.exports = Lotes_Atividades