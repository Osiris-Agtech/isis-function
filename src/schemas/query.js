const { queryType } = require('@nexus/schema')
const { list, nonNull, intArg, arg } = require('@nexus/schema')
const {
  DomainError,
  AuthenticationError,
  InfrastructureError,
} = require('../errors/apiErrors')

const MetricasLotesService = require('../services/metricasLotesService')
const MetricasAgendaService = require('../services/metricasAgendaService')

async function getAuthorizedContaIds(prisma, authUserId) {
  if (!Number.isInteger(authUserId)) {
    throw new AuthenticationError('Autenticação obrigatória para consultar fertilizantes por conta')
  }

  const vinculacoes = await prisma.conectaConta.findMany({
    where: {
      fk_usuarios_id: authUserId,
      fk_contas_id: {
        not: null,
      },
    },
    select: {
      fk_contas_id: true,
    },
  })

  return [
    ...new Set(
      vinculacoes
        .map((vinculo) => vinculo.fk_contas_id)
        .filter(Number.isInteger)
    ),
  ]
}

async function assertContaInTenantScope(prisma, authUserId, contaId) {
  if (!Number.isInteger(contaId)) {
    throw new DomainError('VALIDATION_ERROR', 'contaId inválido')
  }

  const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId)
  if (!authorizedContaIds.includes(contaId)) {
    throw new DomainError('TENANT_SCOPE_VIOLATION', 'contaId fora do escopo do usuário autenticado')
  }

  return contaId
}

function buildFertilizanteTenantVisibilityWhere(authorizedContaIds) {
  return {
    OR: [
      {
        origin: 'SYSTEM',
      },
      {
        origin: 'CUSTOM',
        fk_contas_id: {
          in: authorizedContaIds,
        },
      },
    ],
  }
}

function isFertilizanteVisibleForTenant(fertilizante, authorizedContaIds) {
  return (
    fertilizante.origin === 'SYSTEM' ||
    (fertilizante.origin === 'CUSTOM' && authorizedContaIds.includes(fertilizante.fk_contas_id))
  )
}

function buildSolucaoTenantScopeWhere(authorizedContaIds) {
  return {
    solucoes_contas: {
      some: {
        fk_contas_id: {
          in: authorizedContaIds,
        },
      },
    },
  }
}

