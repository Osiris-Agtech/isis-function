const { objectType } = require('@nexus/schema')

const LoginResponse = objectType({
  name: 'LoginResponse',
  definition(t) {
    t.nonNull.string('token')
    t.nonNull.field('usuario', {
      type: 'Usuario'
    })
  }
})

module.exports = LoginResponse
