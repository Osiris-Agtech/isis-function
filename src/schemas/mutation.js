const { mutationType, list, nonNull, stringArg, intArg, floatArg } = require('@nexus/schema');
const { booleanArg, arg, inputObjectType } = require('nexus');
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    UserInputError,
    AuthenticationError,
    DomainError,
    InfrastructureError,
} = require('../errors/apiErrors');

const APP_BRAND_NAME = 'Aplicativo de Gestão de Cultivos - UFMT';

function buildEmailLayout({ heading, intro, details, cta }) {
    const detailsRows = Array.isArray(details)
        ? details
            .filter((item) => item && item.label && item.value)
            .map((item) => `<li><strong>${item.label}:</strong> ${item.value}</li>`)
            .join('')
        : '';

    return `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
            <h2 style="margin: 0 0 8px 0;">${APP_BRAND_NAME}</h2>
            <h3 style="margin: 0 0 16px 0; color: #0f766e;">${heading}</h3>
            <p style="margin: 0 0 16px 0;">${intro}</p>
            ${detailsRows ? `<ul style="margin: 0 0 16px 20px; padding: 0;">${detailsRows}</ul>` : ''}
            ${cta ? `<p style="margin: 0 0 16px 0;"><strong>${cta}</strong></p>` : ''}
            <p style="margin: 0; color: #4b5563;">Mensagem automática do ${APP_BRAND_NAME}.</p>
        </div>
    `;
}

function buildContributorInviteEmailContent({ accessEmail, contaNome, cargoNome, senhaTemporaria }) {
    const details = [
        { label: 'Conta', value: contaNome },
        { label: 'Cargo', value: cargoNome },
        { label: 'E-mail de acesso', value: accessEmail },
    ];

    if (senhaTemporaria) {
        details.push({ label: 'Senha temporária', value: senhaTemporaria });
    }

    return buildEmailLayout({
        heading: senhaTemporaria ? 'Convite de colaborador' : 'Acesso atualizado',
        intro: senhaTemporaria
            ? 'Seu acesso de colaborador foi criado com sucesso.'
            : 'Seu acesso de colaborador foi atualizado com sucesso.',
        details,
        cta: 'Acesse o aplicativo para entrar e gerenciar seus cultivos.',
    });
}

function normalizeName(name) {
    if (typeof name !== 'string') {
        return '';
    }

    return name.trim();
}

function getGmailConfigOrThrow() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_PASSWORD;

    if (!gmailUser || !gmailPassword) {
        throw new InfrastructureError(
            'EMAIL_CONFIG_MISSING',
            'GMAIL_USER ou GMAIL_PASSWORD não definidos'
        );
    }

    return {
        gmailUser,
        gmailPassword,
    };
}

async function sendInviteEmail(gmailConfig, mailOptions) {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: gmailConfig.gmailUser,
            pass: gmailConfig.gmailPassword,
        },
    });

    try {
        return await transporter.sendMail(mailOptions);
    } finally {
        transporter.close();
    }
}

function enqueueInviteEmailDispatch(prisma, payload) {
    const maxAttempts = 3;
    const retryDelayMs = 3000;

    const attemptSend = async (attempt) => {
        try {
            const info = await sendInviteEmail(payload.gmailConfig, {
                from: `"${APP_BRAND_NAME}" <${payload.gmailConfig.gmailUser}>`,
                to: payload.to,
                subject: payload.subject,
                html: payload.html,
            });

            await prisma.notificacao.create({
                data: {
                    key: 'invite-contributor-email-success',
                    valor: payload.to,
                    descricao: `inviteContributor email enviado (attempt=${attempt}): ${info.response || 'ok'}`,
                },
            });
        } catch (error) {
            const lastAttempt = attempt >= maxAttempts;

            await prisma.notificacao.create({
                data: {
                    key: lastAttempt ? 'invite-contributor-email-failed' : 'invite-contributor-email-retry',
                    valor: payload.to,
                    descricao: `inviteContributor email ${lastAttempt ? 'falhou' : 'retry'} (attempt=${attempt}): ${error instanceof Error ? error.message : 'erro desconhecido'}`,
                },
            });

            if (!lastAttempt) {
                setTimeout(() => {
                    void attemptSend(attempt + 1);
                }, retryDelayMs);
            }
        }
    };

    setTimeout(() => {
        void attemptSend(1);
    }, 0);
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

async function ensureContaUserManagementScope(prisma, authUserId, contaId) {
    if (!Number.isInteger(contaId) || contaId <= 0) {
        throw new DomainError('VALIDATION_ERROR', 'contaId inválido');
    }

    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);
    if (!authorizedContaIds.includes(contaId)) {
        throw new DomainError('TENANT_SCOPE_VIOLATION', 'contaId fora do escopo do usuário autenticado');
    }
}

