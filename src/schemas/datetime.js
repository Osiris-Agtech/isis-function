const { GraphQLScalarType } = require('graphql')

module.exports = {
    DateTime: new GraphQLScalarType({
        name: 'DateTime',
        description: 'String de data e hora no formato ISO-8601',
        serialize: (value) => value.toISOString(),
        parseValue: (value) => new Date(value),
        parseLiteral: (ast) => new Date(ast.value)
    }),
}