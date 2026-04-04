const { objectType } = require('@nexus/schema')

const Area = objectType({
  name: 'Area',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.descricao()
    t.model.imagem()
    t.model.tipo()
    t.model.created_at()
    t.model.conta()
    t.model.localizacao()
    // t.model.setores()
    // Personalizando o resolver para o campo 'setores'
    t.list.field('setores', {
      type: 'Setor',
      resolve: async (parent, args, context) => {
        // Obtendo os setores relacionados à área
        const setores = await context.prisma.area
          .findUnique({ where: { id: parent.id } })
          .setores();

        // Filtrando os setores para incluir apenas aqueles com 'deleted_at' nulo
        const setoresFiltrados = setores.filter(setor => setor.deleted_at === null);

        return setoresFiltrados;
      },
    });
    t.model.deleted_at()
  }
})

module.exports = Area