const Query = queryType({
  name: 'Query',
  definition(t) {
    t.crud.areas({
      filtering: true,
      ordering: true
    })
    t.crud.area()

    t.crud.atividades({
      filtering: true,
      ordering: true
    })
    t.crud.atividade()

    t.crud.cargos({
      filtering: true,
      ordering: true
    })
    t.crud.cargo()

    t.crud.contas({
      filtering: true,
      ordering: true
    })
    t.crud.conta()

    // ### FAZER MANUALMENTE
    t.crud.concentradas({
      filtering: true,
      ordering: true
    })
    t.crud.concentrada()

    t.crud.culturas({
      filtering: true,
      ordering: true
    })
    t.crud.cultura()

    t.crud.fases({
      filtering: true,
      ordering: true
    })
    t.crud.fase()

    t.crud.fertilizantes({
      filtering: true,
      ordering: true,
      resolve: async (root, args, ctx, info, originalResolve) => {
        const authorizedContaIds = await getAuthorizedContaIds(ctx.prisma, ctx.authUserId)
        const tenantVisibilityWhere = buildFertilizanteTenantVisibilityWhere(authorizedContaIds)

        args.where = {
          AND: [
            args.where || {},
            {
              deleted_at: null,
            },
            tenantVisibilityWhere,
          ],
        }

        return originalResolve(root, args, ctx, info)
      },
    })

    t.list.field('fertilizantesCatalogo', {
      type: 'Fertilizante',
      args: {
        contaId: nonNull(intArg()),
      },
      resolve: async (_, args, ctx) => {
        const contaId = await assertContaInTenantScope(ctx.prisma, ctx.authUserId, args.contaId)

        return ctx.prisma.fertilizante.findMany({
          where: {
            deleted_at: null,
            OR: [
              {
                origin: 'SYSTEM',
              },
              {
                origin: 'CUSTOM',
                fk_contas_id: contaId,
              },
            ],
          },
          orderBy: {
            nome: 'asc',
          },
        })
      },
    })

    t.list.field('fertilizantesHistoricoSolucao', {
      type: 'Fertilizante',
      args: {
        solucaoId: nonNull(intArg()),
      },
      resolve: async (_, args, ctx) => {
        const authorizedContaIds = await getAuthorizedContaIds(ctx.prisma, ctx.authUserId)
        const relacoes = await ctx.prisma.solucoes_Fertilizantes_Concentradas.findMany({
          where: {
            fk_solucoes_id: args.solucaoId,
            solucao: {
              solucoes_contas: {
                some: {
                  fk_contas_id: {
                    in: authorizedContaIds,
                  },
                },
              },
            },
          },
          select: {
            fk_fertilizantes_id: true,
          },
        })

        const fertilizantesIds = [
          ...new Set(
            relacoes
              .map((item) => item.fk_fertilizantes_id)
              .filter((id) => id != null)
          ),
        ]

        if (fertilizantesIds.length === 0) {
          return []
        }

        return ctx.prisma.fertilizante.findMany({
          where: {
            id: {
              in: fertilizantesIds,
            },
            OR: [
              {
                origin: 'SYSTEM',
              },
              {
                origin: 'CUSTOM',
                fk_contas_id: {
                  in: authorizedContaIds,
                },
              },
            ],
          },
        })
      },
    })

    t.crud.fertilizante({
      resolve: async (root, args, ctx, info, originalResolve) => {
        const authorizedContaIds = await getAuthorizedContaIds(ctx.prisma, ctx.authUserId)
        const result = await originalResolve(root, args, ctx, info)

        if (!result || result.deleted_at) {
          return null
        }

        if (!isFertilizanteVisibleForTenant(result, authorizedContaIds)) {
          return null
        }

        return result
      },
    })

    // ### FAZER MANUALMENTE
    // t.crud.fertilizantes_nutrientes({
    //   filtering: true,
    //   ordering: true
    // })

    // ### s no final para indicar MANY
    t.crud.localizacaos({
      filtering: true,
      ordering: true
    })

    t.crud.localizacao()

    t.crud.logs({
      filtering: true,
      ordering: true
    })
    t.crud.log()

    t.crud.lotes({
      filtering: true,
      ordering: true
    })
    t.crud.lote()

    // ### FAZER MANUALMENTE
    // t.crud.Lotes_Atividades({
    //   filtering: true,
    //   ordering: true
    // })
    // t.crud.lotes_atividades()

    t.crud.nutrientes({
      filtering: true,
      ordering: true
    })
    t.crud.nutriente()

    // ### FAZER MANUALMENTE
    t.crud.sNutritivas({
      filtering: true,
      ordering: true,
      resolve: async (root, args, ctx, info, originalResolve) => {
        const authorizedContaIds = await getAuthorizedContaIds(ctx.prisma, ctx.authUserId)
        const tenantScopeWhere = buildSolucaoTenantScopeWhere(authorizedContaIds)

        args.where = {
          AND: [
            args.where || {},
            tenantScopeWhere,
          ],
        }

        return originalResolve(root, args, ctx, info)
      },
    })
    t.crud.sNutritiva({
      resolve: async (root, args, ctx, info, originalResolve) => {
        const authorizedContaIds = await getAuthorizedContaIds(ctx.prisma, ctx.authUserId)
        const result = await originalResolve(root, args, ctx, info)

        if (!result) {
          return null
        }

        const scopedSolucao = await ctx.prisma.sNutritiva.findFirst({
          where: {
            id: result.id,
            ...buildSolucaoTenantScopeWhere(authorizedContaIds),
          },
          select: {
            id: true,
          },
        })

        if (!scopedSolucao) {
          throw new DomainError('TENANT_SCOPE_VIOLATION', 'Solução fora do escopo do usuário autenticado')
        }

        return result
      },
    })

    t.crud.notificacaos({
      filtering: true,
      ordering: true
    })
    t.crud.notificacao()

    // ### FAZER MANUALMENTE
    // t.crud.permissoes({
    //   filtering: true,
    //   ordering: true
    // })
    t.crud.permissao()

    t.crud.pessoas({
      filtering: true,
      ordering: true
    })
    t.crud.pessoa()

    t.crud.reservatorios({
      filtering: true,
      ordering: true
    })
    t.crud.reservatorio()
    
    // t.crud.agendas({
    //   filtering: true,
    //   ordering: true
    // })
    t.list.field('agendas', {
      type: 'Agenda',
      args: {
        contaId: 'Int',
      },
      resolve: async (_, args, ctx) => {
        const agendas = await ctx.prisma.agenda.findMany({
          where: {
            deleted_at: null,
            conta: {
              id: {
                equals: args.contaId,
              }
            },
          },
        });

        console.log(agendas);
        return agendas;
      },
    });
    t.list.field('agendasAbertasPorLoteId', {
      type: 'Agenda',
      args: {
        lotesId: list(nonNull(intArg())),
      },
      resolve: async (_, args, ctx) => {
        const agendas = await ctx.prisma.agenda.findMany({
          where: {
            deleted_at: null,
            lote: {
              id: {
                in: args.lotesId,
              }
            },
            finalizado: {
              equals: false,
            }
          },
        });

        console.log(agendas);
        return agendas;
      },
    });
    t.field('agenda', {
      type: 'Agenda',
      args: {
        id: 'Int',
      },
      resolve: async (_, args, ctx) => {
        const agenda = await ctx.prisma.agenda.findFirst({
          where: {
            id: {
                equals: args.id,
              }
          },
        });

        return agenda;
      },
    });

    t.crud.protocolos({
      filtering: true,
      ordering: true
    })
    t.crud.protocolo()

    t.crud.acaos({
      filtering: true,
      ordering: true
    })
    t.crud.acao()

    // ### s no final para indicar MANY
    // t.crud.setors({
    //   filtering: true,
    //   ordering: true
    // })
    // t.list.field('setors', {
    //   type: 'Setor',
    //   args: {
    //     after: 'SetorWhereUniqueInput',
    //     before: 'SetorWhereUniqueInput',
    //     first: 'Int',
    //     last: 'Int',
    //     orderBy: ['SetorOrderByWithRelationInput'],
    //     where: 'SetorWhereInput',
    //   },
    //   resolve: async (_, args, ctx) => {
    //     // Desestruture os argumentos
    //     const { after, before, first, last, orderBy, where } = args;

    //     // Use o Prisma para buscar os setores com os argumentos fornecidos
    //     const setors = await ctx.prisma.setor.findMany({
    //       where: {
    //         deleted_at: null,
    //         ...where, // Adicione as condições where fornecidas
    //       },
    //       orderBy,
    //       take: first, // Limite de resultados
    //       skip: last, // Pule os últimos resultados
    //     });

    //     return setors;
    //   },
    // });
    t.crud.setors({
      filtering: true,
      ordering: true
    })
    t.crud.setor()

    // ### FAZER MANUALMENTE
    // t.crud.solucoes_contas({
    //   filtering: true,
    //   ordering: true
    // })
    // t.crud.solucao_conta()

    // ### FAZER MANUALMENTE
    // t.crud.solucoes_fertilizantes_concentradas({
    //   filtering: true,
    //   ordering: true
    // })
    // t.crud.solucao_fertilizante_concentrada()

    t.crud.usuarios({
      filtering: true,
      ordering: true
    })
    t.crud.usuario()

    // ### FAZER MANUALMENTE
    // t.crud.usuarios_contas_cargos({
    //   filtering: true,
    //   ordering: true
    // })
    // t.crud.usuario_conta_cargo()

    // Home Dashboard Query
    t.field('homeDashboard', {
      type: 'HomeDashboard',
      args: {
        contaId: nonNull(intArg()),
      },
      resolve: async (_, { contaId }, { prisma }) => {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const amanha = new Date(hoje)
        amanha.setDate(amanha.getDate() + 1)
        const semanaFim = new Date(hoje)
        semanaFim.setDate(semanaFim.getDate() + 7)
        const mesAtras = new Date(hoje)
        mesAtras.setDate(mesAtras.getDate() - 30)
        const doisMesesAtras = new Date(hoje)
        doisMesesAtras.setDate(doisMesesAtras.getDate() - 60)
        const proximaSemanaInicio = new Date(hoje)
        proximaSemanaInicio.setDate(proximaSemanaInicio.getDate() + 7)
        const proximaSemanaFim = new Date(hoje)
        proximaSemanaFim.setDate(proximaSemanaFim.getDate() + 14)

        // Buscar áreas da conta
        const areas = await prisma.area.findMany({
          where: {
            conta: { id: contaId },
            deleted_at: null,
          },
          select: { id: true },
        })
        const areaIds = areas.map(a => a.id)

        // Buscar setores das áreas
        const setores = await prisma.setor.findMany({
          where: {
            area: { id: { in: areaIds } },
          },
          select: { id: true },
        })
        const setorIds = setores.map(s => s.id)

        // Buscar todos os lotes da conta (via setores)
        const lotes = await prisma.lote.findMany({
          where: {
            setor: { id: { in: setorIds } },
            deleted_at: null,
          },
          include: {
            cultura: {
              select: { nome: true },
            },
          },
        })

        // Métricas de lotes
        const totalLotes = lotes.length
        const lotesAtivos = lotes.filter(l => l.ativo === true).length
        const lotesFinalizados = totalLotes - lotesAtivos
        const taxaConclusao = totalLotes > 0
          ? parseFloat(((lotesFinalizados / totalLotes) * 100).toFixed(1))
          : 0

        // NOVO: Lotes por status
        const lotesPorStatus = [
          { status: 'Em Produção', quantidade: lotesAtivos, cor: '#059669' },
          { status: 'Finalizados', quantidade: lotesFinalizados, cor: '#6B7280' },
        ]

        // NOVO: Lotes com colheita próxima (próximos 7 dias)
        const lotesColheitaProximaList = lotes.filter(l => {
          if (!l.colheita_data) return false
          const dataColheita = new Date(l.colheita_data)
          return dataColheita >= hoje && dataColheita <= semanaFim
        })

        // NOVO: Espécies em andamento (top culturas ativas com percentual)
        const culturaMapAtivas = {}
        lotes.forEach(lote => {
          if (lote.ativo && lote.cultura) {
            const nome = lote.cultura.nome || 'Sem cultura'
            culturaMapAtivas[nome] = (culturaMapAtivas[nome] || 0) + 1
          }
        })
        const totalAtivas = Object.values(culturaMapAtivas).reduce((s, v) => s + v, 0) || 1
        const especiesEmAndamento = Object.entries(culturaMapAtivas)
          .map(([nome, qtd]) => ({
            nome,
            percentual: parseFloat(((qtd / totalAtivas) * 100).toFixed(1)),
            status: 'Em produção',
          }))
          .sort((a, b) => b.percentual - a.percentual)
          .slice(0, 5)

        // Produção total (últimos 30 dias)
        const lotesComColheita = lotes.filter(l => l.colheita_data && new Date(l.colheita_data) >= mesAtras)
        const totalPlantasColhidas = lotesComColheita.reduce((sum, l) =>
          sum + (l.plantas_colhidas || 0), 0
        )
        const totalEmbalagensProduzidas = lotesComColheita.reduce((sum, l) =>
          sum + (l.embalagens_produzidas || 0), 0
        )

        const lotesComColheitaProxima = lotesColheitaProximaList.length

        // Período de produção (últimos 30 dias)
        const periodoInicio = mesAtras.toISOString().split('T')[0]
        const periodoFim = hoje.toISOString().split('T')[0]

        // NOVO: Produção mensal (últimos 6 meses)
        const mesesLabels = []
        const producaoMensalData = []
        for (let i = 5; i >= 0; i--) {
          const mesRef = new Date(hoje)
          mesRef.setMonth(mesRef.getMonth() - i)
          const mesInicio = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1)
          const mesFim = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0, 23, 59, 59)
          const nomeMes = mesRef.toLocaleDateString('pt-BR', { month: 'short' })

          const lotesMes = lotes.filter(l => {
            if (!l.colheita_data) return false
            const data = new Date(l.colheita_data)
            return data >= mesInicio && data <= mesFim
          })
          const plantasMes = lotesMes.reduce((sum, l) => sum + (l.plantas_colhidas || 0), 0)

          mesesLabels.push(nomeMes)
          producaoMensalData.push({ mes: nomeMes, quantidade: plantasMes })
        }

        // NOVO: Taxas médias de produtividade (lotes finalizados)
        const lotesFinalizadosList = lotes.filter(l => !l.ativo && l.colheita_data)
        let taxasMedia = { taxaGerminacao: 0, taxaTransplantio: 0, taxaEmbalagem: 0, taxaGlobal: 0 }
        if (lotesFinalizadosList.length > 0) {
          const taxas = lotesFinalizadosList.map(l => {
            const bandejas = l.bandejas_semeadas || 0
            const mudas = l.mudas_transplantadas || 0
            const plantas = l.plantas_colhidas || 0
            const embalagens = l.embalagens_produzidas || 0
            return {
              taxaGerminacao: bandejas > 0 ? (mudas / bandejas) * 100 : 0,
              taxaTransplantio: mudas > 0 ? (plantas / mudas) * 100 : 0,
              taxaEmbalagem: plantas > 0 ? (embalagens / plantas) * 100 : 0,
              taxaGlobal: bandejas > 0 ? (embalagens / bandejas) * 100 : 0,
            }
          })
          const n = lotesFinalizadosList.length
          taxasMedia = {
            taxaGerminacao: parseFloat((taxas.reduce((s, t) => s + t.taxaGerminacao, 0) / n).toFixed(1)),
            taxaTransplantio: parseFloat((taxas.reduce((s, t) => s + t.taxaTransplantio, 0) / n).toFixed(1)),
            taxaEmbalagem: parseFloat((taxas.reduce((s, t) => s + t.taxaEmbalagem, 0) / n).toFixed(1)),
            taxaGlobal: parseFloat((taxas.reduce((s, t) => s + t.taxaGlobal, 0) / n).toFixed(1)),
          }
        }

        // NOVO: Comparativo com período anterior (30 dias anteriores)
        const lotesPeriodoAnterior = lotes.filter(l =>
          l.colheita_data && new Date(l.colheita_data) >= doisMesesAtras && new Date(l.colheita_data) < mesAtras
        )
        const plantasPeriodoAnterior = lotesPeriodoAnterior.reduce((sum, l) =>
          sum + (l.plantas_colhidas || 0), 0
        )
        const variacaoPercentual = plantasPeriodoAnterior > 0
          ? parseFloat((((totalPlantasColhidas - plantasPeriodoAnterior) / plantasPeriodoAnterior) * 100).toFixed(1))
          : 0
        const comparativoPeriodo = {
          plantasColhidas: plantasPeriodoAnterior,
          variacaoPercentual,
        }

        // NOVO: Cultura mais produção
        const culturaProducaoMap = {}
        lotesComColheita.forEach(l => {
          if (l.cultura) {
            const nome = l.cultura.nome || 'Sem cultura'
            culturaProducaoMap[nome] = (culturaProducaoMap[nome] || 0) + (l.plantas_colhidas || 0)
          }
        })
        const totalProducaoCulturas = Object.values(culturaProducaoMap).reduce((s, v) => s + v, 0) || 1
        const culturaMaisProducaoEntry = Object.entries(culturaProducaoMap)
          .sort((a, b) => b[1] - a[1])[0]
        const culturaMaisProducao = culturaMaisProducaoEntry
          ? {
              nome: culturaMaisProducaoEntry[0],
              quantidade: culturaMaisProducaoEntry[1],
              percentualDoTotal: parseFloat(((culturaMaisProducaoEntry[1] / totalProducaoCulturas) * 100).toFixed(1)),
            }
          : { nome: 'N/A', quantidade: 0, percentualDoTotal: 0 }

        // Buscar agendas da conta
        const agendas = await prisma.agenda.findMany({
          where: {
            conta: { id: contaId },
            deleted_at: null,
            finalizado: false,
          },
          include: {
            lote: { select: { nome: true } },
          },
          orderBy: { data: 'asc' },
        })

        // Tarefas pendentes
        const tarefasPendentesHoje = agendas.filter(a => {
          if (!a.data) return false
          const dataAgenda = new Date(a.data)
          dataAgenda.setHours(0, 0, 0, 0)
          return dataAgenda.getTime() === hoje.getTime()
        }).length

        const tarefasPendentesSemana = agendas.filter(a => {
          if (!a.data) return false
          const dataAgenda = new Date(a.data)
          return dataAgenda >= hoje && dataAgenda <= semanaFim
        }).length

        const tarefasAtrasadas = agendas.filter(a => {
          if (!a.data) return false
          const dataAgenda = new Date(a.data)
          return dataAgenda < hoje
        }).length

        // NOVO: Tarefas por vencimento
        const tarefasHoje = agendas.filter(a => {
          if (!a.data) return false
          const d = new Date(a.data); d.setHours(0, 0, 0, 0)
          return d.getTime() === hoje.getTime()
        }).length
        const tarefasEstaSemana = agendas.filter(a => {
          if (!a.data) return false
          const d = new Date(a.data)
          return d > hoje && d <= semanaFim
        }).length
        const tarefasProximaSemana = agendas.filter(a => {
          if (!a.data) return false
          const d = new Date(a.data)
          return d >= proximaSemanaInicio && d <= proximaSemanaFim
        }).length
        const porVencimento = { hoje: tarefasHoje, estaSemana: tarefasEstaSemana, proximaSemana: tarefasProximaSemana }

        // NOVO: Tarefas por prioridade (baseado em alertas e vencimento)
        const tarefasAltaPrioridade = agendas.filter(a => a.alerta === true || (a.data && new Date(a.data) < hoje)).length
        const tarefasMediaPrioridade = agendas.filter(a => {
          if (!a.data || a.alerta) return false
          const d = new Date(a.data)
          return d >= hoje && d <= amanha
        }).length
        const tarefasBaixaPrioridade = agendas.filter(a => {
          if (!a.data || a.alerta) return false
          const d = new Date(a.data)
          return d > amanha
        }).length
        const porPrioridade = { alta: tarefasAltaPrioridade, media: tarefasMediaPrioridade, baixa: tarefasBaixaPrioridade }

        // NOVO: Últimas tarefas (próximas 5)
        const ultimasTarefas = agendas.slice(0, 5).map(a => ({
          id: a.id,
          titulo: a.titulo || 'Sem título',
          loteNome: a.lote?.nome || 'Sem lote',
          data: a.data ? new Date(a.data).toISOString().split('T')[0] : null,
          vencida: a.data ? new Date(a.data) < hoje : false,
        }))

        // Distribuição por cultura (top 3)
        const culturaMap = {}
        lotes.forEach(lote => {
          if (lote.ativo && lote.cultura) {
            const nomeCultura = lote.cultura.nome || 'Sem cultura'
            culturaMap[nomeCultura] = (culturaMap[nomeCultura] || 0) + 1
          }
        })

        const coresCulturas = ['#059669', '#2563EB', '#8B5CF6', '#DC2626', '#F59E0B', '#EC4899']
        const culturas = Object.entries(culturaMap)
          .map(([nome, quantidade], idx) => ({ nome, quantidade, cor: coresCulturas[idx % coresCulturas.length] }))
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 3)

        // NOVO: Resumo da equipe (via ConectaConta)
        const conectaContas = await prisma.conectaConta.findMany({
          where: {
            conta: { id: contaId },
            usuario: { ativo: true },
          },
          include: { usuario: true },
        })
        const membrosAtivos = conectaContas.length

        // Buscar atividades dos usuários nos lotes
        const usuariosIds = conectaContas.map(cc => cc.usuario.id)
        const agendasUsuario = await prisma.agenda.findMany({
          where: {
            conta: { id: contaId },
            usuario: { id: { in: usuariosIds } },
            deleted_at: null,
          },
        })
        const agendasFinalizadas = agendasUsuario.filter(a => a.finalizado === true).length
        const agendasNoPrazo = agendasUsuario.filter(a => {
          if (!a.finalizado || !a.data) return false
          return new Date(a.data) >= hoje
        }).length
        const agendasVencidas = agendasUsuario.filter(a => {
          if (a.finalizado || !a.data) return false
          return new Date(a.data) < hoje
        }).length
        const taxaConclusaoMedia = membrosAtivos > 0 && agendasUsuario.length > 0
          ? parseFloat(((agendasFinalizadas / agendasUsuario.length) * 100).toFixed(1))
          : 0

        const equipe = {
          membrosAtivos,
          taxaConclusaoMedia,
          atividadesNoPrazo: agendasNoPrazo,
          atividadesVencidas: agendasVencidas,
        }

        // NOVO: Alertas críticos
        const alertasCritico = []

        // Alerta: tarefas vencidas críticas
        if (tarefasAtrasadas > 0) {
          const tarefasVencidasList = agendas.filter(a => a.data && new Date(a.data) < hoje).slice(0, 3)
          tarefasVencidasList.forEach(a => {
            alertasCritico.push({
              tipo: 'tarefa_vencida',
              mensagem: `"${a.titulo}" está atrasada`,
              loteId: a.fk_lote_id,
              loteNome: a.lote?.nome || 'Sem lote',
              gravidade: 'alta',
              data: a.data ? new Date(a.data).toISOString().split('T')[0] : null,
            })
          })
        }

        // Alerta: lotes com colheita próxima
        lotesColheitaProximaList.slice(0, 2).forEach(l => {
          alertasCritico.push({
            tipo: 'colheita_proxima',
            mensagem: `Colheita prevista para ${new Date(l.colheita_data).toLocaleDateString('pt-BR')}`,
            loteId: l.id,
            loteNome: l.nome || 'Sem nome',
            gravidade: 'media',
            data: l.colheita_data ? new Date(l.colheita_data).toISOString().split('T')[0] : null,
          })
        })

        // Ordenar alertas por gravidade
        const gravidadeOrder = { alta: 0, media: 1, baixa: 2 }
        alertasCritico.sort((a, b) => gravidadeOrder[a.gravidade] - gravidadeOrder[b.gravidade])

        return {
          resumo: {
            totalLotes,
            lotesAtivos,
            lotesFinalizados,
            taxaConclusao,
            lotesPorStatus,
            lotesComColheitaProxima,
            especiesEmAndamento,
          },
          tarefas: {
            pendentesHoje: tarefasPendentesHoje,
            pendentesSemana: tarefasPendentesSemana,
            atrasadas: tarefasAtrasadas,
            porVencimento,
            porPrioridade,
            ultimasTarefas,
          },
          producao: {
            totalPlantasColhidas,
            totalEmbalagensProduzidas,
            lotesComColheitaProxima,
            periodoInicio,
            periodoFim,
            producaoMensal: producaoMensalData,
            taxasMedia,
            comparativoPeriodo,
            culturaMaisProducao,
          },
          culturas,
          equipe,
          alertasCritico: alertasCritico.slice(0, 5),
        }
      },
    })

    // Relatório de Ciclo de Produção por Cultura
    t.field('relatorioCircoCultura', {
      type: 'RelatorioCicloResult',
      args: {
        contaId: nonNull(intArg()),
        filtros: arg({ type: 'RelatorioCicloFiltros' }),
      },
      resolve: async (_, { contaId, filtros }, { prisma }) => {
        // Período padrão: últimos 6 meses
        const hoje = new Date()
        const seisMesesAtras = new Date(hoje)
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)

        const dataInicio = filtros?.dataInicio ? new Date(filtros.dataInicio) : seisMesesAtras
        const dataFim = filtros?.dataFim ? new Date(filtros.dataFim) : hoje

        // Buscar áreas da conta
        const areas = await prisma.area.findMany({
          where: {
            conta: { id: contaId },
            deleted_at: null,
            ...(filtros?.areaIds?.length ? { id: { in: filtros.areaIds } } : {}),
          },
          select: { id: true },
        })
        const areaIds = areas.map(a => a.id)

        // Buscar setores das áreas
        const setores = await prisma.setor.findMany({
          where: {
            area: { id: { in: areaIds } },
            deleted_at: null,
            ...(filtros?.setorIds?.length ? { id: { in: filtros.setorIds } } : {}),
          },
          select: { id: true },
        })
        const setorIds = setores.map(s => s.id)

        // Buscar lotes com ciclo completo
        const lotes = await prisma.lote.findMany({
          where: {
            setor: { id: { in: setorIds } },
            deleted_at: null,
            semeadura_data: { not: null },
            colheita_data: { not: null, gte: dataInicio, lte: dataFim },
            ...(filtros?.culturaIds?.length ? { fk_culturas_id: { in: filtros.culturaIds } } : {}),
          },
          include: {
            cultura: { select: { id: true, nome: true } },
            setor: { select: { nome: true, area: { select: { nome: true } } } },
            protocolo: {
              include: {
                acoes: { select: { duracao_dias: true }, where: { deleted_at: null } },
              },
            },
          },
        })

        // Helper: diferença em dias entre duas datas
        const diffDias = (dataFimCalc, dataInicioCalc) => {
          if (!dataFimCalc || !dataInicioCalc) return null
          const diff = new Date(dataFimCalc) - new Date(dataInicioCalc)
          return Math.round(diff / (1000 * 60 * 60 * 24))
        }

        // Calcular métricas por lote
        const lotesCalculados = lotes
          .filter(lote => {
            const semeadura = new Date(lote.semeadura_data)
            const colheita = new Date(lote.colheita_data)
            return colheita > semeadura // excluir datas inválidas
          })
          .map(lote => {
            const duracaoReal = diffDias(lote.colheita_data, lote.semeadura_data)
            const duracaoPlanejada = lote.protocolo
              ? lote.protocolo.acoes.reduce((sum, a) => sum + (a.duracao_dias || 0), 0)
              : null
            const desvio = duracaoPlanejada != null ? duracaoReal - duracaoPlanejada : null
            const desvioPercentual = (desvio != null && duracaoPlanejada > 0)
              ? parseFloat(((desvio / duracaoPlanejada) * 100).toFixed(2))
              : null

            return {
              loteId: lote.id,
              loteNome: lote.nome,
              semeaduraData: lote.semeadura_data?.toISOString() ?? null,
              transplantioData: lote.transplantio_data?.toISOString() ?? null,
              colheitaData: lote.colheita_data?.toISOString() ?? null,
              duracaoRealDias: duracaoReal,
              duracaoPlanejadaDias: duracaoPlanejada,
              desvioDias: desvio,
              desvioPercentual,
              setorNome: lote.setor?.nome ?? null,
              areaNome: lote.setor?.area?.nome ?? null,
              culturaId: lote.cultura?.id ?? null,
              culturaNome: lote.cultura?.nome ?? null,
            }
          })

        // Agrupar por cultura
        const culturaMap = {}
        lotesCalculados.forEach(lote => {
          const id = lote.culturaId
          if (!id) return
          if (!culturaMap[id]) {
            culturaMap[id] = {
              culturaId: id,
              culturaNome: lote.culturaNome,
              lotes: [],
            }
          }
          culturaMap[id].lotes.push(lote)
        })

        // Helper: média de array (ignora nulls)
        const media = arr => {
          const validos = arr.filter(v => v != null)
          if (validos.length === 0) return null
          return parseFloat((validos.reduce((s, v) => s + v, 0) / validos.length).toFixed(2))
        }

        // Calcular agregados por cultura
        const culturas = Object.values(culturaMap).map(grupo => {
          const lotesGrupo = grupo.lotes
          const desviosPerc = lotesGrupo.map(l => l.desvioPercentual)
          const desvioDias = lotesGrupo.map(l => l.desvioDias)
          const desviosValidos = desvioDias.filter(v => v != null)

          return {
            culturaId: grupo.culturaId,
            culturaNome: grupo.culturaNome,
            totalLotes: lotesGrupo.length,
            duracaoRealMedia: media(lotesGrupo.map(l => l.duracaoRealDias)),
            duracaoPlanejadaMedia: media(lotesGrupo.map(l => l.duracaoPlanejadaDias)),
            desvioMedioDias: media(desvioDias),
            desvioMedioPercentual: media(desviosPerc),
            desvioMaxDias: desviosValidos.length ? Math.max(...desviosValidos) : null,
            desvioMinDias: desviosValidos.length ? Math.min(...desviosValidos) : null,
            lotes: lotesGrupo,
          }
        })

        // Ordenar por desvioMedioPercentual asc (null por último)
        culturas.sort((a, b) => {
          if (a.desvioMedioPercentual == null && b.desvioMedioPercentual == null) return 0
          if (a.desvioMedioPercentual == null) return 1
          if (b.desvioMedioPercentual == null) return -1
          return a.desvioMedioPercentual - b.desvioMedioPercentual
        })

        // Desvio médio geral
        const todosDesvios = lotesCalculados.map(l => l.desvioPercentual).filter(v => v != null)
        const desvioMedioGeral = todosDesvios.length
          ? parseFloat((todosDesvios.reduce((s, v) => s + v, 0) / todosDesvios.length).toFixed(2))
          : 0

        return {
          culturas,
          totalLotes: lotesCalculados.length,
          desvioMedioGeral,
          periodoInicio: dataInicio.toISOString().split('T')[0],
          periodoFim: dataFim.toISOString().split('T')[0],
        }
      },
    })

    // Relatório de Desempenho da Equipe
    t.field('relatorioDesempenhoEquipe', {
      type: 'RelatorioDesempenhoResult',
      args: {
        contaId: nonNull(intArg()),
        filtros: arg({ type: 'RelatorioDesempenhoFiltros' }),
      },
      resolve: async (_, { contaId, filtros }, { prisma }) => {
        const hoje = new Date()
        const seisMesesAtras = new Date(hoje)
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)

        const dataInicio = filtros?.dataInicio ? new Date(filtros.dataInicio) : seisMesesAtras
        const dataFim = filtros?.dataFim ? new Date(filtros.dataFim) : hoje

        // 1. Buscar usuários ativos da conta via ConectaConta
        const conectas = await prisma.conectaConta.findMany({
          where: {
            fk_contas_id: contaId,
            usuario: { ativo: true },
          },
          include: { usuario: { select: { id: true, nome: true } } },
        })
        let usuarios = conectas
          .filter(c => c.usuario)
          .map(c => c.usuario)

        // Filtrar por usuarioIds se informado
        if (filtros?.usuarioIds?.length) {
          usuarios = usuarios.filter(u => filtros.usuarioIds.includes(u.id))
        }

        if (usuarios.length === 0) {
          return {
            usuarios: [],
            totalUsuarios: 0,
            taxaConclusaoMedia: 0,
            periodoInicio: dataInicio.toISOString().split('T')[0],
            periodoFim: dataFim.toISOString().split('T')[0],
          }
        }

        const usuarioIds = usuarios.map(u => u.id)

        // 2. Contar atividades por usuário via lote.semeadura_data no período
        //    (Lotes_Atividades não tem created_at — filtra pelo lote vinculado)
        const atividadesRaw = await prisma.lotes_Atividades.findMany({
          where: {
            fk_contas_id: contaId,
            fk_usuarios_id: { in: usuarioIds },
            lote: {
              semeadura_data: { gte: dataInicio, lte: dataFim },
              deleted_at: null,
            },
          },
          include: {
            atividade: { select: { id: true, nome: true } },
            lote: { select: { id: true, nome: true } },
          },
        })

        // 3. Buscar agendas por usuário no período
        const agendasRaw = await prisma.agenda.findMany({
          where: {
            fk_conta_id: contaId,
            fk_usuarios_id: { in: usuarioIds },
            data: { gte: dataInicio, lte: dataFim },
            deleted_at: null,
          },
          select: {
            id: true,
            titulo: true,
            data: true,
            finalizado: true,
            updated_at: true,
            fk_usuarios_id: true,
          },
        })

        // 4. Montar métricas por usuário
        const resultado = usuarios.map(usuario => {
          const atividades = atividadesRaw.filter(
            a => a.fk_usuarios_id === usuario.id
          )
          const agendas = agendasRaw.filter(
            a => a.fk_usuarios_id === usuario.id
          )

          const totalAtividades = atividades.length
          const totalAgendas = agendas.length
          const agendasFinalizadas = agendas.filter(a => a.finalizado).length

          // "No prazo": finalizado = true AND updated_at <= data
          const agendasNoPrazo = agendas.filter(
            a => a.finalizado && a.updated_at && a.data &&
                 new Date(a.updated_at) <= new Date(a.data)
          ).length

          const taxaConclusao = totalAgendas > 0
            ? parseFloat((agendasFinalizadas / totalAgendas * 100).toFixed(2))
            : null

          const taxaPrazo = agendasFinalizadas > 0
            ? parseFloat((agendasNoPrazo / agendasFinalizadas * 100).toFixed(2))
            : null

          // Últimas atividades (top 10)
          const ultimasAtividades = atividades.slice(0, 10).map(a => ({
            atividadeId: a.atividade?.id ?? 0,
            atividadeNome: a.atividade?.nome ?? '',
            loteId: a.lote?.id ?? 0,
            loteNome: a.lote?.nome ?? null,
          }))

          // Agendas pendentes e vencidas
          const agendasPendentes = agendas
            .filter(a => !a.finalizado)
            .slice(0, 10)
            .map(a => ({
              agendaId: a.id,
              titulo: a.titulo ?? null,
              data: a.data ? a.data.toISOString() : '',
              finalizado: a.finalizado,
              vencida: a.data ? new Date(a.data) < hoje : false,
            }))

          return {
            usuarioId: usuario.id,
            usuarioNome: usuario.nome ?? '',
            totalAtividades,
            totalAgendas,
            agendasFinalizadas,
            agendasNoPrazo,
            taxaConclusao,
            taxaPrazo,
            ultimasAtividades,
            agendasPendentes,
          }
        })

        // 5. Filtrar usuários sem atividade nem agenda no período
        const resultadoFiltrado = resultado.filter(
          u => u.totalAtividades > 0 || u.totalAgendas > 0
        )

        // 6. Ordenar por totalAtividades desc
        resultadoFiltrado.sort((a, b) => b.totalAtividades - a.totalAtividades)

        // 7. Taxa de conclusão média da equipe
        const taxasValidas = resultadoFiltrado
          .map(u => u.taxaConclusao)
          .filter(t => t != null)
        const taxaConclusaoMedia = taxasValidas.length
          ? parseFloat((taxasValidas.reduce((s, v) => s + v, 0) / taxasValidas.length).toFixed(2))
          : 0

        return {
          usuarios: resultadoFiltrado,
          totalUsuarios: resultadoFiltrado.length,
          taxaConclusaoMedia,
          periodoInicio: dataInicio.toISOString().split('T')[0],
          periodoFim: dataFim.toISOString().split('T')[0],
        }
      },
    })

    // ============================================
    // QUERY: relatorioProdutividadeSetor
    // ============================================
    t.field('relatorioProdutividadeSetor', {
      type: 'RelatorioProdutividadeResult',
      args: {
        contaId: nonNull(intArg()),
        filtros: arg({ type: 'RelatorioProdutividadeFiltros' }),
      },
      resolve: async (_, { contaId, filtros }, { prisma }) => {
        const service = new MetricasLotesService(prisma)

        // Período padrão: últimos 6 meses
        const hoje = new Date()
        const seisMesesAtras = new Date(hoje)
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)

        const dataInicio = filtros?.dataInicio || seisMesesAtras.toISOString()
        const dataFim = filtros?.dataFim || hoje.toISOString()

        // Buscar lotes
        const lotes = await service.buscarLotes(contaId, {
          dataInicio,
          dataFim,
          culturaIds: filtros?.culturaIds,
          setorIds: filtros?.setorIds,
          areaIds: filtros?.areaIds,
          apenasFinalizados: true,
        })

        // Calcular métricas por lote
        const lotesCalculados = lotes.map(lote => ({
          ...lote,
          metricas: service.calcularTaxasProdutividade(lote),
        }))

        // Agrupar por setor
        const setorMap = {}
        lotesCalculados.forEach(lote => {
          const setorId = lote.setor?.id
          if (!setorId) return

          if (!setorMap[setorId]) {
            setorMap[setorId] = {
              setorId,
              setorNome: lote.setor.nome,
              areaNome: lote.setor.area?.nome,
              lotes: [],
            }
          }
          setorMap[setorId].lotes.push(lote)
        })

        // Calcular agregados por setor
        const setores = Object.values(setorMap).map(setor => {
          const totais = setor.lotes.reduce((acc, l) => ({
            bandejas: acc.bandejas + (l.metricas.bandejas || 0),
            mudas: acc.mudas + (l.metricas.mudas || 0),
            plantas: acc.plantas + (l.metricas.plantas || 0),
            embalagens: acc.embalagens + (l.metricas.embalagens || 0),
          }), { bandejas: 0, mudas: 0, plantas: 0, embalagens: 0 })

          // Agrupar áreas dentro do setor
          const areaMap = {}
          setor.lotes.forEach(lote => {
            const areaId = lote.setor?.area?.id
            if (!areaId) return
            if (!areaMap[areaId]) {
              areaMap[areaId] = {
                areaId,
                areaNome: lote.setor.area.nome,
                lotes: [],
              }
            }
            areaMap[areaId].lotes.push(lote)
          })

          const areas = Object.values(areaMap).map(area => {
            const t = area.lotes.reduce((acc, l) => ({
              bandejas: acc.bandejas + (l.metricas.bandejas || 0),
              mudas: acc.mudas + (l.metricas.mudas || 0),
              plantas: acc.plantas + (l.metricas.plantas || 0),
              embalagens: acc.embalagens + (l.metricas.embalagens || 0),
            }), { bandejas: 0, mudas: 0, plantas: 0, embalagens: 0 })

            return {
              areaId: area.areaId,
              areaNome: area.areaNome,
              totalLotes: area.lotes.length,
              totalBandejasSemeadas: t.bandejas,
              totalMudasTransplantadas: t.mudas,
              totalPlantasColhidas: t.plantas,
              totalEmbalagensProduzidas: t.embalagens,
              taxaGerminacao: t.bandejas > 0 ? parseFloat((t.mudas / t.bandejas).toFixed(2)) : null,
              taxaTransplantio: t.mudas > 0 ? parseFloat(((t.plantas / t.mudas) * 100).toFixed(2)) : null,
              taxaEmbalagem: t.plantas > 0 ? parseFloat(((t.embalagens / t.plantas) * 100).toFixed(2)) : null,
              taxaGlobal: t.bandejas > 0 ? parseFloat((t.embalagens / t.bandejas).toFixed(2)) : null,
            }
          })

          return {
            setorId: setor.setorId,
            setorNome: setor.setorNome,
            areaNome: setor.areaNome,
            totalLotes: setor.lotes.length,
            totalBandejasSemeadas: totais.bandejas,
            totalMudasTransplantadas: totais.mudas,
            totalPlantasColhidas: totais.plantas,
            totalEmbalagensProduzidas: totais.embalagens,
            taxaGerminacao: totais.bandejas > 0 ? parseFloat((totais.mudas / totais.bandejas).toFixed(2)) : null,
            taxaTransplantio: totais.mudas > 0 ? parseFloat(((totais.plantas / totais.mudas) * 100).toFixed(2)) : null,
            taxaEmbalagem: totais.plantas > 0 ? parseFloat(((totais.embalagens / totais.plantas) * 100).toFixed(2)) : null,
            taxaGlobal: totais.bandejas > 0 ? parseFloat((totais.embalagens / totais.bandejas).toFixed(2)) : null,
            areas,
          }
        })

        // Ordenar por taxaGlobal descendente
        setores.sort((a, b) => (b.taxaGlobal ?? -Infinity) - (a.taxaGlobal ?? -Infinity))

        // Taxa global média
        const taxasGlobais = setores.map(s => s.taxaGlobal).filter(v => v != null)
        const taxaGlobalMedia = taxasGlobais.length
          ? parseFloat((taxasGlobais.reduce((s, v) => s + v, 0) / taxasGlobais.length).toFixed(2))
          : 0

        return {
          setores,
          totalLotes: lotes.length,
          taxaGlobalMedia,
          periodoInicio: dataInicio.split('T')[0],
          periodoFim: dataFim.split('T')[0],
        }
      },
    })

    // ============================================
    // QUERY: relatorioAgendaTarefas
    // ============================================
    t.field('relatorioAgendaTarefas', {
      type: 'RelatorioAgendaResult',
      args: {
        contaId: nonNull(intArg()),
        filtros: arg({ type: 'RelatorioAgendaFiltros' }),
      },
      resolve: async (_, { contaId, filtros }, { prisma }) => {
        try {
          const service = new MetricasAgendaService(prisma)

          const diasAVencer = filtros?.diasAVencer ?? 7

          // Buscar todas as agendas da conta
          const agendas = await service.buscarAgendas(contaId, {
            usuarioIds: filtros?.usuarioIds,
            loteIds: filtros?.loteIds,
            apenasComAlerta: filtros?.apenasComAlerta,
          })

          // Calcular tarefas vencidas
          const tarefasVencidas = service.calcularTarefasVencidas(agendas).map(a => ({
            id: a.id,
            titulo: a.titulo,
            descricao: a.descricao,
            data: a.data?.toISOString(),
            alerta: a.alerta ?? false,
            usuarioId: a.usuario?.id,
            usuarioNome: a.usuario?.nome,
            loteId: a.lote?.id,
            loteNome: a.lote?.nome,
            setorNome: a.lote?.setor?.nome,
          }))

          // Calcular tarefas a vencer
          const tarefasAVencer = service.calcularTarefasAVencer(agendas, diasAVencer).map(a => ({
            id: a.id,
            titulo: a.titulo,
            descricao: a.descricao,
            data: a.data?.toISOString(),
            alerta: a.alerta ?? false,
            usuarioId: a.usuario?.id,
            usuarioNome: a.usuario?.nome,
            loteId: a.lote?.id,
            loteNome: a.lote?.nome,
            setorNome: a.lote?.setor?.nome,
          }))

          // Calcular taxa de conclusão por lote ativo
          const lotesComTaxaConclusao = await service.calcularTaxaConclusaoPorLote(contaId)

          return {
            diasAVencer,
            geradoEm: new Date().toISOString(),
            tarefasVencidas,
            tarefasAVencer,
            lotesComTaxaConclusao,
          }
        } catch (error) {
          console.error('❌ Erro no resolver relatorioAgendaTarefas:', error)
          throw new InfrastructureError(
            'RELATORIO_AGENDA_FAILED',
            `Falha ao gerar relatório de agenda: ${error.message}`
          )
        }
      },
    })

    // t.list.field('areas', {
    //   type: 'Area',
    //   resolve: (_, __, { prisma }) => {
    //     return prisma.area.findMany()
    //   }
    // })
    // t.crud.user()
    // t.crud.reviews()
    // t.list.field('postsAprovados', {
    //   type: 'Post',
    //   resolve: (_, __, { prisma }) => {
    //     return prisma.post.findMany({
    //       where: { publicado: true },
    //       orderBy: {
    //         createdAt: 'desc'
    //       }
    //     })
    //   }
    // })
    // t.list.field('buscaAutoresPublicados', {
    //   type: 'User',
    //   args: {
    //     email: nonNull(stringArg())
    //   },
    //   resolve: (_, args, { prisma }) => {
    //     console.log(args)
    //     return prisma.user.findMany({
    //       where: {
    //         email: { contains: args.email },
    //         posts: { some: { publicado: true } } //every
    //       }
    //     })
    //   }
    // })
  }
})

module.exports = Query
