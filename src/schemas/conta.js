const { objectType } = require('@nexus/schema')

const Conta = objectType({
  name: 'Conta',
  definition(t) {
    t.model.id()
    t.model.nivel()
    t.model.nome()
    t.model.imagem()
    t.model.cnpj()
    t.model.created_at()
    t.model.agendas()
    t.model.areas()
    t.model.atividades()
    t.model.culturas()
    t.model.fases()
    t.model.lotes_atividades()
    t.model.protocolos()
    t.model.reservatorios()
    t.model.solucoes()
    t.model.usuarios()
    t.model.localizacoes()
    t.model.deleted_at()
  }
})

module.exports = Conta