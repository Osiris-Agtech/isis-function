const { DomainError } = require('../errors/apiErrors');

const {
    getAuthorizedContaIds,
    assertEntityInTenantScope,
    assertNotDeleted,
    buildEntityFindWhere,
    assertSolucaoInTenantScope,
} = require('./softDeleteUtils');

// ──────────────────────────────────────────────
// Lote
// ──────────────────────────────────────────────

async function softDeleteLote(prisma, authUserId, { loteId }) {
    const { where, include } = buildEntityFindWhere('Lote', loteId);
    const entity = await prisma.lote.findUnique({ where, include });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Lote');
    assertNotDeleted(entity, 'Lote');

    await prisma.lote.update({
        where: { id: loteId },
        data: { deleted_at: new Date() },
    });

    return prisma.lote.findUnique({ where: { id: loteId } });
}

async function softDeleteLoteCascade(prisma, authUserId, { loteId }) {
    const entity = await prisma.lote.findUnique({
        where: { id: loteId },
        include: {
            setor: {
                include: {
                    area: {
                        select: { fk_contas_id: true },
                    },
                },
            },
            agendas: {
                where: { deleted_at: null },
                select: { id: true },
            },
        },
    });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Lote');
    assertNotDeleted(entity, 'Lote');

    const now = new Date();
    const operations = [];

    if (entity.agendas && entity.agendas.length > 0) {
        operations.push(
            prisma.agenda.updateMany({
                where: { fk_lote_id: loteId, deleted_at: null },
                data: { deleted_at: now },
            })
        );
    }

    operations.push(
        prisma.lote.update({
            where: { id: loteId },
            data: { deleted_at: now },
        })
    );

    await prisma.$transaction(operations);

    return prisma.lote.findUnique({ where: { id: loteId } });
}

// ──────────────────────────────────────────────
// Area
// ──────────────────────────────────────────────

async function softDeleteArea(prisma, authUserId, { areaId }) {
    const { where, select } = buildEntityFindWhere('Area', areaId);
    const entity = await prisma.area.findUnique({ where, select });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Área');
    assertNotDeleted(entity, 'Área');

    await prisma.area.update({
        where: { id: areaId },
        data: { deleted_at: new Date() },
    });

    return prisma.area.findUnique({ where: { id: areaId } });
}

async function softDeleteAreaCascade(prisma, authUserId, { areaId }) {
    const entity = await prisma.area.findUnique({
        where: { id: areaId },
        include: {
            setores: {
                where: { deleted_at: null },
                select: {
                    id: true,
                    lotes: {
                        where: { deleted_at: null },
                        select: { id: true },
                    },
                },
            },
        },
    });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Área');
    assertNotDeleted(entity, 'Área');

    const now = new Date();
    const operations = [];
    const loteIds = [];

    if (entity.setores) {
        for (const setor of entity.setores) {
            if (setor.lotes) {
                for (const lote of setor.lotes) {
                    loteIds.push(lote.id);
                }
            }
        }
    }

    if (loteIds.length > 0) {
        operations.push(
            prisma.agenda.updateMany({
                where: { fk_lote_id: { in: loteIds }, deleted_at: null },
                data: { deleted_at: now },
            })
        );

        operations.push(
            prisma.lote.updateMany({
                where: { id: { in: loteIds }, deleted_at: null },
                data: { deleted_at: now },
            })
        );
    }

    operations.push(
        prisma.setor.updateMany({
            where: { fk_areas_id: areaId, deleted_at: null },
            data: { deleted_at: now },
        })
    );

    operations.push(
        prisma.area.update({
            where: { id: areaId },
            data: { deleted_at: now },
        })
    );

    await prisma.$transaction(operations);

    return prisma.area.findUnique({ where: { id: areaId } });
}

// ──────────────────────────────────────────────
// Setor
// ──────────────────────────────────────────────

async function softDeleteSetor(prisma, authUserId, { setorId }) {
    const { where, include } = buildEntityFindWhere('Setor', setorId);
    const entity = await prisma.setor.findUnique({ where, include });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Setor');
    assertNotDeleted(entity, 'Setor');

    await prisma.setor.update({
        where: { id: setorId },
        data: { deleted_at: new Date() },
    });

    return prisma.setor.findUnique({ where: { id: setorId } });
}

async function softDeleteSetorCascade(prisma, authUserId, { setorId }) {
    const entity = await prisma.setor.findUnique({
        where: { id: setorId },
        include: {
            area: {
                select: { fk_contas_id: true },
            },
            lotes: {
                where: { deleted_at: null },
                select: { id: true },
            },
        },
    });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Setor');
    assertNotDeleted(entity, 'Setor');

    const now = new Date();
    const operations = [];
    const loteIds = [];

    if (entity.lotes) {
        for (const lote of entity.lotes) {
            loteIds.push(lote.id);
        }
    }

    if (loteIds.length > 0) {
        operations.push(
            prisma.agenda.updateMany({
                where: { fk_lote_id: { in: loteIds }, deleted_at: null },
                data: { deleted_at: now },
            })
        );

        operations.push(
            prisma.lote.updateMany({
                where: { fk_setores_id: setorId, deleted_at: null },
                data: { deleted_at: now },
            })
        );
    }

    operations.push(
        prisma.setor.update({
            where: { id: setorId },
            data: { deleted_at: now },
        })
    );

    await prisma.$transaction(operations);

    return prisma.setor.findUnique({ where: { id: setorId } });
}

// ──────────────────────────────────────────────
// Reservatorio
// ──────────────────────────────────────────────

