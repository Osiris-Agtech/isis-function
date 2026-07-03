const {
    DomainError,
    AuthenticationError,
} = require('../errors/apiErrors');

const ALREADY_DELETED = 'ALREADY_DELETED';

async function getAuthorizedContaIds(prisma, authUserId) {
    if (!Number.isInteger(authUserId)) {
        throw new DomainError('VALIDATION_ERROR', 'Autenticação obrigatória');
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

async function assertEntityInTenantScope(prisma, authUserId, entity, entityName) {
    if (!authUserId) {
        throw new AuthenticationError('Autenticação obrigatória');
    }

    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);

    if (!entity) {
        throw new DomainError('NOT_FOUND', `${entityName} não encontrado`);
    }

    // Resolve contaId from the entity: direct fk_contas_id or via relation chain
    const contaId = entity.fk_contas_id
        ?? entity.area?.fk_contas_id
        ?? entity.setor?.area?.fk_contas_id;

    if (!contaId || !authorizedContaIds.includes(contaId)) {
        throw new DomainError('TENANT_SCOPE_VIOLATION', `${entityName} fora do escopo da conta`);
    }
}

function assertNotDeleted(entity, entityName) {
    if (entity && entity.deleted_at) {
        throw new DomainError('ALREADY_DELETED', `${entityName} já foi removido`);
    }
}

function buildEntityFindWhere(entityName, entityId) {
    switch (entityName) {
        case 'Area':
        case 'Reservatorio':
        case 'Fertilizante':
            return {
                where: { id: entityId },
                select: {
                    id: true,
                    fk_contas_id: true,
                    deleted_at: true,
                },
            };

        case 'Setor':
            return {
                where: { id: entityId },
                include: {
                    area: {
                        select: {
                            fk_contas_id: true,
                        },
                    },
                },
            };

        case 'Lote':
            return {
                where: { id: entityId },
                include: {
                    setor: {
                        include: {
                            area: {
                                select: {
                                    fk_contas_id: true,
                                },
                            },
                        },
                    },
                },
            };

        case 'SNutritiva':
            return {
                where: { id: entityId },
                select: {
                    id: true,
                    deleted_at: true,
                },
            };

        default:
            throw new DomainError('VALIDATION_ERROR', `Entidade desconhecida: ${entityName}`);
    }
}

async function assertSolucaoInTenantScope(prisma, authUserId, solucaoId, authorizedContaIds) {
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

module.exports = {
    ALREADY_DELETED,
    getAuthorizedContaIds,
    assertEntityInTenantScope,
    assertNotDeleted,
    buildEntityFindWhere,
    assertSolucaoInTenantScope,
};
