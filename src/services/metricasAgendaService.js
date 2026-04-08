/**
 * Service compartilhado para métricas de agenda
 * Usado por: homeDashboard, relatorioAgendaTarefas
 */

class MetricasAgendaService {
  constructor(prisma) {
    this.prisma = prisma
  }

  /**
   * Busca agendas de uma conta com filtros opcionais
   * @param {number} contaId - ID da conta
   * @param {Object} filtros - Filtros opcionais
   * @param {number[]} filtros.usuarioIds - IDs de usuários
   * @param {number[]} filtros.loteIds - IDs de lotes
   * @param {boolean} filtros.apenasComAlerta - Se true, apenas com alerta
   * @returns {Promise<Array>} Lista de agendas
   */
  async buscarAgendas(contaId, filtros = {}) {
    const { usuarioIds, loteIds, apenasComAlerta } = filtros

    const where = {
      conta: { id: contaId },
      deleted_at: null,
    }

    if (usuarioIds?.length) {
      where.fk_usuarios_id = { in: usuarioIds }
    }

    if (loteIds?.length) {
      where.fk_lote_id = { in: loteIds }
    }

    if (apenasComAlerta) {
      where.alerta = true
    }

    return this.prisma.agenda.findMany({
      where,
      include: {
        usuario: { select: { id: true, nome: true } },
        lote: {
          select: {
            id: true,
            nome: true,
            setor: { select: { nome: true } },
          },
        },
      },
    })
  }

  /**
   * Calcula tarefas vencidas (não finalizadas com data < now)
   * @param {Array} agendas - Lista de agendas
   * @returns {Array} Agendas vencidas
   */
  calcularTarefasVencidas(agendas) {
    const hoje = new Date()
    return agendas.filter(a => {
      if (a.finalizado) return false
      if (!a.data) return false
      return new Date(a.data) < hoje
    })
  }

  /**
   * Calcula tarefas a vencer em N dias
   * @param {Array} agendas - Lista de agendas
   * @param {number} dias - Número de dias à frente (padrão: 7)
   * @returns {Array} Agendas a vencer
   */
  calcularTarefasAVencer(agendas, dias = 7) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + dias)

    return agendas.filter(a => {
      if (a.finalizado) return false
      if (!a.data) return false
      const dataAgenda = new Date(a.data)
      return dataAgenda >= hoje && dataAgenda <= limite
    })
  }

  /**
   * Calcula taxa de conclusão por lote ativo
   * @param {number} contaId - ID da conta
   * @returns {Promise<Array>} Lista de lotes com taxas
   */
  async calcularTaxaConclusaoPorLote(contaId) {
    // Buscar lotes ativos (sem colheita)
    const lotesAtivos = await this.prisma.lote.findMany({
      where: {
        setor: { area: { conta: { id: contaId } } },
        colheita_data: null,
        deleted_at: null,
      },
      select: {
        id: true,
        nome: true,
        setor: { select: { nome: true } },
      },
    })

    const resultados = []

    for (const lote of lotesAtivos) {
      const total = await this.prisma.agenda.count({
        where: {
          fk_lote_id: lote.id,
          deleted_at: null,
        },
      })

      // Se não tem tarefas, ignora o lote
      if (total === 0) {
        continue
      }

      const concluidas = await this.prisma.agenda.count({
        where: {
          fk_lote_id: lote.id,
          finalizado: true,
          deleted_at: null,
        },
      })

      const hoje = new Date()
      const vencidas = await this.prisma.agenda.count({
        where: {
          fk_lote_id: lote.id,
          finalizado: false,
          deleted_at: null,
          data: { lt: hoje },
        },
      })

      resultados.push({
        loteId: lote.id,
        loteNome: lote.nome,
        setorNome: lote.setor?.nome,
        totalTarefas: total,
        tarefasConcluidas: concluidas,
        tarefasVencidas: vencidas,
        taxaConclusao: parseFloat(((concluidas / total) * 100).toFixed(2)),
      })
    }

    // Ordenar por tarefas vencidas descendente (mais crítico primeiro)
    resultados.sort((a, b) => b.tarefasVencidas - a.tarefasVencidas)

    return resultados
  }

  /**
   * Conta tarefas pendentes por período
   * @param {number} contaId - ID da conta
   * @param {Date} dataInicio - Data inicial
   * @param {Date} dataFim - Data final
   * @returns {Promise<Object>} Contagens de tarefas
   */
  async contarTarefasPendentes(contaId, dataInicio, dataFim) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    const semanaFim = new Date(hoje)
    semanaFim.setDate(semanaFim.getDate() + 7)

    const whereBase = {
      conta: { id: contaId },
      deleted_at: null,
      finalizado: false,
    }

    const [pendentesHoje, pendentesSemana, atrasadas] = await Promise.all([
      this.prisma.agenda.count({
        where: {
          ...whereBase,
          data: {
            gte: hoje,
            lt: amanha,
          },
        },
      }),
      this.prisma.agenda.count({
        where: {
          ...whereBase,
          data: {
            gte: hoje,
            lte: semanaFim,
          },
        },
      }),
      this.prisma.agenda.count({
        where: {
          ...whereBase,
          data: { lt: hoje },
        },
      }),
    ])

    return {
      pendentesHoje,
      pendentesSemana,
      atrasadas,
    }
  }

  /**
   * Calcula dias de atraso ou restantes
   * @param {string|Date} data - Data da tarefa
   * @returns {number} Dias (positivo = atrasado, negativo = dias restantes)
   */
  calcularDias(data) {
    if (!data) return 0
    const dataTarefa = data instanceof Date ? data : new Date(data)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return Math.floor((hoje - dataTarefa) / (1000 * 60 * 60 * 24))
  }

  /**
   * Calcula dias restantes até o prazo
   * @param {string|Date} data - Data da tarefa
   * @returns {number} Dias restantes (0 = hoje, negativo = atrasado)
   */
  calcularDiasRestantes(data) {
    if (!data) return 0
    const dataTarefa = data instanceof Date ? data : new Date(data)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return Math.ceil((dataTarefa - hoje) / (1000 * 60 * 60 * 24))
  }
}

module.exports = MetricasAgendaService