async function assertNotRemovingLastOwner(prisma, contaId, userId) {
    const ownerCargo = await prisma.cargo.findFirst({
        where: {
            cargo: 'Dono',
        },
        select: {
            id: true,
        },
    });

    if (!ownerCargo) {
        return;
    }

    const targetVinculosOwner = await prisma.conectaConta.count({
        where: {
            fk_contas_id: contaId,
            fk_usuarios_id: userId,
            fk_cargos_id: ownerCargo.id,
        },
    });

    if (targetVinculosOwner === 0) {
        return;
    }

    const ownersCount = await prisma.conectaConta.count({
        where: {
            fk_contas_id: contaId,
            fk_cargos_id: ownerCargo.id,
        },
    });

    if (ownersCount <= 1) {
        throw new DomainError('LAST_OWNER_BLOCKED', 'Não é permitido remover o último Dono da conta');
    }
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

function parseStructuredProtocolInput(input, requireId) {
    let payload;
    try {
        payload = JSON.parse(input);
    } catch (_) {
        throw new DomainError('VALIDATION_ERROR', 'Payload de protocolo inválido');
    }

    if (!payload || typeof payload !== 'object') {
        throw new DomainError('VALIDATION_ERROR', 'Payload de protocolo inválido');
    }

    if (requireId && !Number.isInteger(payload.id)) {
        throw new DomainError('VALIDATION_ERROR', 'id do protocolo é obrigatório para atualização');
    }

    if (!Number.isInteger(payload.contaId) || payload.contaId <= 0) {
        throw new DomainError('VALIDATION_ERROR', 'contaId inválido no protocolo');
    }

    if (typeof payload.nome !== 'string' || !payload.nome.trim()) {
        throw new DomainError('VALIDATION_ERROR', 'nome do protocolo é obrigatório');
    }

    if (!Array.isArray(payload.fases) || payload.fases.length === 0) {
        throw new DomainError('VALIDATION_ERROR', 'Informe ao menos uma fase no protocolo');
    }

    if (!Array.isArray(payload.acoes) || payload.acoes.length === 0) {
        throw new DomainError('VALIDATION_ERROR', 'Informe ao menos uma ação no protocolo');
    }

    const faseKeys = new Set();
    const fases = payload.fases.map((fase, index) => {
        const key = typeof fase?.key === 'string' ? fase.key.trim() : '';
        if (!key) {
            throw new DomainError('VALIDATION_ERROR', `Fase ${index + 1} sem chave temporária`);
        }
        if (faseKeys.has(key)) {
            throw new DomainError('VALIDATION_ERROR', `Chave de fase duplicada: ${key}`);
        }
        faseKeys.add(key);

        if (typeof fase?.nome !== 'string' || !fase.nome.trim()) {
            throw new DomainError('VALIDATION_ERROR', `Fase ${index + 1} com nome inválido`);
        }
        if (!Number.isInteger(fase?.duracao_dias) || fase.duracao_dias <= 0) {
            throw new DomainError('VALIDATION_ERROR', `Fase ${index + 1} com duração inválida`);
        }

        return {
            key,
            nome: fase.nome.trim(),
            descricao: typeof fase?.descricao === 'string' ? fase.descricao : null,
            duracao_dias: fase.duracao_dias,
        };
    });

    const acoes = payload.acoes.map((acao, index) => {
        if (typeof acao?.titulo !== 'string' || !acao.titulo.trim()) {
            throw new DomainError('VALIDATION_ERROR', `Ação ${index + 1} com título inválido`);
        }
        if (!Number.isInteger(acao?.duracao_dias) || acao.duracao_dias <= 0) {
            throw new DomainError('VALIDATION_ERROR', `Ação ${index + 1} com duração inválida`);
        }

        const phaseKey = typeof acao?.phaseKey === 'string' ? acao.phaseKey.trim() : '';
        if (!phaseKey || !faseKeys.has(phaseKey)) {
            throw new DomainError('CROSS_PROTOCOL_PHASE_LINK', `Ação ${index + 1} referencia fase inválida para o protocolo`);
        }

        return {
            titulo: acao.titulo.trim(),
            descricao: typeof acao?.descricao === 'string' ? acao.descricao : null,
            alerta: acao?.alerta ?? true,
            duracao_dias: acao.duracao_dias,
            duracao_dias_real: Number.isInteger(acao?.duracao_dias_real) ? acao.duracao_dias_real : null,
            phaseKey,
        };
    });

    return {
        id: payload.id,
        contaId: payload.contaId,
        nome: payload.nome.trim(),
        descricao: typeof payload.descricao === 'string' ? payload.descricao : null,
        tipo_cultura: typeof payload.tipo_cultura === 'string' ? payload.tipo_cultura : null,
        sistema_cultivo: typeof payload.sistema_cultivo === 'string' ? payload.sistema_cultivo : null,
        implantacao: typeof payload.implantacao === 'string' ? payload.implantacao : null,
        culturaId: Number.isInteger(payload.culturaId) ? payload.culturaId : null,
        fases,
        acoes,
    };
}

async function createProtocolWithStructuredPayload(prisma, protocolInput) {
    return prisma.$transaction(async (tx) => {
        const protocolo = await tx.protocolo.create({
            data: {
                nome: protocolInput.nome,
                descricao: protocolInput.descricao,
                tipo_cultura: protocolInput.tipo_cultura,
                sistema_cultivo: protocolInput.sistema_cultivo,
                implantacao: protocolInput.implantacao,
                conta: {
                    connect: {
                        id: protocolInput.contaId,
                    }
                },
                ...(protocolInput.culturaId ? {
                    cultura: {
                        connect: {
                            id: protocolInput.culturaId,
                        }
                    }
                } : {}),
            },
        });

        const phaseIdByKey = new Map();
        for (const fase of protocolInput.fases) {
            const protocoloWithNewPhase = await tx.protocolo.update({
                where: { id: protocolo.id },
                data: {
                    fases: {
                        create: {
                            nome: fase.nome,
                            descricao: fase.descricao,
                            duracao_dias: fase.duracao_dias,
                            conta: {
                                connect: {
                                    id: protocolInput.contaId,
                                },
                            },
                        },
                    },
                },
                include: {
                    fases: {
                        orderBy: {
                            id: 'desc',
                        },
                        take: 1,
                    },
                },
            });

            const createdPhaseId = protocoloWithNewPhase.fases?.[0]?.id;
            if (!Number.isInteger(createdPhaseId)) {
                throw new InfrastructureError('INTERNAL_SERVER_ERROR', 'Falha ao criar fase do protocolo');
            }

            phaseIdByKey.set(fase.key, createdPhaseId);
        }

        await tx.acao.createMany({
            data: protocolInput.acoes.map((acao) => ({
                titulo: acao.titulo,
                descricao: acao.descricao,
                alerta: acao.alerta,
                duracao_dias: acao.duracao_dias,
                duracao_dias_real: acao.duracao_dias_real,
                fk_protocolo_id: protocolo.id,
                fk_fase_id: phaseIdByKey.get(acao.phaseKey),
            })),
        });

        return tx.protocolo.findUnique({
            where: { id: protocolo.id },
            include: {
                cultura: true,
                acoes: {
                    include: {
                        fase: true,
                    }
                },
                lotes: true,
            },
        });
    });
}

async function updateProtocolWithStructuredPayload(prisma, protocolInput) {
    return prisma.$transaction(async (tx) => {
        const protocoloAtual = await tx.protocolo.findUnique({
            where: { id: protocolInput.id },
            select: { id: true, fk_conta_id: true, deleted_at: true },
        });

        if (!protocoloAtual || protocoloAtual.deleted_at) {
            throw new DomainError('NOT_FOUND', 'Protocolo não encontrado');
        }
        if (protocoloAtual.fk_conta_id !== protocolInput.contaId) {
            throw new DomainError('TENANT_SCOPE_VIOLATION', 'Protocolo fora do escopo da conta');
        }

        await tx.acao.deleteMany({
            where: { fk_protocolo_id: protocolInput.id },
        });
        await tx.fase.deleteMany({
            where: { fk_protocolo_id: protocolInput.id },
        });

        await tx.protocolo.update({
            where: { id: protocolInput.id },
            data: {
                nome: protocolInput.nome,
                descricao: protocolInput.descricao,
                tipo_cultura: protocolInput.tipo_cultura,
                sistema_cultivo: protocolInput.sistema_cultivo,
                implantacao: protocolInput.implantacao,
                ...(protocolInput.culturaId
                    ? {
                        cultura: {
                            connect: {
                                id: protocolInput.culturaId,
                            }
                        }
                    }
                    : {
                        cultura: {
                            disconnect: true,
                        }
                    }),
            }
        });

        const phaseIdByKey = new Map();
        for (const fase of protocolInput.fases) {
            const protocoloWithNewPhase = await tx.protocolo.update({
                where: { id: protocolInput.id },
                data: {
                    fases: {
                        create: {
                            nome: fase.nome,
                            descricao: fase.descricao,
                            duracao_dias: fase.duracao_dias,
                            conta: {
                                connect: {
                                    id: protocolInput.contaId,
                                },
                            },
                        },
                    },
                },
                include: {
                    fases: {
                        orderBy: {
                            id: 'desc',
                        },
                        take: 1,
                    },
                },
            });

            const createdPhaseId = protocoloWithNewPhase.fases?.[0]?.id;
            if (!Number.isInteger(createdPhaseId)) {
                throw new InfrastructureError('INTERNAL_SERVER_ERROR', 'Falha ao recriar fase do protocolo');
            }

            phaseIdByKey.set(fase.key, createdPhaseId);
        }

        await tx.acao.createMany({
            data: protocolInput.acoes.map((acao) => ({
                titulo: acao.titulo,
                descricao: acao.descricao,
                alerta: acao.alerta,
                duracao_dias: acao.duracao_dias,
                duracao_dias_real: acao.duracao_dias_real,
                fk_protocolo_id: protocolInput.id,
                fk_fase_id: phaseIdByKey.get(acao.phaseKey),
            })),
        });

        return tx.protocolo.findUnique({
            where: { id: protocolInput.id },
            include: {
                cultura: true,
                acoes: {
                    include: {
                        fase: true,
                    }
                },
                lotes: true,
            },
        });
    });
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
            "createOneFase",
            {
                type: "Fase",
                args: {
                    nome: nonNull(stringArg()),
                    duracao_dias: nonNull(intArg()),
                    descricao: stringArg(),
                    contaId: nonNull(intArg()),
                    protocoloId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma }) => {
                    const protocolo = await prisma.protocolo.findUnique({
                        where: {
                            id: args.protocoloId,
                        },
                        select: {
                            id: true,
                            fk_conta_id: true,
                            deleted_at: true,
                        },
                    });

                    if (!protocolo || protocolo.deleted_at) {
                        throw new DomainError('NOT_FOUND', 'Protocolo não encontrado para vincular fase');
                    }

                    if (protocolo.fk_conta_id !== args.contaId) {
                        throw new DomainError('TENANT_SCOPE_VIOLATION', 'Protocolo fora do escopo da conta para criação da fase');
                    }

                    return prisma.fase.create({
                        data: {
                            nome: args.nome,
                            descricao: args.descricao,
                            duracao_dias: args.duracao_dias,
                            conta: {
                                connect: {
                                    id: args.contaId,
                                }
                            },
                            protocolo: {
                                connect: {
                                    id: args.protocoloId,
                                }
                            }
                        }
                    });
                }
            }
        )

        t.field(
            "createProtocoloEstruturado",
            {
                type: "Protocolo",
                args: {
                    input: nonNull(stringArg()),
                },
                resolve: async (_, { input }, { prisma }) => {
                    const protocolInput = parseStructuredProtocolInput(input, false);
                    return createProtocolWithStructuredPayload(prisma, protocolInput);
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
      const area = await prisma.area.findUnique({
        where: { id: args.areaId },
        select: { id: true, deleted_at: true },
      });

      if (!area) throw new UserInputError("Area não encontrada");
      if (area.deleted_at) throw new UserInputError("Area já deletada");

      const setores = await prisma.setor.findMany({
        where: { fk_areas_id: args.areaId, deleted_at: null },
        select: { id: true },
      });

      const setorIds = setores.map((s) => s.id);
      const deletedAt = new Date().toISOString();
      const txOperations = [];

      if (setorIds.length > 0) {
        txOperations.push(
          prisma.lote.updateMany({
            where: { fk_setores_id: { in: setorIds }, deleted_at: null },
            data: { deleted_at: deletedAt },
          })
        );
      }

      txOperations.push(
        prisma.setor.updateMany({
          where: { fk_areas_id: args.areaId, deleted_at: null },
          data: { deleted_at: deletedAt },
        })
      );

      txOperations.push(
        prisma.area.update({
          where: { id: args.areaId },
          data: { deleted_at: deletedAt },
        })
      );

      const txResults = await prisma.$transaction(txOperations);
      return txResults[txResults.length - 1];
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
      const setor = await prisma.setor.findUnique({
        where: { id: args.setorId },
        select: { id: true, deleted_at: true },
      });

      if (!setor) throw new UserInputError("Setor não encontrado");
      if (setor.deleted_at) throw new UserInputError("Setor já deletado");

      const deletedAt = new Date().toISOString();

      const txResults = await prisma.$transaction([
        prisma.lote.updateMany({
          where: { fk_setores_id: args.setorId, deleted_at: null },
          data: { deleted_at: deletedAt },
        }),
        prisma.setor.update({
          where: { id: args.setorId },
          data: { deleted_at: deletedAt },
        }),
      ]);

      return txResults[1];
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
      const reservatorio = await prisma.reservatorio.findUnique({
        where: { id: args.reservatorioId },
        select: { id: true, deleted_at: true },
      });

      if (!reservatorio) throw new UserInputError("Reservatorio não encontrado");
      if (reservatorio.deleted_at) throw new UserInputError("Reservatorio já deletado");

      const deletedAt = new Date().toISOString();

      const txResults = await prisma.$transaction([
        prisma.lote.updateMany({
          where: { fk_reservatorios_id: args.reservatorioId, deleted_at: null },
          data: { deleted_at: deletedAt },
        }),
        prisma.reservatorio.update({
          where: { id: args.reservatorioId },
          data: { deleted_at: deletedAt },
        }),
      ]);

      return txResults[1];
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

      await assertSolucaoInTenantScope(prisma, args.snutritivaId, authorizedContaIds);

      const snutritiva = await prisma.sNutritiva.findUnique({
        where: { id: args.snutritivaId },
        select: { id: true, deleted_at: true },
      });

      if (!snutritiva) throw new UserInputError("SNutritiva não encontrada");
      if (snutritiva.deleted_at) throw new UserInputError("SNutritiva já deletada");

      const reservatorios = await prisma.reservatorio.findMany({
        where: { fk_snutritivas_id: args.snutritivaId, deleted_at: null },
        select: { id: true },
      });

      const reservatorioIds = reservatorios.map((r) => r.id);
      const deletedAt = new Date().toISOString();
      const txOperations = [];

      if (reservatorioIds.length > 0) {
        txOperations.push(
          prisma.lote.updateMany({
            where: { fk_reservatorios_id: { in: reservatorioIds }, deleted_at: null },
            data: { deleted_at: deletedAt },
          })
        );
      }

      txOperations.push(
        prisma.reservatorio.updateMany({
          where: { fk_snutritivas_id: args.snutritivaId, deleted_at: null },
          data: { deleted_at: deletedAt },
        })
      );

      txOperations.push(
        prisma.sNutritiva.update({
          where: { id: args.snutritivaId },
          data: { deleted_at: deletedAt },
        })
      );

      const txResults = await prisma.$transaction(txOperations);
      return txResults[txResults.length - 1];
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
      const protocolo = await prisma.protocolo.findUnique({
        where: { id: args.protocoloId },
        select: { id: true, deleted_at: true },
      });

      if (!protocolo) throw new UserInputError("Protocolo não encontrado");
      if (protocolo.deleted_at) throw new UserInputError("Protocolo já deletado");

      const deletedAt = new Date().toISOString();

      await prisma.lote.updateMany({
        where: { fk_protocolos_id: args.protocoloId, deleted_at: null },
        data: { deleted_at: deletedAt },
      });

      try {
        return await prisma.protocolo.update({
          where: { id: args.protocoloId },
          data: { deleted_at: deletedAt },
        });
      } catch (error) {
        await prisma.notificacao.create({
          data: {
            key: 'soft-delete-protocolo-partial-failure',
            valor: String(args.protocoloId),
            descricao: error instanceof Error
              ? error.message
              : 'Falha ao concluir softDeleteProtocoloCascade após atualizar lotes',
          },
        });

        throw new InfrastructureError(
          'SOFT_DELETE_PROTOCOLO_PARTIAL_FAILURE',
          'Falha ao concluir remoção do protocolo após atualizar lotes vinculados'
        );
      }
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
            "descadastrarUsuarioDaConta",
            {
                type: "DescadastroUsuarioContaResponse",
                args: {
                    userId: nonNull(intArg()),
                    contaId: nonNull(intArg()),
                },
                resolve: async (_, args, { prisma, authUserId }) => {
                    if (!Number.isInteger(args.userId) || args.userId <= 0) {
                        throw new DomainError('VALIDATION_ERROR', 'userId inválido');
                    }

                    await ensureContaUserManagementScope(prisma, authUserId, args.contaId);
                    await assertNotRemovingLastOwner(prisma, args.contaId, args.userId);

                    const removed = await prisma.conectaConta.deleteMany({
                        where: {
                            fk_usuarios_id: args.userId,
                            fk_contas_id: args.contaId,
                        },
                    });

                    if (removed.count === 0) {
                        return {
                            status: 'VINCULO_INEXISTENTE',
                            mensagem: 'Usuário já não está vinculado a esta conta',
                            usuarioId: args.userId,
                            contaId: args.contaId,
                        };
                    }

                    return {
                        status: 'REMOVIDO',
                        mensagem: 'Usuário descadastrado da conta com sucesso',
                        usuarioId: args.userId,
                        contaId: args.contaId,
                    };
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
                        throw new InfrastructureError(
                            'EMAIL_CONFIG_MISSING',
                            'GMAIL_USER ou GMAIL_PASSWORD não definidos nas variáveis de ambiente'
                        );
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
                            from: `"${APP_BRAND_NAME}" <${gmailUser}>`,
                            to: args.email,
                            subject: args.subject,
                            html: args.html,
                        });
                        console.log("Message sent: %s", info);
                    } catch (error) {
                        console.log(error);
                        throw new InfrastructureError('EMAIL_SEND_FAILED', 'Falha ao enviar e-mail');
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
                    const gmailConfig = getGmailConfigOrThrow();
                    const createdResources = {
                        pessoaId: null,
                        contaId: null,
                        usuarioId: null,
                        conectaContaIds: [],
                        solucoesCriadasIds: [],
                        shouldCompensate: false,
                    };

                    const compensateInviteContributor = async () => {
                        if (!createdResources.shouldCompensate) {
                            return;
                        }

                        try {
                            if (createdResources.conectaContaIds.length > 0) {
                                await prisma.ConectaConta.deleteMany({
                                    where: {
                                        id: {
                                            in: createdResources.conectaContaIds,
                                        },
                                    },
                                });
                            }

                            if (createdResources.solucoesCriadasIds.length > 0) {
                                await prisma.sNutritiva.deleteMany({
                                    where: {
                                        id: {
                                            in: createdResources.solucoesCriadasIds,
                                        },
                                    },
                                });
                            }

                            if (Number.isInteger(createdResources.usuarioId)) {
                                await prisma.usuario.delete({
                                    where: {
                                        id: createdResources.usuarioId,
                                    },
                                });
                            }

                            if (Number.isInteger(createdResources.contaId)) {
                                await prisma.conta.delete({
                                    where: {
                                        id: createdResources.contaId,
                                    },
                                });
                            }

                            if (Number.isInteger(createdResources.pessoaId)) {
                                await prisma.pessoa.delete({
                                    where: {
                                        id: createdResources.pessoaId,
                                    },
                                });
                            }
                        } catch (compensationError) {
                            await prisma.notificacao.create({
                                data: {
                                    key: 'invite-contributor-compensation-failed',
                                    valor: args.email,
                                    descricao: compensationError instanceof Error ? compensationError.message : 'Falha ao compensar inviteContributor',
                                },
                            });
                        }
                    };

                    let mutationResult;

                    try {
                        const buscarUsuario = await prisma.usuario.findMany({
                            where: {
                                email: args.email,
                            },
                            include: {
                                contas: true,
                            },
                        });

                        if (buscarUsuario.length > 0) {
                            const indexConta = buscarUsuario[0].contas.findIndex((contaVinculada) => contaVinculada.fk_contas_id === args.contaId);

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

                            if (indexConta !== -1) {
                                const conectaContaCargoUser = await prisma.ConectaConta.update({
                                    where: {
                                        id: buscarUsuario[0].contas[indexConta].id,
                                    },
                                    data: {
                                        cargo: {
                                            connect: {
                                                id: args.cargoId,
                                            },
                                        },
                                    },
                                    include: {
                                        conta: true,
                                        cargo: true,
                                    },
                                });

                                mutationResult = {
                                    infoAcesso: { ...buscarUsuario[0], conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo },
                                    emailPayload: {
                                        to: args.email,
                                        subject: 'Convite de colaborador reenviado ✔',
                                        html: buildContributorInviteEmailContent({
                                            accessEmail: args.email,
                                            contaNome: contaInvited.nome,
                                            cargoNome: cargoInvited.cargo,
                                            senhaTemporaria: null,
                                        }),
                                    },
                                };
                            } else {
                                const conectaContaCargoUser = await prisma.ConectaConta.create({
                                    data: {
                                        conta: {
                                            connect: {
                                                id: args.contaId,
                                            },
                                        },
                                        usuario: {
                                            connect: {
                                                id: buscarUsuario[0].id,
                                            },
                                        },
                                        cargo: {
                                            connect: {
                                                id: args.cargoId,
                                            },
                                        },
                                    },
                                    include: {
                                        conta: true,
                                        cargo: true,
                                    },
                                });

                                mutationResult = {
                                    infoAcesso: { ...buscarUsuario[0], conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo },
                                    emailPayload: {
                                        to: args.email,
                                        subject: 'Adicionado colaborador ✔',
                                        html: buildContributorInviteEmailContent({
                                            accessEmail: args.email,
                                            contaNome: contaInvited.nome,
                                            cargoNome: cargoInvited.cargo,
                                            senhaTemporaria: null,
                                        }),
                                    },
                                };
                            }
                        } else {
                            createdResources.shouldCompensate = true;

                            const pessoa = await prisma.pessoa.create({
                                data: {
                                    nome: args.nome,
                                    sobrenome: args.sobrenome,
                                },
                                select: {
                                    id: true,
                                },
                            });
                            createdResources.pessoaId = pessoa.id;

                            const conta = await prisma.conta.create({
                                data: {
                                    nome: args.nome,
                                    nivel: '1',
                                },
                                select: {
                                    id: true,
                                },
                            });
                            createdResources.contaId = conta.id;

                            const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
                            const passwordLength = 8;
                            let password = '';

                            for (let i = 0; i <= passwordLength; i++) {
                                const randomNumber = Math.floor(Math.random() * chars.length);
                                password += chars.substring(randomNumber, randomNumber + 1);
                            }

                            const hashedPassword = await bcrypt.hash(password, 10);
                            const usuario = await prisma.usuario.create({
                                data: {
                                    nome: args.nome,
                                    email: args.email,
                                    senha: hashedPassword,
                                    pessoa: {
                                        connect: {
                                            id: pessoa.id,
                                        },
                                    },
                                },
                            });
                            createdResources.usuarioId = usuario.id;

                            const conectaContaPrincipal = await prisma.ConectaConta.create({
                                data: {
                                    conta: {
                                        connect: {
                                            id: args.contaId,
                                        },
                                    },
                                    usuario: {
                                        connect: {
                                            id: usuario.id,
                                        },
                                    },
                                    cargo: {
                                        connect: {
                                            id: args.cargoId,
                                        },
                                    },
                                },
                            });
                            createdResources.conectaContaIds.push(conectaContaPrincipal.id);

                            let cargoOwner = await prisma.cargo.findUnique({
                                where: { id: 1 },
                            });

                            if (!cargoOwner) {
                                cargoOwner = await prisma.cargo.create({
                                    data: {
                                        id: 1,
                                        cargo: 'Owner',
                                    },
                                });
                            }

                            const conectaContaCargoUser = await prisma.ConectaConta.create({
                                data: {
                                    conta: {
                                        connect: {
                                            id: conta.id,
                                        },
                                    },
                                    usuario: {
                                        connect: {
                                            id: usuario.id,
                                        },
                                    },
                                    cargo: {
                                        connect: {
                                            id: cargoOwner.id,
                                        },
                                    },
                                },
                                include: {
                                    conta: true,
                                    cargo: true,
                                },
                            });
                            createdResources.conectaContaIds.push(conectaContaCargoUser.id);

                            const solucoesIniciais = [12, 13, 14, 15, 16];

                            for (const solucaoId of solucoesIniciais) {
                                const snutritiva = await prisma.sNutritiva.findMany({
                                    where: {
                                        id: solucaoId,
                                    },
                                    include: {
                                        solucoes_fertilizantes_concentradas: true,
                                    },
                                });

                                if (!snutritiva.length) {
                                    continue;
                                }

                                const solucaoFertilizantes = [];
                                for (const object of snutritiva[0].solucoes_fertilizantes_concentradas) {
                                    if (object.fk_concentradas_id != null) {
                                        solucaoFertilizantes.push({
                                            quantidade: Number(object.quantidade),
                                            fertilizante: {
                                                connect: {
                                                    id: Number(object.fk_fertilizantes_id),
                                                },
                                            },
                                            concentrada: {
                                                connect: {
                                                    id: object.fk_concentradas_id,
                                                },
                                            },
                                        });
                                    } else {
                                        solucaoFertilizantes.push({
                                            quantidade: Number(object.quantidade),
                                            fertilizante: {
                                                connect: {
                                                    id: Number(object.fk_fertilizantes_id),
                                                },
                                            },
                                        });
                                    }
                                }

                                const data = {
                                    c_eletrica: Number(snutritiva[0].c_eletrica),
                                    nome: String(snutritiva[0].nome),
                                    solucoes_contas: {
                                        create: [
                                            {
                                                conta_original: 1,
                                                conta: {
                                                    connect: {
                                                        id: conta.id,
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                    solucoes_fertilizantes_concentradas: {
                                        create: [
                                            ...solucaoFertilizantes,
                                        ],
                                    },
                                };

                                const novaSolucao = await prisma.sNutritiva.create({
                                    data,
                                });
                                createdResources.solucoesCriadasIds.push(novaSolucao.id);
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

                            mutationResult = {
                                infoAcesso: { ...usuario, conta: conectaContaCargoUser.conta, cargo: conectaContaCargoUser.cargo },
                                emailPayload: {
                                    to: args.email,
                                    subject: 'Adicionado colaborador ✔',
                                    html: buildContributorInviteEmailContent({
                                        accessEmail: args.email,
                                        contaNome: contaInvited.nome,
                                        cargoNome: cargoInvited.cargo,
                                        senhaTemporaria: password,
                                    }),
                                },
                            };
                            createdResources.shouldCompensate = false;
                        }
                    } catch (error) {
                        await compensateInviteContributor();
                        throw error;
                    }

                    enqueueInviteEmailDispatch(prisma, {
                        gmailConfig,
                        to: mutationResult.emailPayload.to,
                        subject: mutationResult.emailPayload.subject,
                        html: mutationResult.emailPayload.html,
                    });

                    return mutationResult.infoAcesso;
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
                    const protocolInput = parseStructuredProtocolInput(input, true);
                    return updateProtocolWithStructuredPayload(prisma, protocolInput);
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

      return prisma.fertilizante.create({
        data: {
          nome: nomeNormalizado,
          origin: 'CUSTOM',
          fk_contas_id: contaId,
          c_eletrica: args.input?.c_eletrica,
          compatibilidade: args.input?.compatibilidade,
          solubilidade: args.input?.solubilidade,
          fertilizantes_nutrientes: {
            create: nutrientes.map((item) => ({
              nutriente: {
                connect: {
                  id: item.nutrienteId,
                },
              },
              teor_nutriente: item.teorNutriente,
            })),
          },
        },
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

      if (shouldUpdateNutrientes) {
        data.fertilizantes_nutrientes = {
          deleteMany: {},
          create: nutrientes.map((item) => ({
            nutriente: {
              connect: {
                id: item.nutrienteId,
              },
            },
            teor_nutriente: item.teorNutriente,
          })),
        };
      }

      return await prisma.fertilizante.update({
        where: { id: args.fertilizanteId },
        data,
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
