const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Seeds idempotentes — adicionar dados base conforme necessidade
  // Exemplo:
  //
  // await prisma.conta.upsert({
  //   where: { id: 1 },
  //   update: {},
  //   create: { nome: 'Conta Demo', nivel: '1' },
  // });

  console.log('Seed executado — nenhum dado base necessário ainda');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
