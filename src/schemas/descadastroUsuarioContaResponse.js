const { objectType } = require('@nexus/schema')

const DescadastroUsuarioContaResponse = objectType({
  name: 'DescadastroUsuarioContaResponse',
  definition(t) {
    t.nonNull.string('status')
    t.string('mensagem')
    t.nonNull.int('usuarioId')
    t.nonNull.int('contaId')
  }
})

module.exports = DescadastroUsuarioContaResponse
