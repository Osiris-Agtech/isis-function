const { objectType } = require('@nexus/schema')

const Localizacao = objectType({
  name: 'Localizacao',
  definition(t) {
    t.model.id()
    t.model.cep()
    t.model.endereco()
    t.model.bairro()
    t.model.cidade()
    t.model.numero()
    t.model.estado()
    t.model.pais()
    t.model.complemento()
    t.model.created_at()
    t.model.areas()
    t.model.pessoas()
    t.model.conta()
  }
})

module.exports = Localizacao