const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ────────────────────────────────────────────
// Dados dos protocolos template (sistema)
// ────────────────────────────────────────────
const protocolosTemplate = [
  {
    nome: 'Alface Crespa',
    descricao: 'Protocolo padrão para alface crespa em sistema hidropônico',
    tipo_cultura: 'Folhosa',
    sistema_cultivo: 'Hidroponia',
    implantacao: 'Semeadura direta em bandeja',
    fases: [
      { key: 'mudas', nome: 'Produção de Mudas', duracao_dias: 24 },
      { key: 'bercario', nome: 'Berçário', duracao_dias: 14 },
      { key: 'crescimento_final', nome: 'Crescimento Final', duracao_dias: 14 },
    ],
    acoes: [
      // Produção de Mudas
      {
        titulo: 'Pulverização com Enraizador',
        descricao: 'Aplicar Forth Enraizador 1ml/L com pulverizador manual',
        duracao_dias: 0, duracao_dias_real: 3, phaseKey: 'mudas',
      },
      {
        titulo: 'Aplicação de Solução Nutritiva',
        descricao: 'Reservatório R01, receita SN Alface 01, CE 1,0 mS/cm. Aplicar com pulverizador manual ou regador até drenagem.',
        duracao_dias: 0, duracao_dias_real: 5, phaseKey: 'mudas',
      },
      {
        titulo: 'Pulverização com Enraizador',
        descricao: 'Forth Enraizador 1ml/L com pulverizador manual',
        duracao_dias: 0, duracao_dias_real: 10, phaseKey: 'mudas',
      },
      {
        titulo: 'Pulverização com Enraizador',
        descricao: 'Forth Enraizador 1ml/L com pulverizador manual',
        duracao_dias: 0, duracao_dias_real: 17, phaseKey: 'mudas',
      },
      {
        titulo: 'Vacinação/Prevenção',
        descricao: 'Aplicar Evidence 700 WG + Cabrio Top + Megafol. Usar EPI completo.',
        duracao_dias: 0, duracao_dias_real: 24, phaseKey: 'mudas',
      },
      // Berçário
      {
        titulo: 'Transplante para Berçário',
        descricao: 'Transferir plantas para Perfis Berçário 1. Reservatório R02.',
        duracao_dias: 0, duracao_dias_real: 26, phaseKey: 'bercario',
      },
      {
        titulo: 'Pulverização com Enraizador + Dipel',
        descricao: 'Aplicar com pulverizador manual. Usar EPI.',
        duracao_dias: 0, duracao_dias_real: 31, phaseKey: 'bercario',
      },
      {
        titulo: 'Pulverização com Enraizador + Megafol',
        descricao: 'Aplicar com pulverizador manual.',
        duracao_dias: 0, duracao_dias_real: 38, phaseKey: 'bercario',
      },
      // Crescimento Final
      {
        titulo: 'Transplante para Crescimento Final',
        descricao: 'Transferir para Perfis de Crescimento Final 1. Reservatório R02.',
        duracao_dias: 0, duracao_dias_real: 40, phaseKey: 'crescimento_final',
      },
      {
        titulo: 'Pulverização com Enraizador + Dipel',
        descricao: 'Aplicar com pulverizador manual. Usar EPI.',
        duracao_dias: 0, duracao_dias_real: 45, phaseKey: 'crescimento_final',
      },
      {
        titulo: 'Colheita',
        descricao: 'Colher nos Perfis de Crescimento Final 1. Registrar número de perfis colhidos e quantidade de embalagens.',
        duracao_dias: 0, duracao_dias_real: 54, phaseKey: 'crescimento_final',
      },
    ],
  },
  {
    nome: 'Rúcula',
    descricao: 'Protocolo padrão para rúcula em sistema hidropônico',
    tipo_cultura: 'Folhosa',
    sistema_cultivo: 'Hidroponia',
    implantacao: 'Semeadura direta em bandeja',
    fases: [
      { key: 'mudas', nome: 'Produção de Mudas', duracao_dias: 18 },
      { key: 'crescimento_final', nome: 'Crescimento Final', duracao_dias: 28 },
    ],
    acoes: [
      // Produção de Mudas
      {
        titulo: 'Pulverização com Enraizador',
        descricao: 'Aplicar Forth Enraizador 1ml/L com pulverizador manual',
        duracao_dias: 0, duracao_dias_real: 3, phaseKey: 'mudas',
      },
      {
        titulo: 'Aplicação de Solução Nutritiva',
        descricao: 'Reservatório M02, receita SN Rúcula 01, CE 1,0 mS/cm. Aplicar com pulverizador manual ou regador até drenagem.',
        duracao_dias: 0, duracao_dias_real: 5, phaseKey: 'mudas',
      },
      {
        titulo: 'Pulverização com Enraizador',
        descricao: 'Forth Enraizador 1ml/L com pulverizador manual',
        duracao_dias: 0, duracao_dias_real: 10, phaseKey: 'mudas',
      },
      {
        titulo: 'Vacinação/Prevenção',
        descricao: 'Aplicar Evidence 700 WG + Cabrio Top + Megafol. Usar EPI completo.',
        duracao_dias: 0, duracao_dias_real: 17, phaseKey: 'mudas',
      },
      // Crescimento Final
      {
        titulo: 'Transplante para Crescimento Final',
        descricao: 'Transferir para Perfis de Crescimento Final Rúcula 1. Reservatório R03.',
        duracao_dias: 0, duracao_dias_real: 19, phaseKey: 'crescimento_final',
      },
      {
        titulo: 'Pulverização com Enraizador + Dipel',
        descricao: 'Aplicar com pulverizador manual. Usar EPI.',
        duracao_dias: 0, duracao_dias_real: 24, phaseKey: 'crescimento_final',
      },
      {
        titulo: 'Pulverização com Enraizador + Dipel',
        descricao: 'Aplicar com pulverizador manual. Usar EPI.',
        duracao_dias: 0, duracao_dias_real: 31, phaseKey: 'crescimento_final',
      },
      {
        titulo: 'Pulverização com Enraizador + Dipel',
        descricao: 'Aplicar com pulverizador manual. Usar EPI.',
        duracao_dias: 0, duracao_dias_real: 38, phaseKey: 'crescimento_final',
      },
      {
        titulo: 'Colheita',
        descricao: 'Colher nos Perfis de Crescimento Final Rúcula 1. Registrar número de perfis colhidos e quantidade de embalagens.',
        duracao_dias: 0, duracao_dias_real: 47, phaseKey: 'crescimento_final',
      },
    ],
  },
];

