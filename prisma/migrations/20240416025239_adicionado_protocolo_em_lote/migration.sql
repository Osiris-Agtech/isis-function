-- AlterTable
ALTER TABLE "lotes" ADD COLUMN     "fk_protocolos_id" INTEGER;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "fk_lotes_5" FOREIGN KEY ("fk_protocolos_id") REFERENCES "protocolos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
