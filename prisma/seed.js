const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de dados base...');

  // 1. Criar cargo Owner (idempotente)
  const cargoOwner = await prisma.cargo.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      cargo: 'Owner',
    },
  });
  console.log('✓ Cargo Owner:', cargoOwner);

  // 2. Criar SNutritivas base (IDs 12-16) com dados mínimos
  // Esses são placeholders - ajuste os valores conforme necessário
  const solucoesBase = [
    { id: 12, nome: 'Solução A', c_eletrica: 1.0 },
    { id: 13, nome: 'Solução B', c_eletrica: 1.2 },
    { id: 14, nome: 'Solução C', c_eletrica: 1.5 },
    { id: 15, nome: 'Solução D', c_eletrica: 1.8 },
    { id: 16, nome: 'Solução E', c_eletrica: 2.0 },
  ];

  for (const solucao of solucoesBase) {
    const existing = await prisma.sNutritiva.findUnique({
      where: { id: solucao.id }
    });

    if (!existing) {
      await prisma.sNutritiva.create({
        data: {
          id: solucao.id,
          nome: solucao.nome,
          c_eletrica: solucao.c_eletrica,
        }
      });
      console.log(`✓ SNutritiva criada: id=${solucao.id}, nome=${solucao.nome}`);
    } else {
      console.log(`- SNutritiva já existe: id=${solucao.id}`);
    }
  }

  // 3. Criar permissões (idempotente)
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

  // 4. Criar nutrientes base (idempotente)
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

  // 5. Associar todas as permissões ao cargo Owner (status: true)
  console.log('\nAssociando permissões ao cargo Owner...');

  for (const permissao of permissoesCriadas) {
    const existing = await prisma.cargos_Permissoes.findFirst({
      where: {
        fk_cargos_id: cargoOwner.id,
        fk_permissoes_id: permissao.id,
      },
    });

    if (!existing) {
      await prisma.cargos_Permissoes.create({
        data: {
          fk_cargos_id: cargoOwner.id,
          fk_permissoes_id: permissao.id,
          status: true,
        },
      });
      console.log(`✓ Permissão ${permissao.nome} associada ao Owner`);
    } else {
      console.log(`- Permissão ${permissao.nome} já associada ao Owner`);
    }
  }

  // 6. Criar fertilizantes base e vincular nutrientes (idempotente)
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