// ────────────────────────────────────────────
// Helper: criar protocolo template (fk_conta_id = null)
// ────────────────────────────────────────────
async function createSystemProtocol(prisma, protocolData) {
  const existing = await prisma.protocolo.findFirst({
    where: {
      nome: protocolData.nome,
      fk_conta_id: null,
      deleted_at: null,
    },
  });

  if (existing) {
    console.log(`- Protocolo template já existe: ${protocolData.nome}`);
    return;
  }

  const protocolo = await prisma.protocolo.create({
    data: {
      nome: protocolData.nome,
      descricao: protocolData.descricao,
      tipo_cultura: protocolData.tipo_cultura,
      sistema_cultivo: protocolData.sistema_cultivo,
      implantacao: protocolData.implantacao,
      fk_conta_id: null,
      fk_cultura_id: null,
    },
  });

  const phaseIdByKey = new Map();
  for (const fase of protocolData.fases) {
    const [inserted] = await prisma.$queryRaw`
      INSERT INTO fases (nome, descricao, duracao_dias, fk_conta_id, fk_protocolo_id)
      VALUES (${fase.nome}, ${fase.descricao ?? null}, ${fase.duracao_dias}, null, ${protocolo.id})
      RETURNING id
    `;
    phaseIdByKey.set(fase.key, inserted.id);
  }

  for (const acao of protocolData.acoes) {
    await prisma.acao.create({
      data: {
        titulo: acao.titulo,
        descricao: acao.descricao,
        alerta: acao.alerta ?? true,
        duracao_dias: acao.duracao_dias,
        duracao_dias_real: acao.duracao_dias_real,
        fk_protocolo_id: protocolo.id,
        fk_fase_id: phaseIdByKey.get(acao.phaseKey),
      },
    });
  }

  console.log(`✓ Protocolo template criado: ${protocolData.nome}`);
}

