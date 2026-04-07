/**
 * Service compartilhado para métricas de lotes
 * Usado por: homeDashboard, relatorioCicloCultura, relatorioProdutividadeSetor
 */

class MetricasLotesService {
  constructor(prisma) {
    this.prisma = prisma
  }

  /**
   * Busca lotes de uma conta com filtros opcionais
   * @param {number} contaId - ID da conta
   * @param {Object} filtros - Filtros opcionais
   * @param {string} filtros.dataInicio - Data inicial (ISO string)
   * @param {string} filtros.dataFim - Data final (ISO string)
   * @param {number[]} filtros.culturaIds - IDs de culturas
   * @param {number[]} filtros.setorIds - IDs de setores
   * @param {number[]} filtros.areaIds - IDs de áreas
   * @param {boolean} filtros.apenasFinalizados - Se true, apenas lotes com colheita
   * @returns {Promise<Array>} Lista de lotes
   */
  async buscarLotes(contaId, filtros = {}) {
    const { dataInicio, dataFim, culturaIds, setorIds, areaIds, apenasFinalizados = true } = filtros

    // Buscar áreas da conta
    const areasWhere = {
      conta: { id: contaId },
      deleted_at: null,
    }
    if (areaIds?.length) {
      areasWhere.id = { in: areaIds }
    }

    const areas = await this.prisma.area.findMany({
      where: areasWhere,
      select: { id: true },
    })
    const areaIdsList = areas.map(a => a.id)

    if (areaIdsList.length === 0) {
      return []
    }

    // Buscar setores das áreas
    const setoresWhere = {
      area: { id: { in: areaIdsList } },
      deleted_at: null,
    }
    if (setorIds?.length) {
      setoresWhere.id = { in: setorIds }
    }

    const setores = await this.prisma.setor.findMany({
      where: setoresWhere,
      select: { id: true },
    })
    const setorIdsList = setores.map(s => s.id)

    if (setorIdsList.length === 0) {
      return []
    }

    // Montar where para lotes
    const where = {
      setor: { id: { in: setorIdsList } },
      deleted_at: null,
    }

    if (culturaIds?.length) {
      where.fk_culturas_id = { in: culturaIds }
    }

    if (apenasFinalizados) {
      where.colheita_data = { not: null }
      if (dataInicio || dataFim) {
        where.colheita_data = {}
        if (dataInicio) {
          where.colheita_data.gte = new Date(dataInicio)
        }
        if (dataFim) {
          where.colheita_data.lte = new Date(dataFim)
        }
      }
    }

    return this.prisma.lote.findMany({
      where,
      include: {
        cultura: { select: { id: true, nome: true } },
        setor: {
          select: {
            id: true,
            nome: true,
            area: { select: { id: true, nome: true } },
          },
        },
        protocolo: {
          include: {
            acoes: { select: { duracao_dias: true }, where: { deleted_at: null } },
          },
        },
      },
    })
  }

  /**
   * Calcula métricas de ciclo para um lote
   * @param {Object} lote - Objeto lote do Prisma
   * @returns {Object|null} Métricas calculadas ou null se dados insuficientes
   */
  calcularMetricasCiclo(lote) {
    if (!lote.semeadura_data || !lote.colheita_data) {
      return null
    }

    const duracaoReal = this.diffDias(lote.colheita_data, lote.semeadura_data)
    const duracaoPlanejada = lote.protocolo
      ? lote.protocolo.acoes.reduce((sum, a) => sum + (a.duracao_dias || 0), 0)
      : null
    const desvio = duracaoPlanejada != null ? duracaoReal - duracaoPlanejada : null
    const desvioPercentual = (desvio != null && duracaoPlanejada > 0)
      ? parseFloat(((desvio / duracaoPlanejada) * 100).toFixed(2))
      : null

    return {
      duracaoReal,
      duracaoPlanejada,
      desvio,
      desvioPercentual,
    }
  }

  /**
   * Calcula taxas de produtividade para um lote
   * @param {Object} lote - Objeto lote do Prisma
   * @returns {Object} Taxas calculadas
   */
  calcularTaxasProdutividade(lote) {
    const bandejas = lote.bandejas_semeadas || 0
    const mudas = lote.mudas_transplantadas || 0
    const plantas = lote.plantas_colhidas || 0
    const embalagens = lote.embalagens_produzidas || 0

    return {
      bandejas,
      mudas,
      plantas,
      embalagens,
      taxaGerminacao: bandejas > 0 ? parseFloat((mudas / bandejas).toFixed(2)) : null,
      taxaTransplantio: mudas > 0 ? parseFloat(((plantas / mudas) * 100).toFixed(2)) : null,
      taxaEmbalagem: plantas > 0 ? parseFloat(((embalagens / plantas) * 100).toFixed(2)) : null,
      taxaGlobal: bandejas > 0 ? parseFloat((embalagens / bandejas).toFixed(2)) : null,
    }
  }

  /**
   * Calcula diferença em dias entre duas datas
   * @param {Date|string} dataFim - Data final
   * @param {Date|string} dataInicio - Data inicial
   * @returns {number|null} Diferença em dias
   */
  diffDias(dataFim, dataInicio) {
    if (!dataFim || !dataInicio) return null
    const fim = dataFim instanceof Date ? dataFim : new Date(dataFim)
    const inicio = dataInicio instanceof Date ? dataInicio : new Date(dataInicio)
    const diff = fim - inicio
    return Math.round(diff / (1000 * 60 * 60 * 24))
  }

  /**
   * Calcula média de um array (ignora nulls)
   * @param {Array<number>} arr - Array de números
   * @returns {number|null} Média ou null se sem valores válidos
   */
  media(arr) {
    const validos = arr.filter(v => v != null && !isNaN(v))
    if (validos.length === 0) return null
    return parseFloat((validos.reduce((s, v) => s + v, 0) / validos.length).toFixed(2))
  }

  /**
   * Calcula máximo de um array (ignora nulls)
   * @param {Array<number>} arr - Array de números
   * @returns {number|null} Máximo ou null
   */
  maximo(arr) {
    const validos = arr.filter(v => v != null && !isNaN(v))
    if (validos.length === 0) return null
    return Math.max(...validos)
  }

  /**
   * Calcula mínimo de um array (ignora nulls)
   * @param {Array<number>} arr - Array de números
   * @returns {number|null} Mínimo ou null
   */
  minimo(arr) {
    const validos = arr.filter(v => v != null && !isNaN(v))
    if (validos.length === 0) return null
    return Math.min(...validos)
  }
}

module.exports = MetricasLotesService
