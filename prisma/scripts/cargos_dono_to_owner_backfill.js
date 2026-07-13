const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando backfill seguro: cargo "Owner" → "Dono"...');

  const updated = await prisma.$executeRaw`
    UPDATE cargos
    SET cargo = 'Dono'
    WHERE cargo = 'Owner'
  `;

  const [counts] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE cargo = 'Owner')::int AS owner_count,
      COUNT(*) FILTER (WHERE cargo = 'Dono')::int AS dono_count
    FROM cargos
  `;

  console.log('Relatório de backfill:', JSON.stringify({ updated: Number(updated), ...counts }, null, 2));

  if (counts.owner_count > 0) {
    throw new Error(`Backfill incompleto: ainda existem ${counts.owner_count} registro(s) com cargo = 'Owner'.`);
  }

  console.log('Backfill finalizado com sucesso.');
}

main()
  .catch((error) => {
    console.error('Erro no backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
