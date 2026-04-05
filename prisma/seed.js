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
