const { mutationType, list, nonNull, stringArg, intArg, floatArg } = require('@nexus/schema');
const { booleanArg, arg, inputObjectType } = require('nexus');
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserInputError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UserInputError';
        this.extensions = { code: 'BAD_USER_INPUT' };
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
        this.extensions = { code: 'UNAUTHENTICATED' };
    }
}

class DomainError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'DomainError';
        this.extensions = { code };
    }
}

function normalizeName(name) {
    if (typeof name !== 'string') {
        return '';
    }

    return name.trim();
}

function normalizeFertilizanteNutrientesInput(nutrientes, required) {
    if (nutrientes == null) {
        if (required) {
            throw new DomainError('VALIDATION_ERROR', 'Informe ao menos um nutriente para o fertilizante');
        }
        return null;
    }

    if (!Array.isArray(nutrientes) || nutrientes.length === 0) {
        throw new DomainError('VALIDATION_ERROR', 'Informe ao menos um nutriente para o fertilizante');
    }

    const normalized = nutrientes.map((item) => {
        const nutrienteId = item?.nutrienteId;
        const teorRaw = item?.teorNutriente;
        const teorNutriente = Number(teorRaw);

        if (!Number.isInteger(nutrienteId) || nutrienteId <= 0) {
            throw new DomainError('VALIDATION_ERROR', 'Nutriente inválido no fertilizante');
        }

        if (!Number.isFinite(teorNutriente) || teorNutriente <= 0) {
            throw new DomainError('VALIDATION_ERROR', 'Teor do nutriente deve ser maior que zero');
        }

        return {
            nutrienteId,
            teorNutriente,
        };
    });

    const uniqueIds = new Set(normalized.map((item) => item.nutrienteId));
    if (uniqueIds.size !== normalized.length) {
        throw new DomainError('VALIDATION_ERROR', 'Não é permitido repetir nutriente no mesmo fertilizante');
    }

    return normalized;
}

async function assertNutrientesExist(prisma, nutrientes) {
    const nutrientesIds = [...new Set(nutrientes.map((item) => item.nutrienteId))];
    const existentes = await prisma.nutriente.findMany({
        where: {
            id: {
                in: nutrientesIds,
            },
        },
        select: {
            id: true,
        },
    });

    if (existentes.length !== nutrientesIds.length) {
        throw new DomainError('NOT_FOUND', 'Um ou mais nutrientes não foram encontrados');
    }
}

async function findNameConflict(prisma, contaId, normalizedName, excludeId) {
    if (!normalizedName) {
        return null;
    }

    const conflict = await prisma.$queryRaw`
        SELECT id
        FROM fertilizantes
        WHERE origin = 'CUSTOM'::"FertilizanteOrigin"
          AND fk_contas_id = ${contaId}
          AND deleted_at IS NULL
          AND LOWER(BTRIM(nome)) = LOWER(${normalizedName})
          AND (${excludeId}::int IS NULL OR id <> ${excludeId})
        LIMIT 1
    `;

    return conflict[0] ?? null;
}

function assertCanMutateFertilizante(fertilizante, contaId) {
    if (!fertilizante) {
        throw new DomainError('NOT_FOUND', 'Fertilizante não encontrado');
    }

    if (fertilizante.origin === 'SYSTEM') {
        throw new DomainError('SEED_IMMUTABLE', 'Fertilizante de sistema é imutável');
    }

    if (fertilizante.fk_contas_id !== contaId) {
        throw new DomainError('TENANT_SCOPE_VIOLATION', 'Fertilizante fora do escopo da conta');
    }

    if (fertilizante.deleted_at) {
        throw new DomainError('VALIDATION_ERROR', 'Fertilizante já está deletado');
    }
}

async function getAuthorizedContaIds(prisma, authUserId) {
    if (!Number.isInteger(authUserId)) {
        throw new AuthenticationError('Autenticação obrigatória para operar fertilizantes por conta');
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
    });

    return [
        ...new Set(
            vinculacoes
                .map((vinculo) => vinculo.fk_contas_id)
                .filter(Number.isInteger)
        ),
    ];
}

async function assertContaInTenantScope(prisma, authUserId, contaId) {
    if (!Number.isInteger(contaId)) {
        throw new DomainError('VALIDATION_ERROR', 'contaId inválido');
    }

    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);
    if (!authorizedContaIds.includes(contaId)) {
        throw new DomainError('TENANT_SCOPE_VIOLATION', 'contaId fora do escopo do usuário autenticado');
    }

    return contaId;
}

function isFertilizanteVisibleForTenant(fertilizante, authorizedContaIds) {
    return (
        fertilizante.origin === 'SYSTEM' ||
        (fertilizante.origin === 'CUSTOM' && authorizedContaIds.includes(fertilizante.fk_contas_id))
    );
}

async function assertSolucaoInTenantScope(prisma, solucaoId, authorizedContaIds) {
    if (!Number.isInteger(solucaoId)) {
        throw new DomainError('VALIDATION_ERROR', 'solucaoId inválido');
    }

    const solucao = await prisma.sNutritiva.findFirst({
        where: {
            id: solucaoId,
            solucoes_contas: {
                some: {
                    fk_contas_id: {
                        in: authorizedContaIds,
                    },
                },
            },
        },
        select: {
            id: true,
        },
    });

    if (!solucao) {
        throw new DomainError('TENANT_SCOPE_VIOLATION', 'Solução fora do escopo da conta');
    }

    return solucao.id;
}

