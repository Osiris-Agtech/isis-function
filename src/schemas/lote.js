const { objectType } = require('@nexus/schema')

const Lote = objectType({
  name: 'Lote',
  definition(t) {
    t.model.id()
    t.model.nome()
    t.model.fase_dias()
    t.model.fase_data()
    t.model.registro_data()
    t.model.semeadura_data()
    t.model.transplantio_data()
    t.model.colheita_data()
    t.model.proxima_fase()
    t.model.ativo()
    t.model.bandeijas_semeadas()
    t.model.mudas_transplantadas()
    t.model.plantas_colhidas()
    t.model.embalagens_produzidas()
    t.model.cultura()
    t.model.protocolo()
    // t.model.agendas()
    t.list.field('agendas', {
      type: 'Agenda',
      resolve: async (parent, args, context) => {
        // Obtendo as agendas relacionadas a lote
        const agendaList = await context.prisma.lote
          .findUnique({ where: { id: parent.id } })
          .agendas();

        // Filtrando os agendas para incluir apenas aqueles com 'deleted_at' nulo
        const agendasFiltradas = agendaList.filter(agenda => agenda.deleted_at === null);

        return agendasFiltradas;
      },
    });
    t.model.reservatorio()
    t.model.setor()
    t.model.lotes_atividades()
    t.model.deleted_at()
  }
})

module.exports = Lote