const { objectType } = require('@nexus/schema')

const Protocolo = objectType({
  name: 'Protocolo',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.descricao()
    t.model.tipo_cultura()
    t.model.sistema_cultivo()
    t.model.implantacao()
    t.model.created_at()
    t.model.updated_at()
    t.model.deleted_at()
    t.model.conta()
    t.model.cultura()
    t.model.acoes()
    t.model.lotes()
  }
})

module.exports = Protocolo