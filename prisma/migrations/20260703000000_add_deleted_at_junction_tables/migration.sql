-- Add deleted_at to junction tables for soft delete consistency
ALTER TABLE solucoes_contas ADD COLUMN deleted_at TIMESTAMP(6);
ALTER TABLE solucoes_fertilizantes_concentradas ADD COLUMN deleted_at TIMESTAMP(6);
