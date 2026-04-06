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

  // 4. Associar todas as permissões ao cargo Owner (status: true)
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
