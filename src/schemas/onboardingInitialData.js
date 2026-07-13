const solutionsTemplateData = [
  {
    nome: 'SN Alface 01',
    c_eletrica: 1.0,
    fertilizantes: [
      { nome: 'Nitrato de Cálcio', quantidade: 495 },
      { nome: 'Hidrogood Fert', quantidade: 660 },
      { nome: 'Ferro (6,5%)', quantidade: 20 },
    ],
  },
  {
    nome: 'SN Rúcula 01',
    c_eletrica: 1.0,
    fertilizantes: [
      { nome: 'Nitrato de Cálcio', quantidade: 495 },
      { nome: 'Hidrogood Fert', quantidade: 660 },
      { nome: 'Ferro (6,5%)', quantidade: 40 },
    ],
  },
];

async function ensureOwnerCargo(tx) {
    let cargoOwner = await tx.cargo.findFirst({
        where: { cargo: 'Dono' },
    });

    if (cargoOwner) {
        return cargoOwner;
    }

    cargoOwner = await tx.cargo.findUnique({
        where: { id: 1 },
    });

    if (cargoOwner) {
        return tx.cargo.update({
            where: { id: 1 },
            data: { cargo: 'Dono' },
        });
    }

    cargoOwner = await tx.cargo.create({
        data: {
            id: 1,
            cargo: 'Dono',
        },
    });
    console.log('Cargo Dono criado:', cargoOwner);

    return cargoOwner;
}

async function createInitialCultures(tx, contaId) {
    await tx.cultura.create({
        data: {
            nome: 'Alface Crespa',
            conta: { connect: { id: contaId } },
        },
    });

    await tx.cultura.create({
        data: {
            nome: 'Rúcula',
            conta: { connect: { id: contaId } },
        },
    });
}

async function createInitialSolutions(tx, contaId, solutionLogLabel) {
    const templateSolutionIds = {};

    for (const solucaoData of solutionsTemplateData) {
        const fertLinks = [];

        for (const item of solucaoData.fertilizantes) {
            const fert = await tx.fertilizante.findFirst({
                where: { nome: item.nome, origin: 'SYSTEM', deleted_at: null },
            });

            if (!fert) {
                console.log(`  ✗ Fertilizante não encontrado: ${item.nome}`);
                continue;
            }

            fertLinks.push({
                quantidade: item.quantidade,
                fertilizante: { connect: { id: fert.id } },
            });
        }

        const novaSolucao = await tx.sNutritiva.create({
            data: {
                nome: solucaoData.nome,
                c_eletrica: solucaoData.c_eletrica,
                solucoes_contas: {
                    create: [{
                        conta_original: 1,
                        conta: { connect: { id: contaId } },
                    }],
                },
                solucoes_fertilizantes_concentradas: {
                    create: fertLinks,
                },
            },
        });

        templateSolutionIds[solucaoData.nome] = novaSolucao.id;
        console.log(`✓ Solução criada para ${solutionLogLabel}: ${solucaoData.nome}`);
    }

    return templateSolutionIds;
}

async function createInitialAreaReservatoriosSetores(tx, contaId, templateSolutionIds) {
    const areaTeste = await tx.area.create({
        data: {
            nome: 'Estufa UFMT',
            descricao: 'Área principal de cultivo',
            tipo: 'Estufa',
            conta: { connect: { id: contaId } },
        },
    });

    const reservatorioAlface = await tx.reservatorio.create({
        data: {
            nome: 'Reservatório Alface',
            conta: { connect: { id: contaId } },
            volume: 1000,
            ...(templateSolutionIds['SN Alface 01']
                ? { solucao: { connect: { id: templateSolutionIds['SN Alface 01'] } } }
                : {}),
        },
    });

    const reservatorioRucula = await tx.reservatorio.create({
        data: {
            nome: 'Reservatório Rúcula',
            conta: { connect: { id: contaId } },
            volume: 1000,
            ...(templateSolutionIds['SN Rúcula 01']
                ? { solucao: { connect: { id: templateSolutionIds['SN Rúcula 01'] } } }
                : {}),
        },
    });

    await tx.setor.create({
        data: {
            nome: 'Bancada Alface',
            descricao: 'Bancada de produção de alface',
            area: { connect: { id: areaTeste.id } },
            reservatorio: { connect: { id: reservatorioAlface.id } },
        },
    });

    await tx.setor.create({
        data: {
            nome: 'Bancada Rúcula',
            descricao: 'Bancada de produção de rúcula',
            area: { connect: { id: areaTeste.id } },
            reservatorio: { connect: { id: reservatorioRucula.id } },
        },
    });
}

async function createInitialOnboardingData(tx, contaId, options = {}) {
    await createInitialCultures(tx, contaId);
    const templateSolutionIds = await createInitialSolutions(
        tx,
        contaId,
        options.solutionLogLabel || 'nova conta'
    );
    await createInitialAreaReservatoriosSetores(tx, contaId, templateSolutionIds);
}

module.exports = {
    createInitialOnboardingData,
    ensureOwnerCargo,
    solutionsTemplateData,
};
