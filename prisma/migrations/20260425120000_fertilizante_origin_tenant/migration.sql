-- CreateEnum
CREATE TYPE "FertilizanteOrigin" AS ENUM ('SYSTEM', 'CUSTOM');

-- AlterTable
ALTER TABLE "fertilizantes"
ADD COLUMN "origin" "FertilizanteOrigin",
ADD COLUMN "fk_contas_id" INTEGER;

-- Backfill seguro (apenas casos determinísticos)
UPDATE "fertilizantes"
SET "origin" = 'CUSTOM'::"FertilizanteOrigin"
WHERE "origin" IS NULL
  AND "fk_contas_id" IS NOT NULL;

-- Estratégia mínima para legado: sem tenant => SYSTEM.
-- Risco controlado: classifica legado histórico como catálogo global
-- para evitar falha imediata em bases não vazias durante o deploy.
UPDATE "fertilizantes"
SET "origin" = 'SYSTEM'::"FertilizanteOrigin"
WHERE "origin" IS NULL
  AND "fk_contas_id" IS NULL;

-- Enforce origem obrigatória
ALTER TABLE "fertilizantes"
ALTER COLUMN "origin" SET NOT NULL;

-- Invariantes de domínio origem x tenant
ALTER TABLE "fertilizantes"
ADD CONSTRAINT "fertilizantes_origin_fk_contas_id_check"
CHECK (
  ("origin" = 'SYSTEM'::"FertilizanteOrigin" AND "fk_contas_id" IS NULL)
  OR
  ("origin" = 'CUSTOM'::"FertilizanteOrigin" AND "fk_contas_id" IS NOT NULL)
);

-- Compatibilidade com ambientes legados sem soft-delete
ALTER TABLE "fertilizantes"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(6);

-- CreateIndex
CREATE INDEX "fertilizantes_origin_deleted_at_idx" ON "fertilizantes"("origin", "deleted_at");

-- CreateIndex
CREATE INDEX "fertilizantes_fk_contas_id_deleted_at_idx" ON "fertilizantes"("fk_contas_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "fertilizantes" ADD CONSTRAINT "fk_fertilizantes_contas_1" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
