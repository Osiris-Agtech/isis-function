-- Limpeza de legado aprovada para o corte de modelo
DELETE FROM "acoes";

DELETE FROM "fases";

DELETE FROM "protocolos";

-- Evolução do modelo para fase por protocolo
ALTER TABLE "fases"
ADD COLUMN "fk_protocolo_id" INTEGER NOT NULL;

CREATE INDEX "idx_fases_fk_protocolo_id"
ON "fases" ("fk_protocolo_id");

ALTER TABLE "fases"
ADD CONSTRAINT "fases_fk_protocolo_id_fkey"
FOREIGN KEY ("fk_protocolo_id") REFERENCES "protocolos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
