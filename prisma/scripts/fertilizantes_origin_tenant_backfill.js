const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando backfill de fertilizantes (origin + tenant)...');

  const customUpdated = await prisma.$executeRaw`
    UPDATE fertilizantes
    SET origin = 'CUSTOM'::"FertilizanteOrigin"
    WHERE fk_contas_id IS NOT NULL
      AND origin IS DISTINCT FROM 'CUSTOM'::"FertilizanteOrigin"
  `;

  const systemUpdated = await prisma.$executeRaw`
    UPDATE fertilizantes
    SET origin = 'SYSTEM'::"FertilizanteOrigin"
    WHERE fk_contas_id IS NULL
      AND origin IS DISTINCT FROM 'SYSTEM'::"FertilizanteOrigin"
  `;

  const [counts] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE origin = 'SYSTEM'::"FertilizanteOrigin")::int AS system_count,
      COUNT(*) FILTER (WHERE origin = 'CUSTOM'::"FertilizanteOrigin")::int AS custom_count,
      COUNT(*) FILTER (WHERE origin = 'CUSTOM'::"FertilizanteOrigin" AND fk_contas_id IS NULL)::int AS invalid_custom_without_tenant,
      COUNT(*) FILTER (WHERE origin = 'SYSTEM'::"FertilizanteOrigin" AND fk_contas_id IS NOT NULL)::int AS invalid_system_with_tenant,
      COUNT(*) FILTER (WHERE origin IS NULL)::int AS invalid_origin_null
    FROM fertilizantes
  `;

  const report = {
    updated: {
      custom: Number(customUpdated),
      system: Number(systemUpdated),
    },
    totals: {
      total: counts.total,
      system: counts.system_count,
      custom: counts.custom_count,
    },
    invalid: {
      customWithoutTenant: counts.invalid_custom_without_tenant,
      systemWithTenant: counts.invalid_system_with_tenant,
      originNull: counts.invalid_origin_null,
    },
  };

  console.log('Relatório de backfill:', JSON.stringify(report, null, 2));

  if (
    report.invalid.customWithoutTenant > 0 ||
    report.invalid.systemWithTenant > 0 ||
    report.invalid.originNull > 0
  ) {
    throw new Error('Backfill finalizado com inconsistências de domínio.');
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
