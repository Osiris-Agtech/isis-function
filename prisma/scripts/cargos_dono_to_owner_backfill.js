const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando backfill: cargo "Dono" → "Owner"...');

  const updated = await prisma.$executeRaw`
    UPDATE cargos
    SET cargo = 'Owner'
    WHERE cargo = 'Dono'
  `;

  const [counts] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE cargo = 'Owner')::int AS owner_count,
      COUNT(*) FILTER (WHERE cargo = 'Dono')::int AS dono_count
    FROM cargos
  `;

  console.log('Relatório de backfill:', JSON.stringify({ updated: Number(updated), ...counts }, null, 2));

  if (counts.dono_count > 0) {
    throw new Error(`Backfill incompleto: ainda existem ${counts.dono_count} registro(s) com cargo = 'Dono'.`);
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
