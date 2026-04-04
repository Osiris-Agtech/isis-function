const { queryType } = require('@nexus/schema')
const { list, nonNull, intArg, arg } = require('@nexus/schema')

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
      ordering: true
    })
    t.crud.fertilizante()

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
      ordering: true
    })
    t.crud.sNutritiva()

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

        // Produção total (últimos 30 dias)
        const lotesComColheita = lotes.filter(l => l.colheita_data && new Date(l.colheita_data) >= mesAtras)
        const totalPlantasColhidas = lotesComColheita.reduce((sum, l) => 
          sum + (l.plantas_colhidas || 0), 0
        )
        const totalEmbalagensProduzidas = lotesComColheita.reduce((sum, l) => 
          sum + (l.embalagens_produzidas || 0), 0
        )
        
        // Lotes com colheita nos próximos 7 dias
        const lotesComColheitaProxima = lotes.filter(l => {
          if (!l.colheita_data) return false
          const dataColheita = new Date(l.colheita_data)
          return dataColheita >= hoje && dataColheita <= semanaFim
        }).length

        // Período de produção (últimos 30 dias)
        const periodoInicio = mesAtras.toISOString().split('T')[0]
        const periodoFim = hoje.toISOString().split('T')[0]

        // Buscar agendas da conta
        const agendas = await prisma.agenda.findMany({
          where: {
            conta: { id: contaId },
            deleted_at: null,
            finalizado: false,
          },
          select: {
            data: true,
            finalizado: true,
          },
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

        // Distribuição por cultura
        const culturaMap = {}
        lotes.forEach(lote => {
          if (lote.ativo && lote.cultura) {
            const nomeCultura = lote.cultura.nome || 'Sem cultura'
            culturaMap[nomeCultura] = (culturaMap[nomeCultura] || 0) + 1
          }
        })
        
        const culturas = Object.entries(culturaMap)
          .map(([nome, quantidade]) => ({ nome, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 3) // Top 3

        return {
          resumo: {
            totalLotes,
            lotesAtivos,
            lotesFinalizados,
            taxaConclusao,
          },
          tarefas: {
            pendentesHoje: tarefasPendentesHoje,
            pendentesSemana: tarefasPendentesSemana,
            atrasadas: tarefasAtrasadas,
          },
          producao: {
            totalPlantasColhidas,
            totalEmbalagensProduzidas,
            lotesComColheitaProxima,
            periodoInicio,
            periodoFim,
          },
          culturas,
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