async function softDeleteReservatorio(prisma, authUserId, { reservatorioId }) {
    const { where, select } = buildEntityFindWhere('Reservatorio', reservatorioId);
    const entity = await prisma.reservatorio.findUnique({ where, select });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Reservatório');
    assertNotDeleted(entity, 'Reservatório');

    await prisma.reservatorio.update({
        where: { id: reservatorioId },
        data: { deleted_at: new Date() },
    });

    return prisma.reservatorio.findUnique({ where: { id: reservatorioId } });
}

async function softDeleteReservatorioCascade(prisma, authUserId, { reservatorioId }) {
    const entity = await prisma.reservatorio.findUnique({
        where: { id: reservatorioId },
        include: {
            lotes: {
                where: { deleted_at: null },
                select: { id: true },
            },
        },
    });

    await assertEntityInTenantScope(prisma, authUserId, entity, 'Reservatório');
    assertNotDeleted(entity, 'Reservatório');

    const now = new Date();
    const operations = [];
    const loteIds = [];

    if (entity.lotes) {
        for (const lote of entity.lotes) {
            loteIds.push(lote.id);
        }
    }

    if (loteIds.length > 0) {
        operations.push(
            prisma.agenda.updateMany({
                where: { fk_lote_id: { in: loteIds }, deleted_at: null },
                data: { deleted_at: now },
            })
        );

        operations.push(
            prisma.lote.updateMany({
                where: { fk_reservatorios_id: reservatorioId, deleted_at: null },
                data: { deleted_at: now },
            })
        );
    }

    operations.push(
        prisma.setor.updateMany({
            where: { fk_reservatorios_id: reservatorioId, deleted_at: null },
            data: { fk_reservatorios_id: null },
        })
    );

    operations.push(
        prisma.reservatorio.update({
            where: { id: reservatorioId },
            data: { deleted_at: now },
        })
    );

    await prisma.$transaction(operations);

    return prisma.reservatorio.findUnique({ where: { id: reservatorioId } });
}

// ──────────────────────────────────────────────
// SNutritiva
// ──────────────────────────────────────────────

async function softDeleteSNutritiva(prisma, authUserId, { snutritivaId }) {
    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);

    const validatedId = await assertSolucaoInTenantScope(
        prisma,
        authUserId,
        snutritivaId,
        authorizedContaIds
    );

    const { where } = buildEntityFindWhere('SNutritiva', validatedId);
    const entity = await prisma.sNutritiva.findUnique({
        where,
        select: { id: true, deleted_at: true },
    });

    assertNotDeleted(entity, 'Solução Nutritiva');

    await prisma.sNutritiva.update({
        where: { id: validatedId },
        data: { deleted_at: new Date() },
    });

    return prisma.sNutritiva.findUnique({ where: { id: validatedId } });
}

async function softDeleteSNutritivaCascade(prisma, authUserId, { snutritivaId }) {
    const authorizedContaIds = await getAuthorizedContaIds(prisma, authUserId);

    const validatedId = await assertSolucaoInTenantScope(
        prisma,
        authUserId,
        snutritivaId,
        authorizedContaIds
    );

    const entity = await prisma.sNutritiva.findUnique({
        where: { id: validatedId },
        include: {
            reservatorios: {
                where: { deleted_at: null },
                select: {
                    id: true,
                    lotes: {
                        where: { deleted_at: null },
                        select: { id: true },
                    },
                },
            },
        },
    });

    assertNotDeleted(entity, 'Solução Nutritiva');

    const now = new Date();
    const operations = [];

    // Solucoes_Contas
    operations.push(
        prisma.solucoes_Contas.updateMany({
            where: { fk_solucoes_id: validatedId, deleted_at: null },
            data: { deleted_at: now },
        })
    );

    // Solucoes_Fertilizantes_Concentradas
    operations.push(
        prisma.solucoes_Fertilizantes_Concentradas.updateMany({
            where: { fk_solucoes_id: validatedId, deleted_at: null },
            data: { deleted_at: now },
        })
    );

    const reservatorioIds = [];
    const loteIds = [];

    if (entity.reservatorios) {
        for (const reservatorio of entity.reservatorios) {
            reservatorioIds.push(reservatorio.id);
            if (reservatorio.lotes) {
                for (const lote of reservatorio.lotes) {
                    loteIds.push(lote.id);
                }
            }
        }
    }

    if (loteIds.length > 0) {
        operations.push(
            prisma.agenda.updateMany({
                where: { fk_lote_id: { in: loteIds }, deleted_at: null },
                data: { deleted_at: now },
            })
        );

        operations.push(
            prisma.lote.updateMany({
                where: { fk_reservatorios_id: { in: reservatorioIds }, deleted_at: null },
                data: { deleted_at: now },
            })
        );
    }

    if (reservatorioIds.length > 0) {
        operations.push(
            prisma.setor.updateMany({
                where: { fk_reservatorios_id: { in: reservatorioIds }, deleted_at: null },
                data: { fk_reservatorios_id: null },
            })
        );

        operations.push(
            prisma.reservatorio.updateMany({
                where: { fk_solucoes_id: validatedId, deleted_at: null },
                data: { deleted_at: now },
            })
        );
    }

    operations.push(
        prisma.sNutritiva.update({
            where: { id: validatedId },
            data: { deleted_at: now },
        })
    );

    await prisma.$transaction(operations);

    return prisma.sNutritiva.findUnique({ where: { id: validatedId } });
}

module.exports = {
    softDeleteLote,
    softDeleteLoteCascade,
    softDeleteArea,
    softDeleteAreaCascade,
    softDeleteSetor,
    softDeleteSetorCascade,
    softDeleteReservatorio,
    softDeleteReservatorioCascade,
    softDeleteSNutritiva,
    softDeleteSNutritivaCascade,
};
