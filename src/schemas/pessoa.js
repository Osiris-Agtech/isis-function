const { objectType } = require('@nexus/schema')

const Pessoa = objectType({
  name: 'Pessoa',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.sobrenome()
    t.model.telefone()
    t.model.imagem()
    t.model.created_at()
    t.model.localizacao()
  }
})

module.exports = Pessoa