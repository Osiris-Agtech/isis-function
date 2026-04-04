const { objectType } = require('@nexus/schema')

const Notificacao = objectType({
  name: 'Notificacao',
  definition(t) {
    t.model.id()
    t.model.key()
    t.model.valor()
    t.model.descricao()
  }
})

module.exports = Notificacao