// ────────────────────────────────────────────
// Dados das soluções nutritivas template (sistema)
// ────────────────────────────────────────────
const solutionsTemplate = [
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

// ────────────────────────────────────────────
// Helper: criar solução nutritiva template
// ────────────────────────────────────────────
async function createSystemSolution(prisma, solutionData) {
  const existing = await prisma.sNutritiva.findFirst({
    where: { nome: solutionData.nome, deleted_at: null },
  });

  if (existing) {
    console.log(`- Solução template já existe: ${solutionData.nome}`);
    return;
  }

  const fertLinks = [];
  for (const item of solutionData.fertilizantes) {
    const fert = await prisma.fertilizante.findFirst({
      where: { nome: item.nome, origin: 'SYSTEM', deleted_at: null },
    });
    if (!fert) {
      console.log(`  ✗ Fertilizante não encontrado: ${item.nome}`);
      continue;
    }
    console.log(`  ✓ Fertilizante localizado: ${item.nome} (id=${fert.id})`);
    fertLinks.push({
      quantidade: item.quantidade,
      fertilizante: { connect: { id: fert.id } },
    });
  }

  await prisma.sNutritiva.create({
    data: {
      nome: solutionData.nome,
      c_eletrica: solutionData.c_eletrica,
      solucoes_fertilizantes_concentradas: {
        create: fertLinks,
      },
    },
  });

  console.log(`✓ Solução template criada: ${solutionData.nome}`);
}

async function main() {
  console.log('Iniciando seed de dados base...');

  // 1. Criar cargos base (idempotente)
  const cargosBase = [
    { id: 1, cargo: 'Dono' },
    { id: 2, cargo: 'Administrator' },
    { id: 3, cargo: 'Funcionario' },
    { id: 4, cargo: 'Convidado' },
  ];

  const cargosCriados = {};

  for (const cargoBase of cargosBase) {
    const cargo = await prisma.cargo.upsert({
      where: { id: cargoBase.id },
      update: { cargo: cargoBase.cargo },
      create: {
        id: cargoBase.id,
        cargo: cargoBase.cargo,
      },
    });

    cargosCriados[cargoBase.cargo] = cargo;
    console.log(`✓ Cargo ${cargoBase.cargo}:`, cargo);
  }

  // 2. Criar permissões (idempotente)
  const permissoes = [
    'caderno-campo-view',
    'caderno-campo-edit',
    'gerencia-equipe-view',
    'gerencia-equipe-edit',
    'reservatorio-view',
    'reservatorio-edit',
    'solucao-nutritiva-view',
    'solucao-nutritiva-edit',
    'area-cultivo-N1-view',
    'area-cultivo-N1-edit',
    'area-cultivo-N2-view',
    'area-cultivo-N2-edit',
    'area-cultivo-N3-view',
    'area-cultivo-N3-edit',
  ];

  console.log('\nCriando permissões...');
  const permissoesCriadas = [];

  for (const nome of permissoes) {
    const existing = await prisma.permissao.findFirst({
      where: { nome },
    });

    if (!existing) {
      const permissao = await prisma.permissao.create({
        data: { nome },
      });
      permissoesCriadas.push(permissao);
      console.log(`✓ Permissão criada: ${nome}`);
    } else {
      permissoesCriadas.push(existing);
      console.log(`- Permissão já existe: ${nome}`);
    }
  }

  // 3. Criar nutrientes base (idempotente)
  const nutrientesBase = [
    { sigla: 'N', nome: 'Nitrogenio' },
    { sigla: 'P', nome: 'Fosforo' },
    { sigla: 'K', nome: 'Potassio' },
    { sigla: 'Ca', nome: 'Calcio' },
    { sigla: 'Mg', nome: 'Magnesio' },
    { sigla: 'S', nome: 'Enxofre' },
    { sigla: 'B', nome: 'Boro' },
    { sigla: 'Cu', nome: 'Cobre' },
    { sigla: 'Fe', nome: 'Ferro' },
    { sigla: 'Mn', nome: 'Manganes' },
    { sigla: 'Mo', nome: 'Molibdenio' },
    { sigla: 'Zn', nome: 'Zinco' },
    { sigla: 'Ni', nome: 'Niquel' },
    { sigla: 'Cl', nome: 'Cloro' },
  ];

  console.log('\nCriando nutrientes base...');

  for (const nutriente of nutrientesBase) {
    const existing = await prisma.nutriente.findFirst({
      where: { sigla: nutriente.sigla },
    });

    if (!existing) {
      await prisma.nutriente.create({
        data: {
          nome: nutriente.nome,
          sigla: nutriente.sigla,
        },
      });
      console.log(`✓ Nutriente criado: ${nutriente.sigla} - ${nutriente.nome}`);
    } else {
      console.log(`- Nutriente já existe: ${nutriente.sigla}`);
    }
  }

  // 4. Associar permissões por cargo (idempotente + convergente)
  console.log('\nAssociando permissões por cargo...');

  const permissoesPorCargo = {
    Owner: {
      allow: permissoes,
    },
    Administrator: {
      deny: [
        'gerencia-equipe-view',
        'gerencia-equipe-edit',
      ],
    },
    Funcionario: {
      allow: [
        'caderno-campo-view',
        'caderno-campo-edit',
        'reservatorio-view',
        'reservatorio-edit',
        'solucao-nutritiva-view',
        'solucao-nutritiva-edit',
        'area-cultivo-N1-view',
        'area-cultivo-N1-edit',
        'area-cultivo-N2-view',
        'area-cultivo-N2-edit',
        'area-cultivo-N3-view',
        'area-cultivo-N3-edit',
      ],
    },
    Convidado: {
      allow: permissoes.filter((nome) => nome.endsWith('-view')),
    },
  };

  for (const [nomeCargo, regra] of Object.entries(permissoesPorCargo)) {
    const cargo = cargosCriados[nomeCargo];

    if (!cargo) {
      throw new Error(`Cargo não encontrado no seed: ${nomeCargo}`);
    }

    const allowSet = new Set(regra.allow || []);
    const denySet = new Set(regra.deny || []);

    for (const permissao of permissoesCriadas) {
      let statusEsperado = false;

      if (allowSet.size > 0) {
        statusEsperado = allowSet.has(permissao.nome);
      } else if (denySet.size > 0) {
        statusEsperado = !denySet.has(permissao.nome);
      }

      const existing = await prisma.cargos_Permissoes.findFirst({
        where: {
          fk_cargos_id: cargo.id,
          fk_permissoes_id: permissao.id,
        },
      });

      if (!existing) {
        await prisma.cargos_Permissoes.create({
          data: {
            fk_cargos_id: cargo.id,
            fk_permissoes_id: permissao.id,
            status: statusEsperado,
          },
        });
        console.log(`✓ Permissão ${permissao.nome} associada ao cargo ${nomeCargo} (status=${statusEsperado})`);
      } else {
        await prisma.cargos_Permissoes.update({
          where: { id: existing.id },
          data: { status: statusEsperado },
        });
        console.log(`- Permissão ${permissao.nome} atualizada no cargo ${nomeCargo} (status=${statusEsperado})`);
      }
    }
  }

  // 5. Criar fertilizantes base e vincular nutrientes (idempotente)
  const fertilizantesBase = [
    { nome: 'Nitrato de Cálcio', nutrientes: [{ sigla: 'N', teor: 15.0 }, { sigla: 'Ca', teor: 20.0 }] },
    { nome: 'Nitrato de Potássio', nutrientes: [{ sigla: 'N', teor: 13.0 }, { sigla: 'K', teor: 36.6 }] },
    { nome: 'Nitrato de Magnésio', nutrientes: [{ sigla: 'N', teor: 11.0 }, { sigla: 'Mg', teor: 9.0 }] },
    { nome: 'Nitrato de Amônio', nutrientes: [{ sigla: 'N', teor: 33.0 }] },
    { nome: 'Sulfato de Potássio', nutrientes: [{ sigla: 'K', teor: 41.5 }, { sigla: 'S', teor: 18.0 }] },
    { nome: 'Sulfato de Magnésio', nutrientes: [{ sigla: 'Mg', teor: 9.5 }, { sigla: 'S', teor: 12.0 }] },
    { nome: 'Cloreto de Cálcio bi', nutrientes: [{ sigla: 'Ca', teor: 27.0 }] },
    { nome: 'MAP', nutrientes: [{ sigla: 'N', teor: 11.0 }, { sigla: 'P', teor: 26.2 }] },
    { nome: 'MKP', nutrientes: [{ sigla: 'P', teor: 22.3 }, { sigla: 'K', teor: 27.4 }] },
    { nome: 'Hidrogood Fert', nutrientes: [{ sigla: 'N', teor: 10.0 }, { sigla: 'P', teor: 9.0 }, { sigla: 'K', teor: 28.0 }, { sigla: 'Mg', teor: 3.3 }, { sigla: 'S', teor: 4.3 }, { sigla: 'B', teor: 0.06 }, { sigla: 'Cu', teor: 0.01 }, { sigla: 'Mn', teor: 0.05 }, { sigla: 'Mo', teor: 0.07 }, { sigla: 'Zn', teor: 0.02 }] },
    { nome: 'Librel Ca', nutrientes: [{ sigla: 'Ca', teor: 9.5 }] },
    { nome: 'Ferro (9%)', nutrientes: [{ sigla: 'S', teor: 6.0 }, { sigla: 'Fe', teor: 9.0 }] },
    { nome: 'Ferro (6,5%)', nutrientes: [{ sigla: 'Fe', teor: 6.5 }] },
    { nome: 'Ácido Bórico', nutrientes: [{ sigla: 'B', teor: 17.0 }] },
    { nome: 'Conmicros', nutrientes: [{ sigla: 'S', teor: 1.82 }, { sigla: 'B', teor: 1.82 }, { sigla: 'Cu', teor: 7.26 }, { sigla: 'Fe', teor: 1.82 }, { sigla: 'Mn', teor: 0.36 }, { sigla: 'Mo', teor: 0.73 }, { sigla: 'Zn', teor: 0.36 }] },
    { nome: 'Librel Mg', nutrientes: [{ sigla: 'Mg', teor: 5.5 }] },
    { nome: 'Óxido de Cálcio Codasal Plus 2000', nutrientes: [{ sigla: 'N', teor: 6.6 }, { sigla: 'Ca', teor: 8.7 }] },
    { nome: 'Rexolin Micro', nutrientes: [{ sigla: 'K', teor: 9.62 }, { sigla: 'S', teor: 1.28 }, { sigla: 'B', teor: 2.10 }, { sigla: 'Cu', teor: 0.36 }, { sigla: 'Fe', teor: 2.66 }, { sigla: 'Mn', teor: 2.48 }, { sigla: 'Mo', teor: 0.04 }, { sigla: 'Zn', teor: 3.38 }] },
    { nome: 'Cálcio Quelatado', nutrientes: [{ sigla: 'Ca', teor: 12.1 }] },
  ];

  console.log('\nCriando fertilizantes base...');

  for (const fert of fertilizantesBase) {
    let fertilizante = await prisma.fertilizante.findFirst({
      where: {
        nome: fert.nome,
        origin: 'SYSTEM',
      },
    });

    if (!fertilizante) {
      fertilizante = await prisma.fertilizante.create({
        data: {
          nome: fert.nome,
          origin: 'SYSTEM',
          fk_contas_id: null,
          deleted_at: null,
          c_eletrica: null,
          compatibilidade: null,
          solubilidade: null,
        },
      });
      console.log(`✓ Fertilizante criado: ${fert.nome}`);
    } else {
      await prisma.fertilizante.update({
        where: {
          id: fertilizante.id,
        },
        data: {
          origin: 'SYSTEM',
          fk_contas_id: null,
          deleted_at: null,
        },
      });
      console.log(`- Fertilizante já existe: ${fert.nome}`);
    }

    for (const nutri of fert.nutrientes) {
      const nutriente = await prisma.nutriente.findFirst({
        where: { sigla: nutri.sigla },
      });

      if (!nutriente) {
        console.log(`  ✗ Nutriente não encontrado: ${nutri.sigla}`);
        continue;
      }

      const linkExistente = await prisma.fertilizantes_Nutrientes.findFirst({
        where: {
          fk_fertilizantes_id: fertilizante.id,
          fk_nutrientes_id: nutriente.id,
        },
      });

      if (!linkExistente) {
        await prisma.fertilizantes_Nutrientes.create({
          data: {
            fk_fertilizantes_id: fertilizante.id,
            fk_nutrientes_id: nutriente.id,
            teor_nutriente: nutri.teor,
          },
        });
        console.log(`  ✓ Nutriente vinculado: ${nutri.sigla} (${nutri.teor}%)`);
      } else {
        console.log(`  - Nutriente já vinculado: ${nutri.sigla}`);
      }
    }
  }

  // 6. Criar protocolos template (idempotente, disponível para todos os usuários)
  console.log('\nCriando protocolos template...');
  for (const template of protocolosTemplate) {
    await createSystemProtocol(prisma, template);
  }

  // 7. Criar soluções nutritivas template (idempotente, disponível via clone na criação de conta)
  console.log('\nCriando soluções nutritivas template...');
  for (const template of solutionsTemplate) {
    await createSystemSolution(prisma, template);
  }

  console.log('\nSeed executado com sucesso! Dados base criados.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