const Mutation = mutationType({
    name: 'Mutation',
    definition(t) {
        t.crud.createOneArea()
        t.crud.createOnePessoa()
        t.crud.createOneCargo()
        // t.crud.createOneLocalizacao()
        t.crud.createOneReservatorio()
        t.crud.createOneSetor()
        t.crud.createOneAtividade()
        t.crud.createOneCultura()
        t.crud.createOneSNutritiva()
        t.crud.createOneConcentrada()
        t.crud.createOneNotificacao()
        t.crud.createOneAgenda()
        t.crud.createOneProtocolo()
        t.crud.createOneFase()

        t.field(
            "createOneLocalizacao",
            {
                type: "Localizacao",
                args: {
                    cep: stringArg(),
                    endereco: stringArg(),
                    bairro: stringArg(),
                    cidade: stringArg(),
                    estado: stringArg(),
                    pais: stringArg(),
                    complemento: stringArg(),
                    numero: stringArg(),
                },
                resolve: async (_, args, { prisma }) => {
                    const localizacao = await prisma.localizacao.create({
                        data: {
                            cep: args.cep,
                            endereco: args.endereco,
                            bairro: args.bairro,
                            cidade: args.cidade,
                            estado: args.estado,
                            pais: args.pais,
                            complemento: args.complemento,
                            numero: args.numero,
                        },
                    });

                    return localizacao;
                }
            }
        )

        t.field(
            "updateArea",
            {
                type: "Area",
                args: {
                    areaId: nonNull(intArg()),
                    areaNome: nonNull(stringArg()),
                    areaDescricao: nonNull(stringArg()),
                    areaTipo: nonNull(stringArg()),
                    localizacaoId: nonNull(intArg()),
                    contaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const areaUpdate = await prisma.area.update({
                        where: {
                            id: args.areaId,
                        },
                        data: {
                            nome: args.areaNome,
                            descricao: args.areaDescricao,
                            tipo: args.areaTipo,
                            conta: {
                                connect: {
                                    id: args.contaId
                                }
                            },
                            localizacao: {
                                connect: {
                                    id: args.localizacaoId
                                }
                            },
                        },
                    });

                    return areaUpdate;
                }
            }
        )

        t.field(
            "updateSetor",
            {
                type: "Setor",
                args: {
                    setorId: nonNull(intArg()),
                    setorNome: nonNull(stringArg()),
                    setorDescricao: nonNull(stringArg()),
                    areaId: nonNull(intArg()),
                    reservatorioId: intArg(),
                },
                resolve: async (_, args, { prisma }) => {
                    var data;

                    if(args.reservatorioId != null) {
                        data = {
                            nome: args.setorNome,
                            descricao: args.setorDescricao,
                            area: {
                                connect: {
                                    id: args.areaId
                                }
                            },
                            reservatorio: {
                                connect: {
                                    id: args.reservatorioId
                                }
                            },
                        }
                    } else {
                        data = {
                            nome: args.setorNome,
                            descricao: args.setorDescricao,
                            area: {
                                connect: {
                                    id: args.areaId
                                }
                            },
                        }
                    }

                    const setorUpdate = await prisma.setor.update({
                        where: {
                            id: args.setorId,
                        },
                        data: data,
                    });

                    return setorUpdate;
                }
            }
        )

        t.field(
            "updateReservatorio",
            {
                type: "Reservatorio",
                args: {
                    reservatorioId: nonNull(intArg()),
                    reservatorioNome: nonNull(stringArg()),
                    reservatorioVolume: nonNull(stringArg()),
                    contaId: nonNull(intArg()),
                    solucaoId: intArg(),
                },
                resolve: async (_, args, { prisma, authUserId }) => {
                    const contaId = await assertContaInTenantScope(prisma, authUserId, args.contaId);
                    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);
                    var data;

                    if(args.solucaoId != null) {
                        await assertSolucaoInTenantScope(prisma, args.solucaoId, authorizedContaIds);

                        data = {
                            nome: args.reservatorioNome,
                            volume: args.reservatorioVolume,
                            conta: {
                                connect: {
                                    id: contaId
                                }
                            },
                            solucao: {
                                connect: {
                                    id: args.solucaoId
                                }
                            },
                        }
                    } else {
                        data = {
                            nome: args.reservatorioNome,
                            volume: args.reservatorioVolume,
                        }
                    }

                    const reservatorioUpdate = await prisma.reservatorio.update({
                        where: {
                            id: args.reservatorioId,
                        },
                        data: data,
                    });

                    return reservatorioUpdate;
                }
            }
        )

        t.field(
            "updateLote",
            {
                type: "Lote",
                args: {
                    loteId: nonNull(intArg()),
                    loteNome: nonNull(stringArg()),
                    setorId: nonNull(intArg()),
                    culturaId: nonNull(intArg()),
                    reservatorioId: intArg(),
                    registroData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    semeaduraData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    transplantioData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    colheitaData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    bandeijaSemeadas: intArg(),
                    mudasTransplantadas: intArg(),
                    plantasColhidas: intArg(),
                    embalagensProduzidas: intArg(),
                },
                resolve: async (_, args, { prisma }) => {
                    var data;

                    if (args.reservatorioId != null && args.reservatorioId != undefined) {
                        data = {
                            nome: args.loteNome,
                            registro_data: args.registroData,
                            semeadura_data: args.semeaduraData,
                            transplantio_data: args.transplantioData,
                            colheita_data: args.colheitaData,
                            setor: {
                                connect: {
                                    id: args.setorId
                                }
                            },
                            cultura: {
                                connect: {
                                    id: args.culturaId
                                }
                            },
                            reservatorio: {
                                connect: {
                                    id: args.reservatorioId
                                }
                            }
                        }
                    } else {
                        data = {
                            nome: args.loteNome,
                            registro_data: args.registroData,
                            semeadura_data: args.semeaduraData,
                            transplantio_data: args.transplantioData,
                            colheita_data: args.colheitaData,
                            setor: {
                                connect: {
                                    id: args.setorId
                                }
                            },
                            cultura: {
                                connect: {
                                    id: args.culturaId
                                }
                            },
                        }
                    }

                    if (args.registroData != null && args.registroData != undefined) {
                        data["registro_data"] = args.registroData;
                    }

                    if (args.semeaduraData != null && args.semeaduraData != undefined) {
                        data["semeadura_data"] = args.semeaduraData;
                    }

                    if (args.transplantioData != null && args.transplantioData != undefined) {
                        data["transplantio_data"] = args.transplantioData;
                    }

                    if (args.colheitaData != null && args.colheitaData != undefined) {
                        data["colheita_data"] = args.colheitaData;
                    }
                    
                    if (args.bandeijaSemeadas != null && args.bandeijaSemeadas != undefined) {
                        data["bandeijas_semeadas"] = args.bandeijaSemeadas;
                    }

                    if (args.mudasTransplantadas != null && args.mudasTransplantadas != undefined) {
                        data["mudas_transplantadas"] = args.mudasTransplantadas;
                    }

                    if (args.plantasColhidas != null && args.plantasColhidas != undefined) {
                        data["plantas_colhidas"] = args.plantasColhidas;
                    }

                    if (args.embalagensProduzidas != null && args.embalagensProduzidas != undefined) {
                        data["embalagens_produzidas"] = args.embalagensProduzidas;
                    }
                    console.log(data)

                    const loteUpdate = await prisma.lote.update({
                        where: {
                            id: args.loteId,
                        },
                        data: data,
                    });

                    return loteUpdate;
                }
            }
        )

        t.field(
            "softDeleteLote",
            {
                type: "Lote",
                args: {
                    loteId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const loteUpdate = await prisma.lote.update({
                        where: {
                            id: args.loteId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return loteUpdate;
                }
            }
        )

        t.field(
            "softDeleteArea",
            {
                type: "Area",
                args: {
                    areaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const areaUpdate = await prisma.area.update({
                        where: {
                            id: args.areaId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return areaUpdate;
                }
            }
        )

        t.field(
            "softDeleteConta",
            {
                type: "Conta",
                args: {
                    contaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const contaUpdate = await prisma.conta.update({
                        where: {
                            id: args.contaId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return contaUpdate;
                }
            }
        )

        t.field(
            "softDeleteCultura",
            {
                type: "Cultura",
                args: {
                    culturaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const culturaUpdate = await prisma.cultura.update({
                        where: {
                            id: args.culturaId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return culturaUpdate;
                }
            }
        )

        t.field(
            "softDeleteReservatorio",
            {
                type: "Reservatorio",
                args: {
                    reservatorioId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const reservatorioUpdate = await prisma.reservatorio.update({
                        where: {
                            id: args.reservatorioId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return reservatorioUpdate;
                }
            }
        )

        t.field(
            "softDeleteSetor",
            {
                type: "Setor",
                args: {
                    setorId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const setorUpdate = await prisma.setor.update({
                        where: {
                            id: args.setorId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return setorUpdate;
                }
            }
        )

t.field(
  "softDeleteSNutritiva",
  {
    type: "SNutritiva",
    args: {
      snutritivaId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma, authUserId }) => {
      const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);
      await assertSolucaoInTenantScope(prisma, args.snutritivaId, authorizedContaIds);

      const snutritivaUpdate = await prisma.sNutritiva.update({
        where: {
          id: args.snutritivaId,
        },
        data: { deleted_at: new Date().toISOString() },
      });

      return snutritivaUpdate;
    }
  }
)

t.field(
  "softDeleteAreaCascade",
  {
    type: "Area",
    args: {
      areaId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma }) => {
      return await prisma.$transaction(async (tx) => {
        const area = await tx.area.findUnique({
          where: { id: args.areaId },
          select: { id: true, deleted_at: true },
        });

        if (!area) throw new UserInputError("Area não encontrada");
        if (area.deleted_at) throw new UserInputError("Area já deletada");

        const setores = await tx.setor.findMany({
          where: { fk_areas_id: args.areaId, deleted_at: null },
          select: { id: true },
        });

        const setorIds = setores.map((s) => s.id);

        if (setorIds.length > 0) {
          await tx.lote.updateMany({
            where: { fk_setores_id: { in: setorIds }, deleted_at: null },
            data: { deleted_at: new Date().toISOString() },
          });
        }

        await tx.setor.updateMany({
          where: { fk_areas_id: args.areaId, deleted_at: null },
          data: { deleted_at: new Date().toISOString() },
        });

        return await tx.area.update({
          where: { id: args.areaId },
          data: { deleted_at: new Date().toISOString() },
        });
      });
    },
  }
)

t.field(
  "softDeleteSetorCascade",
  {
    type: "Setor",
    args: {
      setorId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma }) => {
      return await prisma.$transaction(async (tx) => {
        const setor = await tx.setor.findUnique({
          where: { id: args.setorId },
          select: { id: true, deleted_at: true },
        });

        if (!setor) throw new UserInputError("Setor não encontrado");
        if (setor.deleted_at) throw new UserInputError("Setor já deletado");

        await tx.lote.updateMany({
          where: { fk_setores_id: args.setorId, deleted_at: null },
          data: { deleted_at: new Date().toISOString() },
        });

        return await tx.setor.update({
          where: { id: args.setorId },
          data: { deleted_at: new Date().toISOString() },
        });
      });
    },
  }
)

t.field(
  "softDeleteReservatorioCascade",
  {
    type: "Reservatorio",
    args: {
      reservatorioId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma }) => {
      return await prisma.$transaction(async (tx) => {
        const reservatorio = await tx.reservatorio.findUnique({
          where: { id: args.reservatorioId },
          select: { id: true, deleted_at: true },
        });

        if (!reservatorio) throw new UserInputError("Reservatorio não encontrado");
        if (reservatorio.deleted_at) throw new UserInputError("Reservatorio já deletado");

        await tx.lote.updateMany({
          where: { fk_reservatorios_id: args.reservatorioId, deleted_at: null },
          data: { deleted_at: new Date().toISOString() },
        });

        return await tx.reservatorio.update({
          where: { id: args.reservatorioId },
          data: { deleted_at: new Date().toISOString() },
        });
      });
    },
  }
)

t.field(
  "softDeleteSNutritivaCascade",
  {
    type: "SNutritiva",
    args: {
      snutritivaId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma, authUserId }) => {
      const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);

      return await prisma.$transaction(async (tx) => {
        await assertSolucaoInTenantScope(tx, args.snutritivaId, authorizedContaIds);

        const snutritiva = await tx.sNutritiva.findUnique({
          where: { id: args.snutritivaId },
          select: { id: true, deleted_at: true },
        });

        if (!snutritiva) throw new UserInputError("SNutritiva não encontrada");
        if (snutritiva.deleted_at) throw new UserInputError("SNutritiva já deletada");

        const reservatorios = await tx.reservatorio.findMany({
          where: { fk_snutritivas_id: args.snutritivaId, deleted_at: null },
          select: { id: true },
        });

        const reservatorioIds = reservatorios.map((r) => r.id);

        if (reservatorioIds.length > 0) {
          await tx.lote.updateMany({
            where: { fk_reservatorios_id: { in: reservatorioIds }, deleted_at: null },
            data: { deleted_at: new Date().toISOString() },
          });
        }

        await tx.reservatorio.updateMany({
          where: { fk_snutritivas_id: args.snutritivaId, deleted_at: null },
          data: { deleted_at: new Date().toISOString() },
        });

        return await tx.sNutritiva.update({
          where: { id: args.snutritivaId },
          data: { deleted_at: new Date().toISOString() },
        });
      });
    },
  }
)

t.field(
  "softDeleteProtocoloCascade",
  {
    type: "Protocolo",
    args: {
      protocoloId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma }) => {
      return await prisma.$transaction(async (tx) => {
        const protocolo = await tx.protocolo.findUnique({
          where: { id: args.protocoloId },
          select: { id: true, deleted_at: true },
        });

        if (!protocolo) throw new UserInputError("Protocolo não encontrado");
        if (protocolo.deleted_at) throw new UserInputError("Protocolo já deletado");

        await tx.lote.updateMany({
          where: { fk_protocolos_id: args.protocoloId, deleted_at: null },
          data: { deleted_at: new Date().toISOString() },
        });

        return await tx.protocolo.update({
          where: { id: args.protocoloId },
          data: { deleted_at: new Date().toISOString() },
        });
      });
    },
  }
)

t.field(
  "softDeleteAgenda",
            {
                type: "Agenda",
                args: {
                    agendaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const agendaUpdate = await prisma.agenda.update({
                        where: {
                            id: args.agendaId,
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return agendaUpdate;
                }
            }
        )

        t.field(
            "softDeleteAgendaList",
            {
                type: "Int",
                args: {
                    agendasId: list(nonNull(intArg())),
                },
                resolve: async (_, args, { prisma }) => {
                    const agendasUpdated = await prisma.agenda.updateMany({
                        where: {
                            id: {
                                in: args.agendasId,
                            }
                        },
                        data: { deleted_at: new Date().toISOString() },
                    });

                    return agendasUpdated.count;
                }
            }
        )

        t.field(
            "updateUsuario",
            {
                type: "Usuario",
                args: {
                    userId: nonNull(intArg()),
                    contaId: nonNull(intArg()),
                    cargoId: nonNull(intArg()),
                    ativo: nonNull(booleanArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const usuarioUpdate = await prisma.usuario.update({
                        where: {
                            id: args.userId,
                        },
                        data: {
                            ativo: args.ativo,
                        },
                    });

                    await prisma.conectaConta.updateMany({
                        where: {
                            fk_usuarios_id: args.userId,
                            fk_contas_id: args.contaId
                        },
                        data: {
                            fk_cargos_id: args.cargoId,
                        },
                    });

                    return usuarioUpdate;
                }
            }
        )

        t.field(
            "updateUsuarioPassword",
            {
                type: "Usuario",
                args: {
                    userId: nonNull(intArg()),
                    novaSenha: nonNull(stringArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const hashedPassword = await bcrypt.hash(args.novaSenha, 10);
                    const usuarioUpdate = await prisma.usuario.update({
                        where: {
                            id: args.userId,
                        },
                        data: {
                            senha: hashedPassword,
                        },
                    });

                    return usuarioUpdate;
                }
            }
        )

        t.field(
            "duplicateSNutritiva",
            {
                type: "SNutritiva",
                args: {
                    solucaoId: nonNull(intArg()),
                    contaId: nonNull(intArg())
                },
                resolve: async (_, args, { prisma, authUserId }) => {
                    const contaId = await assertContaInTenantScope(prisma, authUserId, args.contaId);
                    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);
                    await assertSolucaoInTenantScope(prisma, args.solucaoId, authorizedContaIds);

                    const snutritiva = await prisma.sNutritiva.findMany({
                        where: {
                          id: args.solucaoId,
                          solucoes_contas: {
                            some: {
                                fk_contas_id: {
                                    in: authorizedContaIds,
                                },
                            },
                          },
                        },
                        include: {
                            solucoes_fertilizantes_concentradas: true
                        }
                    });

                    if (snutritiva.length === 0) {
                        throw new DomainError('TENANT_SCOPE_VIOLATION', 'Solução fora do escopo da conta');
                    }

                    var solucaoFertilizantes = [];
                    for (const object of snutritiva[0].solucoes_fertilizantes_concentradas) {
                        const fertilizanteId = Number(object.fk_fertilizantes_id);
                        const fertilizante = await prisma.fertilizante.findUnique({
                            where: {
                                id: fertilizanteId,
                            },
                            select: {
                                id: true,
                                origin: true,
                                fk_contas_id: true,
                                deleted_at: true,
                            },
                        });

                        if (!fertilizante || fertilizante.deleted_at || !isFertilizanteVisibleForTenant(fertilizante, authorizedContaIds)) {
                            throw new DomainError('TENANT_SCOPE_VIOLATION', 'Fertilizante da solução fora do escopo da conta');
                        }

                        if(object.fk_concentradas_id != null) {
                            solucaoFertilizantes.push({
                                quantidade: Number(object.quantidade),
                                fertilizante: {
                                    connect: {
                                        id: fertilizanteId
                                    }
                                },
                                concentrada: {
                                    connect: {
                                        id: object.fk_concentradas_id
                                    }
                                }
                            });
                        } else {
                            solucaoFertilizantes.push({
                                quantidade: Number(object.quantidade),
                                fertilizante: {
                                    connect: {
                                        id: fertilizanteId
                                    }
                                },
                            });
                        }
                    }
                    console.log(solucaoFertilizantes);
                    var data = {
                        c_eletrica: Number(snutritiva[0].c_eletrica),
                        nome: String(snutritiva[0].nome),
                        solucoes_contas: {
                            create: [
                              {
                                conta_original: 1,
                                conta: {
                                  connect: {
                                    id: contaId
                                  }
                                }
                              }
                            ]
                        },
                        solucoes_fertilizantes_concentradas: {
                            create: [
                              ...solucaoFertilizantes
                            ]
                          }
                    };

                    const novaSNutritiva = await prisma.sNutritiva.create({
                        data: data,
                        include: {
                            solucoes_fertilizantes_concentradas: true
                        }
                    });
                    console.log(novaSNutritiva);
                    return novaSNutritiva;
                }
            }
        )

        t.field(
            "migrarLote",
            {
                type: "Lote",
                args: {
                    loteId: nonNull(intArg()),
                    setorId: nonNull(intArg()),
                    novoReservatorioId: intArg(),
                },
                resolve: async (_, args, { prisma }) => {
                    var data;

                    if(args.novoReservatorioId != null) {
                        data = {
                            setor: {
                                connect: {
                                    id: args.setorId
                                }
                            },
                            reservatorio: {
                                connect: {
                                    id: args.novoReservatorioId
                                }
                            },
                        }
                    } else {
                        data = {
                            setor: {
                                connect: {
                                    id: args.setorId
                                }
                            },
                        }
                    }

                    const loteMigrado = await prisma.lote.update({
                        where: {
                            id: args.loteId,
                        },
                        data: data,
                    });

                    return loteMigrado;
                }
            }
        )

        t.string(
            "sendEmail",
            {
                args: {
                    email: nonNull(stringArg()),
                    subject: nonNull(stringArg()),
                    html: nonNull(stringArg()),
                },
                resolve: async (_, args, __) => {
                    const gmailUser = process.env.GMAIL_USER;
                    const gmailPassword = process.env.GMAIL_PASSWORD;

                    if (!gmailUser || !gmailPassword) {
                        throw new Error('GMAIL_USER ou GMAIL_PASSWORD não definidos nas variáveis de ambiente');
                    }

                    // create reusable transporter object using the default SMTP transport
                    let transporter = nodemailer.createTransport({
                        service: "Gmail",
                        auth: {
                            user: gmailUser,
                            pass: gmailPassword,
                        }
                    });

                    try {
                        let info = await transporter.sendMail({
                            from: `"Osiris Agtech 🌱" <${gmailUser}>`,
                            to: args.email,
                            subject: args.subject,
                            html: args.html,
                        });
                        console.log("Message sent: %s", info);
                    } catch (error) {
                        console.log(error);
                        throw new Error("Falha ao enviar e-mail");
                    }
                    console.log('Closing Transport');
                    transporter.close();

                    console.log("Message sent: %s", info);
                    return "Sucesso";
                }
            }
        )

        t.field(
            "inviteContributor",
            {
                type: "Usuario",
                args: {
                    nome: nonNull(stringArg()),
                    sobrenome: nonNull(stringArg()),
                    email: nonNull(stringArg()),
                    cargoId: nonNull(intArg()),
                    contaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {

                    const buscarUsuario = await prisma.usuario.findMany({
                        where: {
                            email: args.email,
                        },
                        include: {
                            contas: true,
                        },
                    });
                    console.log(buscarUsuario);

                    if (!(buscarUsuario.length === 0)) {
                        // ## Verificar primeiro se já existe essa conexão
                        var indexConta = buscarUsuario[0].contas.findIndex(function (x) {
                            console.log(x);
                            return x.fk_contas_id === args.contaId;
                        })
                        if (indexConta != -1) {
                            console.log("##### JÁ EXISTE ESTA CONEXÃO #####")

                            const conectaContaCargoUser = await prisma.ConectaConta.update({
                                where: {
                                    id: buscarUsuario[0].contas[indexConta].id,
                                },
                                data: {
                                    cargo: {
                                        connect: {
                                            id: args.cargoId,
                                        }
                                    }
                                },
                                include: {
                                    conta: true,
                                    cargo: true,
                                },
                            });

                            const infoAcesso = { ...buscarUsuario[0], conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo };
                            console.log(infoAcesso);
                            return infoAcesso;
                        }

                        console.log("##### CONEXÃO NÃO EXISTE #####")
                        const conectaContaCargoUser = await prisma.ConectaConta.create({
                            data: {
                                conta: {
                                    connect: {
                                        id: args.contaId,
                                    }
                                },
                                usuario: {
                                    connect: {
                                        id: buscarUsuario[0].id,
                                    }
                                },
                                cargo: {
                                    connect: {
                                        id: args.cargoId,
                                    }
                                }
                            },
                            include: {
                                conta: true,
                                cargo: true,
                            },
                        });

                        const contaInvited = await prisma.conta.findUnique({
                            where: {
                                id: args.contaId,
                            },
                        });

                        const cargoInvited = await prisma.cargo.findUnique({
                            where: {
                                id: args.cargoId,
                            },
                        });

                        const gmailUser = process.env.GMAIL_USER;
                        const gmailPassword = process.env.GMAIL_PASSWORD;

                        if (!gmailUser || !gmailPassword) {
                            throw new Error('GMAIL_USER ou GMAIL_PASSWORD não definidos');
                        }

                        let transporter = nodemailer.createTransport({
                            service: "Gmail",
                            auth: {
                                user: gmailUser,
                                pass: gmailPassword,
                            }
                        });

                        let info = await transporter.sendMail({
                            from: `"Osiris Agtech 🌱" <${gmailUser}>`,
                            to: args.email,
                            subject: 'Adicionado colaborador ✔',
                            html: 'Você foi adicionado a conta ' + contaInvited.nome + ' com o cargo ' + cargoInvited.cargo + '. \n\nAcesse ao aplicativo Osiris para mais informações.',
                        });
                        console.log('Message sent successfully!');
                        console.log('Server responded with "%s"', info.response);
                        console.log('Closing Transport');
                        transporter.close();

                        const infoAcesso = { ...buscarUsuario[0], conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo };
                        console.log(infoAcesso);
                        return infoAcesso;
                    } else {
                        // Create Pessoa
                        let pessoa;
                        let conta;
                        let usuario;
                        let conectaContaCargoUser;
                        
                        pessoa = await prisma.pessoa.create({
                        data: {
                            nome: args.nome,
                            sobrenome: args.sobrenome,
                        },
                        select: {
                            id: true,
                        }
                    });

                    // # Criar a Conta
                    conta = await prisma.conta.create({
                        data: {
                            nome: args.nome,
                            nivel: "1",
                        },
                        select: {
                            id: true,
                        }
                    });
                    console.log(conta)

                    //generate password
                    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    var passwordLength = 8;
                    var password = "";

                    for (var i = 0; i <= passwordLength; i++) {
                        var randomNumber = Math.floor(Math.random() * chars.length);
                        password += chars.substring(randomNumber, randomNumber + 1);
                    }

                    // # Criar o Usuário
                    const hashedPassword = await bcrypt.hash(password, 10);
                    usuario = await prisma.usuario.create({
                        data: {
                            nome: args.nome,
                            email: args.email,
                            senha: hashedPassword,
                            pessoa: {
                                connect: {
                                    id: pessoa.id,
                                }
                            }
                        },
                    });
                    console.log(usuario)

                    await prisma.ConectaConta.create({
                        data: {
                            conta: {
                                connect: {
                                    id: args.contaId,
                                }
                            },
                            usuario: {
                                connect: {
                                    id: usuario.id,
                                }
                            },
                            cargo: {
                                connect: {
                                    id: args.cargoId,
                                }
                            }
                        },
                        include: {
                            conta: true,
                            cargo: true,
                        },
                    })

                    // # Garantir que o cargo Owner existe
                    let cargoOwner = await prisma.cargo.findUnique({
                        where: { id: 1 }
                    });

                    if (!cargoOwner) {
                        cargoOwner = await prisma.cargo.create({
                            data: {
                                id: 1,
                                cargo: 'Owner'
                            }
                        });
                        console.log('Cargo Owner criado:', cargoOwner);
                    }

                    // # Conecta a Conta criada com o Usuário criado e atribui o Cargo de Owner (Dono)
                    conectaContaCargoUser = await prisma.ConectaConta.create({
                        data: {
                            conta: {
                                connect: {
                                    id: conta.id,
                                }
                            },
                            usuario: {
                                connect: {
                                    id: usuario.id,
                                }
                            },
                            cargo: {
                                connect: {
                                    id: cargoOwner.id,
                                }
                            }
                        },
                        include: {
                            conta: true,
                            cargo: true,
                        },
                    })
                    console.log(conectaContaCargoUser)

                    /// CADASTRA SOLUÇÕES NUTRITIVAS INICIAIS PARA O NOVO USUÁRIO
                    // IDs das soluções padrão do sistema (serão migradas para seed/fixture)
                    const solucoesIniciais = [12, 13, 14, 15, 16];

                    for (const solucaoId of solucoesIniciais) {
                        const snutritiva = await prisma.sNutritiva.findMany({
                            where: {
                              id: solucaoId,
                            },
                            include: {
                                solucoes_fertilizantes_concentradas: true
                            }
                        });

                        if (!snutritiva.length) {
                            console.log(`SNutritiva id=${solucaoId} não encontrada, pulando...`);
                            continue;
                        }
                        var solucaoFertilizantes = [];
                        for (const object of snutritiva[0].solucoes_fertilizantes_concentradas) {
                            if(object.fk_concentradas_id != null) {
                                solucaoFertilizantes.push({
                                    quantidade: Number(object.quantidade),
                                    fertilizante: {
                                        connect: {
                                            id: Number(object.fk_fertilizantes_id)
                                        }
                                    },
                                    concentrada: {
                                        connect: {
                                            id: object.fk_concentradas_id
                                        }
                                    }
                                });
                            } else {
                                solucaoFertilizantes.push({
                                    quantidade: Number(object.quantidade),
                                    fertilizante: {
                                        connect: {
                                            id: Number(object.fk_fertilizantes_id)
                                        }
                                    },
                                });
                            }
                        }
                        console.log(solucaoFertilizantes);
                        var data = {
                            c_eletrica: Number(snutritiva[0].c_eletrica),
                            nome: String(snutritiva[0].nome),
                            solucoes_contas: {
                                create: [
                                {
                                    conta_original: 1,
                                    conta: {
                                    connect: {
                                        id: conta.id
                                    }
                                    }
                                }
                                ]
                            },
                            solucoes_fertilizantes_concentradas: {
                                create: [
                                ...solucaoFertilizantes
                                ]
                            }
                        };

                        const novaSNutritiva = await prisma.sNutritiva.create({
                            data: data,
                            include: {
                                solucoes_fertilizantes_concentradas: true
                            }
                        });
                        console.log(novaSNutritiva);
                    }

                    const contaInvited = await prisma.conta.findUnique({
                        where: {
                            id: args.contaId,
                        },
                    });

                    const cargoInvited = await prisma.cargo.findUnique({
                        where: {
                            id: args.cargoId,
                        },
                    });

                    const gmailUser = process.env.GMAIL_USER;
                    const gmailPassword = process.env.GMAIL_PASSWORD;

                    if (!gmailUser || !gmailPassword) {
                        throw new Error('GMAIL_USER ou GMAIL_PASSWORD não definidos');
                    }

                    let transporter = nodemailer.createTransport({
                        service: "Gmail",
                        auth: {
                            user: gmailUser,
                            pass: gmailPassword,
                        }
                    });

                    let info = await transporter.sendMail({
                        from: `"Osiris Agtech 🌱" <${gmailUser}>`,
                        to: args.email,
                        subject: 'Adicionado colaborador ✔',
                        html: 'Você foi adicionado a conta ' + contaInvited.nome + ' com o cargo ' + cargoInvited.cargo + '. \n\nAcesse ao aplicativo Osiris com seu e-mail e a senha "' + password + '" para ter acesso.',
                    });
                    console.log('Message sent successfully!');
                    console.log('Server responded with "%s"', info.response);
                    console.log('Closing Transport');
                    transporter.close();

                    const infoAcesso = { ...usuario, conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo };
                    console.log(infoAcesso);
                    return infoAcesso;
                    }
                }
            }
        )

        t.field(
            "createUserAccount",
            {
                type: "Usuario",
                args: {
                    // Pessoa
                    nome: nonNull(stringArg()),
                    sobrenome: nonNull(stringArg()),
                    telefone: stringArg(),
                    imagem: stringArg(),

                    // Localização
                    cep: stringArg(),
                    endereco: stringArg(),
                    bairro: stringArg(),
                    cidade: stringArg(),
                    estado: stringArg(),
                    pais: stringArg(),
                    complemento: stringArg(),

                    // Conta
                    nivelConta: nonNull(stringArg()),
                    imagemConta: stringArg(),
                    cnpjConta: stringArg(),

                    // Usuário
                    email: nonNull(stringArg()),
                    senha: nonNull(stringArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    console.log(args);
                    var localizacao = null;
                    if (args.cep || args.endereco || args.bairro || args.cidade || args.estado || args.pais || args.complemento) {
                        // # Criar a Localização
                        console.log("Entrou Localização")
                        localizacao = await prisma.localizacao.create({
                            data: {
                                cep: args.cep,
                                endereco: args.endereco,
                                bairro: args.bairro,
                                cidade: args.cidade,
                                estado: args.estado,
                                pais: args.pais,
                                complemento: args.complemento,
                            },
                            select: {
                                id: true,
                            }
                        });
                    }

                    // # Criar a Pessoa
                    var pessoa;
                    if (localizacao == null) {
                        console.log("Entrou Pessoa Sem Localização")
                        pessoa = await prisma.pessoa.create({
                            data: {
                                nome: args.nome,
                                sobrenome: args.sobrenome,
                                telefone: args.telefone,
                                imagem: args.imagemPessoa,
                            },
                            select: {
                                id: true,
                            }
                        });
                    } else {
                        console.log("Entrou Pessoa Com Localização")
                        pessoa = await prisma.pessoa.create({
                            data: {
                                nome: args.nome,
                                sobrenome: args.sobrenome,
                                telefone: args.telefone,
                                imagem: args.imagemPessoa,
                                localizacao: {
                                    connect: {
                                        id: localizacao.id,
                                    }
                                }
                            },
                            select: {
                                id: true,
                            }
                        });
                    }

                    console.log(pessoa)
                    // # Criar a Conta
                    const conta = await prisma.conta.create({
                        data: {
                            nome: args.nome,
                            nivel: args.nivelConta,
                            imagem: args.imagemConta,
                            cnpj: args.cnpjConta,
                        },
                        select: {
                            id: true,
                        }
                    });
                    console.log(conta)

                    // # Criar o Usuário
                    const hashedSenha = await bcrypt.hash(args.senha, 10);
                    const usuario = await prisma.usuario.create({
                        data: {
                            nome: args.nome,
                            email: args.email,
                            senha: hashedSenha,
                            pessoa: {
                                connect: {
                                    id: pessoa.id,
                                }
                            }
                        },
                        select: {
                            id: true,
                            nome: true,
                            email: true,
                        }
                    });
                    console.log(usuario)

                    // # Garantir que o cargo Owner existe
                    let cargoOwner = await prisma.cargo.findUnique({
                        where: { id: 1 }
                    });

                    if (!cargoOwner) {
                        cargoOwner = await prisma.cargo.create({
                            data: {
                                id: 1,
                                cargo: 'Owner'
                            }
                        });
                        console.log('Cargo Owner criado:', cargoOwner);
                    }

                    // # Conecta a Conta criada com o Usuário criado e atribui o Cargo de Owner (Dono)
                    const conectaContaCargoUser = await prisma.ConectaConta.create({
                        data: {
                            conta: {
                                connect: {
                                    id: conta.id,
                                }
                            },
                            usuario: {
                                connect: {
                                    id: usuario.id,
                                }
                            },
                            cargo: {
                                connect: {
                                    id: cargoOwner.id,
                                }
                            }
                        },
                        include: {
                            conta: true,
                            cargo: true,
                        },
                    })
                    console.log(conectaContaCargoUser)

                    /// CADASTRA SOLUÇÕES NUTRITIVAS INICIAIS PARA O NOVO USUÁRIO
                    // IDs das soluções padrão do sistema (serão migridas para seed/fixture)
                    const solucoesIniciais = [12, 13, 14, 15, 16];

                    for (const solucaoId of solucoesIniciais) {
                        const snutritiva = await prisma.sNutritiva.findMany({
                            where: {
                              id: solucaoId,
                            },
                            include: {
                                solucoes_fertilizantes_concentradas: true
                            }
                        });

                        if (!snutritiva.length) {
                            console.log(`SNutritiva id=${solucaoId} não encontrada, pulando...`);
                            continue;
                        }
                        var solucaoFertilizantes = [];
                        for (const object of snutritiva[0].solucoes_fertilizantes_concentradas) {
                            if(object.fk_concentradas_id != null) {
                                solucaoFertilizantes.push({
                                    quantidade: Number(object.quantidade),
                                    fertilizante: {
                                        connect: {
                                            id: Number(object.fk_fertilizantes_id)
                                        }
                                    },
                                    concentrada: {
                                        connect: {
                                            id: object.fk_concentradas_id
                                        }
                                    }
                                });
                            } else {
                                solucaoFertilizantes.push({
                                    quantidade: Number(object.quantidade),
                                    fertilizante: {
                                        connect: {
                                            id: Number(object.fk_fertilizantes_id)
                                        }
                                    },
                                });
                            }
                        }
                        console.log(solucaoFertilizantes);
                        var data = {
                            c_eletrica: Number(snutritiva[0].c_eletrica),
                            nome: String(snutritiva[0].nome),
                            solucoes_contas: {
                                create: [
                                {
                                    conta_original: 1,
                                    conta: {
                                    connect: {
                                        id: conta.id
                                    }
                                    }
                                }
                                ]
                            },
                            solucoes_fertilizantes_concentradas: {
                                create: [
                                ...solucaoFertilizantes
                                ]
                            }
                        };

                        const novaSNutritiva = await prisma.sNutritiva.create({
                            data: data,
                            include: {
                                solucoes_fertilizantes_concentradas: true
                            }
                        });
                        console.log(novaSNutritiva);
                    }

                    const infoAcesso = { ...usuario, conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo };
                    console.log(infoAcesso);
                    return infoAcesso;
                }
            }
        )

        t.field(
            "createOneLote",
            {
                type: "Lote",
                args: {
                    nome: nonNull(stringArg()),
                    registroData: nonNull(
                        arg({
                            type: 'DateTime',
                            description: 'String de data e hora no formato ISO-8601',
                        })
                    ),
                    semeaduraData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    transplantioData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    colheitaData: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    setorId: nonNull(intArg()),
                    culturaId: nonNull(intArg()),
                    reservatorioId: intArg(),
                    protocoloId: intArg(),
                    contaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    var data = {}
                    var loteCreated;

                    if (args.reservatorioId != null) {
                        data = {
                            nome: args.nome,
                            ativo: true,
                            registro_data: args.registroData,
                            semeadura_data: args.semeaduraData,
                            transplantio_data: args.transplantioData,
                            colheita_data: args.colheitaData,
                            setor: {
                                connect: {
                                    id: args.setorId
                                }
                            },
                            cultura: {
                                connect: {
                                    id: args.culturaId
                                }
                            },
                            reservatorio: {
                                connect: {
                                    id: args.reservatorioId
                                }
                            }
                        }
                    } else {
                        data = {
                            nome: args.nome,
                            ativo: true,
                            registro_data: args.registroData,
                            semeadura_data: args.semeaduraData,
                            transplantio_data: args.transplantioData,
                            colheita_data: args.colheitaData,
                            setor: {
                                connect: {
                                    id: args.setorId
                                }
                            },
                            cultura: {
                                connect: {
                                    id: args.culturaId
                                }
                            },
                        }
                    }

                    if (args.protocoloId != null && args.protocoloId != undefined) {
                        data["protocolo"] = {
                            connect: {
                                id: args.protocoloId
                            }
                        }
                    }

                    loteCreated = await prisma.lote.create({
                        data: data,
                        include: {
                            protocolo: true,
                            setor: true,
                        }
                    });

                    if(loteCreated.protocolo != null && loteCreated.protocolo != undefined) {
                        var protocoloVinculado = await prisma.protocolo.findUnique({
                            where: {
                                id: loteCreated.protocolo.id,
                            },
                            include: {
                                acoes: true,
                            }
                        });

                        if(protocoloVinculado != null && protocoloVinculado != undefined  && protocoloVinculado.acoes != null && protocoloVinculado.acoes != undefined && protocoloVinculado.acoes.length > 0) {
                            for(const acao of protocoloVinculado.acoes) {
                                await prisma.agenda.create({
                                    data: {
                                        titulo: acao.titulo,
                                        descricao: acao.descricao,
                                        alerta: acao.alerta,
                                        data: addDays(substractDays(new Date(), 1), acao.duracao_dias_real).toISOString(),
                                        finalizado: false,
                                        ativo: true,
                                        lote: {
                                            connect: {
                                                id: loteCreated.id,
                                            }
                                        },
                                        conta: {
                                            connect: {
                                                id: args.contaId,
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }

                    console.log(loteCreated);
                    return loteCreated;
                }
            }
        )

        t.field(
            "markAsDone",
            {
                type: "Agenda",
                args: {
                    agendaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {

                    const agenda = await prisma.agenda.update({
                        where: {
                            id: args.agendaId,
                        },
                        data: {
                            finalizado: true,
                        }
                    });

                    return agenda;
                }
            }
        )

        t.field(
            "updateAgenda",
            {
                type: "Agenda",
                args: {
                    agendaId: nonNull(intArg()),
                    titulo: stringArg(),
                    descricao: stringArg(),
                    data: arg({
                        type: 'DateTime',
                        description: 'String de data e hora no formato ISO-8601',
                    }),
                    usuarioId: intArg(),
                },
                resolve: async (_, args, { prisma }) => {

                    const agenda = await prisma.agenda.update({
                        where: {
                            id: args.agendaId,
                        },
                        data: {
                            titulo: args.titulo,
                            descricao: args.descricao,
                            data: args.data,
                            usuario: {
                                connect: {
                                    id: args.usuarioId
                                }
                            }
                        }
                    });

                    return agenda;
                }
            }
        )

        t.field(
            "updateProtocolo",
            {
                type: "Protocolo",
                args: {
                    input: nonNull(stringArg())
                },
                resolve: async (_, { input }, { prisma }) => {
                    var protocoloRetornado;
                    var protocoloAtualizado = JSON.parse(input);
                    console.log(protocoloAtualizado);

                    const protocoloAntigo = await prisma.protocolo.findUnique({
                        where: {
                            id: protocoloAtualizado.id,
                        },
                        include: {
                            acoes: true,
                            cultura: true,
                        }
                    });

                    // # Deletar ações que não existem mais
                    for (const acao of protocoloAntigo.acoes) {
                        var indexAcao = protocoloAtualizado.acoes.findIndex(function (x) {
                            return x.id === acao.id;
                        })
                        if (indexAcao == -1) {
                            await prisma.acao.delete({
                                where: {
                                    id: acao.id,
                                },
                            });
                        }
                    }

                    // # Atualizar ações existentes
                    for (const acao of protocoloAtualizado.acoes) {
                        var indexAcao = protocoloAntigo.acoes.findIndex(function (x) {
                            return x.id === acao.id;
                        })
                        if (indexAcao != -1) {
                            var dataAtualizarAcao = {
                                nome: acao.nome,
                                descricao: acao.descricao,
                                tipo: acao.tipo,
                                data: acao.data,
                                updated_at: new Date().toISOString(),
                                fase: {
                                    connect: {
                                        id: acao.faseId,
                                    }
                                }
                            }

                            if (acao.fase.id != null && acao.fase.id != undefined) {
                                dataAtualizarAcao["fase"] = {
                                    connect: {
                                        id: acao.fase.id,
                                    }
                                }
                            }

                            await prisma.acao.update({
                                where: {
                                    id: acao.id,
                                },
                                data: dataAtualizarAcao
                            });
                        }
                    }

                    // # Criar novas ações
                    for (const acao of protocoloAtualizado.acoes) {
                        if (acao.id == null || acao.id == undefined) {
                            var dataNovaAcao = {
                                titulo: acao.titulo,
                                descricao: acao.descricao,
                                alerta: acao.alerta,
                                duracao_dias: acao.duracao_dias,
                                duracao_dias_real: acao.duracao_dias_real,
                                updated_at: new Date().toISOString(),
                                protocolo: {
                                    connect: {
                                        id: protocoloAtualizado.id,
                                    }
                                },
                            }

                            if (acao.fase != null && acao.fase != undefined && acao.fase.id != null && acao.fase.id != undefined) {
                                dataNovaAcao["fase"] = {
                                    connect: {
                                        id: acao.fase.id,
                                    }
                                }
                            }

                            await prisma.acao.create({
                                data: dataNovaAcao,
                            });
                        }
                    }

                    var dataAtualizarProtocolo = {
                        nome: protocoloAtualizado.nome,
                        descricao: protocoloAtualizado.descricao,
                        tipo_cultura: protocoloAtualizado.tipo_cultura,
                        sistema_cultivo: protocoloAtualizado.sistema_cultivo,
                        implantacao: protocoloAtualizado.implantacao,
                    }
                    if(protocoloAtualizado.cultura != null && protocoloAtualizado.cultura != undefined) {
                        dataAtualizarProtocolo["cultura"] = {
                            connect: {
                                id: protocoloAtualizado.cultura.id,
                            }
                        }
                    }

                    protocoloRetornado = await prisma.protocolo.update({
                        where: {
                            id: protocoloAtualizado.id,
                        },
                        data: dataAtualizarProtocolo,
                        include: {
                            acoes: true,
                            cultura: true,
                        }
                    });
                    console.log(protocoloRetornado);
                    return protocoloRetornado;
                }
            }
        )

        t.field(
            "finalizarAgendas",
            {
                type: "Int",
                args: {
                    agendasId: list(nonNull(intArg())),
                },
                resolve: async (_, args, { prisma }) => {

                    const agenda = await prisma.agenda.updateMany({
                        where: {
                            id: {
                                in: args.agendasId,
                            }
                        },
                        data: {
                            finalizado: true,
                        }
                    });

                    return agenda.count;
                }
            }
        )

        t.field(
            "finalizarLotes",
            {
                type: "Int",
                args: {
                    lotesId: list(nonNull(intArg())),
                    plantasColhidas: list(nonNull(intArg())),
                    embalagensProduzidas: list(nonNull(intArg())),
                },
                resolve: async (_, args, { prisma }) => {
                    console.log(args.lotesId);
                    console.log(args.plantasColhidas);
                    console.log(args.embalagensProduzidas);

                    for (var i = 0; i < args.lotesId.length; i++) {
                        await prisma.lote.update({
                            where: {
                                id: args.lotesId[i],
                            },
                            data: {
                                ativo: false,
                                colheita_data: new Date().toISOString(),
                                plantas_colhidas: args.plantasColhidas[i],
                                embalagens_produzidas: args.embalagensProduzidas[i],
                            }
                        });
                    }

                    return args.lotesId.length;
                }
            }
        )

t.field(
  "login",
  {
    type: "LoginResponse",
    args: {
      email: stringArg(),
      senha: nonNull(stringArg()),
      codigo: stringArg(),
    },
    resolve: async (_, args, { prisma }) => {
      try {
        // Validação: pelo menos senha deve ser fornecida
        if (!args.senha) {
          throw new UserInputError('Senha é obrigatória');
        }

        // Validação: ao menos um identificador (email ou codigo) deve ser fornecido
        if (!args.email && !args.codigo) {
          throw new UserInputError('Email ou código de acesso é obrigatório');
        }

        let usuario = null;

        // Priorizar email quando ambos estão presentes
        if (args.email) {
          usuario = await prisma.usuario.findFirst({
            where: {
              email: args.email
            }
          });
        } else if (args.codigo) {
          usuario = await prisma.usuario.findFirst({
            where: {
              cod_acesso: args.codigo
            }
          });
        }

        if (!usuario) {
          throw new AuthenticationError('Credenciais inválidas');
        }

        // Verificar se o usuário está ativo
        if (!usuario.ativo) {
          throw new AuthenticationError('Usuário inativo');
        }

        // Verificar se o usuário tem senha cadastrada
        if (!usuario.senha) {
          throw new AuthenticationError('Credenciais inválidas');
        }

        // Verificar a senha
        const senhaValida = await bcrypt.compare(args.senha, usuario.senha);
        if (!senhaValida) {
          throw new AuthenticationError('Credenciais inválidas');
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new AuthenticationError('Configuração de autenticação inválida: JWT_SECRET ausente');
        }

        // Gerar token JWT
        const token = jwt.sign(
          {
            id: usuario.id,
            email: usuario.email,
            nome: usuario.nome
          },
          jwtSecret,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        return {
          token,
          usuario
        };
      } catch (error) {
        console.error('Erro no serviço ao fazer login:', error);
        throw error;
      }
    }
  }
)

t.field(
  "createFertilizante",
  {
    type: "Fertilizante",
    args: {
      contaId: nonNull(intArg()),
      input: nonNull(arg({ type: "CreateFertilizanteInput" })),
    },
    resolve: async (_, args, { prisma, authUserId }) => {
      const contaId = await assertContaInTenantScope(prisma, authUserId, args.contaId);
      const nomeNormalizado = normalizeName(args.input.nome);
      const nutrientes = normalizeFertilizanteNutrientesInput(args.input.nutrientes, true);

      if (!nomeNormalizado) {
        throw new DomainError('VALIDATION_ERROR', 'Nome do fertilizante é obrigatório');
      }

      const conflict = await findNameConflict(prisma, contaId, nomeNormalizado, null);
      if (conflict) {
        throw new DomainError('NAME_ALREADY_EXISTS', 'Já existe fertilizante customizado ativo com esse nome na conta');
      }

      await assertNutrientesExist(prisma, nutrientes);

      return prisma.$transaction(async (tx) => {
        const created = await tx.fertilizante.create({
          data: {
            nome: nomeNormalizado,
            origin: 'CUSTOM',
            fk_contas_id: contaId,
            c_eletrica: args.input?.c_eletrica,
            compatibilidade: args.input?.compatibilidade,
            solubilidade: args.input?.solubilidade,
            fertilizantes_nutrientes: {
              createMany: {
                data: nutrientes.map((item) => ({
                  fk_nutrientes_id: item.nutrienteId,
                  teor_nutriente: item.teorNutriente,
                })),
              },
            },
          },
        });

        return tx.fertilizante.findUnique({
          where: { id: created.id },
        });
      });
    }
  }
)

t.field(
  "softDeleteFertilizante",
  {
    type: "Fertilizante",
    args: {
      fertilizanteId: nonNull(intArg()),
      contaId: nonNull(intArg()),
    },
    resolve: async (_, args, { prisma, authUserId }) => {
      const contaId = await assertContaInTenantScope(prisma, authUserId, args.contaId);
      const fertilizante = await prisma.fertilizante.findUnique({
        where: { id: args.fertilizanteId },
        select: { id: true, deleted_at: true, origin: true, fk_contas_id: true },
      });

      assertCanMutateFertilizante(fertilizante, contaId);

      return await prisma.fertilizante.update({
        where: { id: args.fertilizanteId },
        data: { deleted_at: new Date().toISOString() },
      });
    }
  }
)

t.field(
  "softDeleteFertilizanteList",
  {
    type: "Int",
    args: {
      contaId: nonNull(intArg()),
      fertilizantesIds: list(nonNull(intArg())),
    },
    resolve: async (_, args, { prisma, authUserId }) => {
      const contaId = await assertContaInTenantScope(prisma, authUserId, args.contaId);
      if (!args.fertilizantesIds || args.fertilizantesIds.length === 0) {
        return 0;
      }

      const uniqueIds = [...new Set(args.fertilizantesIds)];

      const fertilizantes = await prisma.fertilizante.findMany({
        where: {
          id: { in: uniqueIds },
        },
        select: {
          id: true,
          deleted_at: true,
          origin: true,
          fk_contas_id: true,
        },
      });

      if (fertilizantes.length !== uniqueIds.length) {
        throw new DomainError('NOT_FOUND', 'Um ou mais fertilizantes não foram encontrados');
      }

      for (const fertilizante of fertilizantes) {
        assertCanMutateFertilizante(fertilizante, contaId);
      }

      const result = await prisma.fertilizante.updateMany({
        where: {
          id: { in: fertilizantes.map((item) => item.id) },
          deleted_at: null,
        },
        data: { deleted_at: new Date().toISOString() },
      });

      return result.count;
    }
  }
)

t.field(
  "updateFertilizante",
  {
    type: "Fertilizante",
    args: {
      contaId: nonNull(intArg()),
      fertilizanteId: nonNull(intArg()),
      input: arg({ type: "UpdateFertilizanteInput" }),
    },
    resolve: async (_, args, { prisma, authUserId }) => {
      const contaId = await assertContaInTenantScope(prisma, authUserId, args.contaId);
      const fertilizante = await prisma.fertilizante.findUnique({
        where: { id: args.fertilizanteId },
        select: { id: true, nome: true, deleted_at: true, origin: true, fk_contas_id: true },
      });

      assertCanMutateFertilizante(fertilizante, contaId);

      const data = {};
      let nutrientes = null;
      const shouldUpdateNutrientes = args.input?.nutrientes !== undefined;

      if (shouldUpdateNutrientes) {
        nutrientes = normalizeFertilizanteNutrientesInput(args.input?.nutrientes, true);
        await assertNutrientesExist(prisma, nutrientes);
      }

      if (args.input?.nome !== undefined) {
        const nomeNormalizado = normalizeName(args.input.nome);
        if (!nomeNormalizado) {
          throw new DomainError('VALIDATION_ERROR', 'Nome do fertilizante é obrigatório');
        }

        const nomeAtualNormalizado = normalizeName(fertilizante.nome || '');
        if (nomeAtualNormalizado.toLowerCase() !== nomeNormalizado.toLowerCase()) {
          const conflict = await findNameConflict(
            prisma,
            contaId,
            nomeNormalizado,
            args.fertilizanteId
          );

          if (conflict) {
            throw new DomainError('NAME_ALREADY_EXISTS', 'Já existe fertilizante customizado ativo com esse nome na conta');
          }
        }

        data.nome = nomeNormalizado;
      }
      if (args.input?.c_eletrica !== undefined) data.c_eletrica = args.input.c_eletrica;
      if (args.input?.compatibilidade !== undefined) data.compatibilidade = args.input.compatibilidade;
      if (args.input?.solubilidade !== undefined) data.solubilidade = args.input.solubilidade;

      return await prisma.$transaction(async (tx) => {
        const updated = await tx.fertilizante.update({
          where: { id: args.fertilizanteId },
          data,
        });

        if (shouldUpdateNutrientes) {
          await tx.fertilizantes_Nutrientes.deleteMany({
            where: {
              fk_fertilizantes_id: args.fertilizanteId,
            },
          });

          await tx.fertilizantes_Nutrientes.createMany({
            data: nutrientes.map((item) => ({
              fk_fertilizantes_id: args.fertilizanteId,
              fk_nutrientes_id: item.nutrienteId,
              teor_nutriente: item.teorNutriente,
            })),
          });
        }

        return tx.fertilizante.findUnique({
          where: { id: updated.id },
        });
      });
    }
  }
)
    }
})

const UpdateProtocoloInput = inputObjectType({
  name: 'UpdateProtocoloInput',
  definition(t) {
    t.nonNull.int('id');
    t.string('nome');
    t.string('descricao');
    t.string('tipo_cultura');
    t.string('sistema_cultivo');
    t.string('implantacao');
    t.string('cultura');
    t.string('acoes');
  }
})

const FertilizanteNutrienteInput = inputObjectType({
  name: 'FertilizanteNutrienteInput',
  definition(t) {
    t.nonNull.int('nutrienteId');
    t.nonNull.float('teorNutriente');
  }
})

const CreateFertilizanteInput = inputObjectType({
  name: 'CreateFertilizanteInput',
  definition(t) {
    t.nonNull.string('nome');
    t.string('c_eletrica');
    t.int('compatibilidade');
    t.float('solubilidade');
    t.nonNull.list.nonNull.field('nutrientes', {
      type: 'FertilizanteNutrienteInput',
    });
  }
})

const UpdateFertilizanteInput = inputObjectType({
  name: 'UpdateFertilizanteInput',
  definition(t) {
    t.string('nome');
    t.string('c_eletrica');
    t.int('compatibilidade');
    t.float('solubilidade');
    t.list.nonNull.field('nutrientes', {
      type: 'FertilizanteNutrienteInput',
    });
  }
})

function addDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + days);
    return newDate;
}

function substractDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - days);
    return newDate;
}

module.exports = { Mutation, UpdateFertilizanteInput, CreateFertilizanteInput, FertilizanteNutrienteInput }
