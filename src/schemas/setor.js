const { objectType } = require('@nexus/schema')

const Setor = objectType({
  name: 'Setor',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.descricao()
    t.model.created_at()
    t.model.area()
    t.model.reservatorio()
    // t.model.lotes()
    t.list.field('lotes', {
      type: 'Lote',
      resolve: async (parent, args, context) => {
        // Obtendo os setores relacionados à área
        const lotes = await context.prisma.setor
          .findUnique({ where: { id: parent.id } })
          .lotes();

        // Filtrando os lotes para incluir apenas aqueles com 'deleted_at' nulo
        const lotesFiltrados = lotes.filter(lote => lote.deleted_at === null);

        return lotesFiltrados;
      },
    });
    t.model.deleted_at()
  }
})

module.exports = Setor