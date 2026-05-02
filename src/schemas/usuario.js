const { objectType } = require('@nexus/schema')

const Usuario = objectType({
  name: 'Usuario',
  definition(t) {
    t.model.id()
    t.model.created_at()
    t.model.email()
    t.model.ativo()
    t.model.nome()
    t.model.cod_acesso()
    t.model.acesso_externo()
    t.model.pessoa()
    t.model.agendas()
    t.model.logs()
    t.model.atividades()
    t.model.contas()
  }
})

module.exports = Usuario
