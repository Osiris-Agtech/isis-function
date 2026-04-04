-- CreateTable
CREATE TABLE "areas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "descricao" VARCHAR,
    "imagem" VARCHAR,
    "tipo" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_contas_id" INTEGER,
    "fk_localizacoes_id" INTEGER,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "privado" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_contas_id" INTEGER,
    "descricao" VARCHAR,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" SERIAL NOT NULL,
    "cargo" VARCHAR,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos_permissoes" (
    "id" SERIAL NOT NULL,
    "fk_permissoes_id" INTEGER,
    "fk_cargos_id" INTEGER,
    "status" BOOLEAN DEFAULT false,

    CONSTRAINT "cargos_permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concentradas" (
    "id" SERIAL NOT NULL,
    "volume" DECIMAL,
    "nome" VARCHAR,
    "fator_concentracao" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concentradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas" (
    "id" SERIAL NOT NULL,
    "nivel" VARCHAR,
    "nome" VARCHAR,
    "imagem" VARCHAR,
    "cnpj" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culturas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "privado" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_contas_id" INTEGER,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "culturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fertilizantes" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "c_eletrica" DECIMAL,
    "compatibilidade" INTEGER,
    "solubilidade" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fertilizantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localizacoes" (
    "cep" VARCHAR,
    "endereco" VARCHAR,
    "cidade" VARCHAR,
    "estado" VARCHAR,
    "pais" VARCHAR,
    "id" SERIAL NOT NULL,
    "complemento" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "bairro" VARCHAR,
    "fk_conta_id" INTEGER,
    "numero" VARCHAR,

    CONSTRAINT "localizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "descricao" VARCHAR,
    "fk_usuarios_id" INTEGER,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "fase_dias" INTEGER,
    "fase_data" TIMESTAMP(6),
    "registro_data" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "semeadura_data" TIMESTAMP(6),
    "transplantio_data" TIMESTAMP(6),
    "colheita_data" TIMESTAMP(6),
    "proxima_fase" INTEGER,
    "ativo" BOOLEAN DEFAULT true,
    "bandeijas_semeadas" INTEGER,
    "mudas_transplantadas" INTEGER,
    "plantas_colhidas" INTEGER,
    "embalagens_produzidas" INTEGER,
    "fk_setores_id" INTEGER,
    "fk_reservatorios_id" INTEGER,
    "fk_culturas_id" INTEGER,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_atividades" (
    "id" SERIAL NOT NULL,
    "fk_lotes_id" INTEGER,
    "fk_atividades_id" INTEGER,
    "fk_usuarios_id" INTEGER,
    "fk_contas_id" INTEGER,

    CONSTRAINT "lotes_atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrientes" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "sigla" VARCHAR,

    CONSTRAINT "nutrientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissoes" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "sobrenome" VARCHAR,
    "telefone" VARCHAR,
    "imagem" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_localizacoes_id" INTEGER,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservatorios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "volume" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_solucoes_id" INTEGER,
    "fk_contas_id" INTEGER,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "reservatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setores" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "descricao" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_areas_id" INTEGER,
    "fk_reservatorios_id" INTEGER,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solucoes" (
    "id" SERIAL NOT NULL,
    "c_eletrica" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "nome" VARCHAR,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "solucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solucoes_fertilizantes_concentradas" (
    "id" SERIAL NOT NULL,
    "fk_solucoes_id" INTEGER,
    "fk_fertilizantes_id" INTEGER,
    "fk_concentradas_id" INTEGER,
    "quantidade" DECIMAL,

    CONSTRAINT "solucoes_fertilizantes_concentradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "senha" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "email" VARCHAR,
    "ativo" BOOLEAN DEFAULT true,
    "nome" VARCHAR,
    "cod_acesso" VARCHAR,
    "acesso_externo" BOOLEAN DEFAULT false,
    "fk_pessoas_id" INTEGER,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_contas_cargos" (
    "id" SERIAL NOT NULL,
    "fk_usuarios_id" INTEGER,
    "fk_contas_id" INTEGER,
    "fk_cargos_id" INTEGER,

    CONSTRAINT "usuarios_contas_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fertilizantes_nutrientes" (
    "id" SERIAL NOT NULL,
    "fk_nutrientes_id" INTEGER,
    "fk_fertilizantes_id" INTEGER,
    "teor_nutriente" DECIMAL,

    CONSTRAINT "fertilizantes_nutrientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solucoes_contas" (
    "id" SERIAL NOT NULL,
    "fk_contas_id" INTEGER,
    "fk_solucoes_id" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "conta_original" INTEGER,

    CONSTRAINT "solucoes_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR NOT NULL,
    "valor" VARCHAR,
    "descricao" VARCHAR,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "descricao" VARCHAR,
    "tipo_cultura" VARCHAR,
    "sistema_cultivo" VARCHAR,
    "implantacao" VARCHAR,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_conta_id" INTEGER,
    "fk_cultura_id" INTEGER,

    CONSTRAINT "protocolos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acoes" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR,
    "descricao" VARCHAR,
    "alerta" BOOLEAN NOT NULL DEFAULT true,
    "duracao_dias" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_protocolo_id" INTEGER,
    "fk_fase_id" INTEGER,

    CONSTRAINT "acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fases" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR,
    "descricao" VARCHAR,
    "duracao_dias" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_conta_id" INTEGER,

    CONSTRAINT "fases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendas" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR,
    "descricao" VARCHAR,
    "alerta" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "finalizado" BOOLEAN NOT NULL DEFAULT false,
    "data" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_conta_id" INTEGER,
    "fk_lote_id" INTEGER,
    "fk_usuarios_id" INTEGER,

    CONSTRAINT "agendas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "fk_areas_2" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "fk_areas_3" FOREIGN KEY ("fk_localizacoes_id") REFERENCES "localizacoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "fk_atividades_2" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cargos_permissoes" ADD CONSTRAINT "fk_cargos_permissoes_2" FOREIGN KEY ("fk_cargos_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cargos_permissoes" ADD CONSTRAINT "fk_cargos_permissoes_1" FOREIGN KEY ("fk_permissoes_id") REFERENCES "permissoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "culturas" ADD CONSTRAINT "fk_culturas_2" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "localizacoes" ADD CONSTRAINT "fk_conta_1" FOREIGN KEY ("fk_conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "fk_logs_2" FOREIGN KEY ("fk_usuarios_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "fk_lotes_4" FOREIGN KEY ("fk_culturas_id") REFERENCES "culturas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "fk_lotes_3" FOREIGN KEY ("fk_reservatorios_id") REFERENCES "reservatorios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "fk_lotes_2" FOREIGN KEY ("fk_setores_id") REFERENCES "setores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes_atividades" ADD CONSTRAINT "fk_lotes_atividades_2" FOREIGN KEY ("fk_atividades_id") REFERENCES "atividades"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes_atividades" ADD CONSTRAINT "fk_lotes_atividades_4" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes_atividades" ADD CONSTRAINT "fk_lotes_atividades_1" FOREIGN KEY ("fk_lotes_id") REFERENCES "lotes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes_atividades" ADD CONSTRAINT "fk_lotes_atividades_3" FOREIGN KEY ("fk_usuarios_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "fk_pessoa_1" FOREIGN KEY ("fk_localizacoes_id") REFERENCES "localizacoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservatorios" ADD CONSTRAINT "fk_reservatorios_3" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservatorios" ADD CONSTRAINT "fk_reservatorios_2" FOREIGN KEY ("fk_solucoes_id") REFERENCES "solucoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setores" ADD CONSTRAINT "fk_setores_2" FOREIGN KEY ("fk_areas_id") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "setores" ADD CONSTRAINT "fk_setores_3" FOREIGN KEY ("fk_reservatorios_id") REFERENCES "reservatorios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solucoes_fertilizantes_concentradas" ADD CONSTRAINT "fk_solucoes_fertilizantes_concentradas_3" FOREIGN KEY ("fk_concentradas_id") REFERENCES "concentradas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solucoes_fertilizantes_concentradas" ADD CONSTRAINT "fk_solucoes_fertilizantes_concentradas_2" FOREIGN KEY ("fk_fertilizantes_id") REFERENCES "fertilizantes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solucoes_fertilizantes_concentradas" ADD CONSTRAINT "fk_solucoes_fertilizantes_concentradas_1" FOREIGN KEY ("fk_solucoes_id") REFERENCES "solucoes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "fk_usuarios_2" FOREIGN KEY ("fk_pessoas_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios_contas_cargos" ADD CONSTRAINT "fk_usuarios_contas_cargos_3" FOREIGN KEY ("fk_cargos_id") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios_contas_cargos" ADD CONSTRAINT "fk_usuarios_contas_cargos_2" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios_contas_cargos" ADD CONSTRAINT "fk_usuarios_contas_cargos_1" FOREIGN KEY ("fk_usuarios_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fertilizantes_nutrientes" ADD CONSTRAINT "fk_fertilizantes_nutrientes_2" FOREIGN KEY ("fk_fertilizantes_id") REFERENCES "fertilizantes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fertilizantes_nutrientes" ADD CONSTRAINT "fk_fertilizantes_nutrientes_1" FOREIGN KEY ("fk_nutrientes_id") REFERENCES "nutrientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solucoes_contas" ADD CONSTRAINT "fk_solucoes_contas_1" FOREIGN KEY ("fk_contas_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solucoes_contas" ADD CONSTRAINT "fk_solucoes_contas_2" FOREIGN KEY ("fk_solucoes_id") REFERENCES "solucoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocolos" ADD CONSTRAINT "protocolos_fk_conta_id_fkey" FOREIGN KEY ("fk_conta_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos" ADD CONSTRAINT "protocolos_fk_cultura_id_fkey" FOREIGN KEY ("fk_cultura_id") REFERENCES "culturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes" ADD CONSTRAINT "acoes_fk_protocolo_id_fkey" FOREIGN KEY ("fk_protocolo_id") REFERENCES "protocolos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes" ADD CONSTRAINT "acoes_fk_fase_id_fkey" FOREIGN KEY ("fk_fase_id") REFERENCES "fases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fases" ADD CONSTRAINT "fases_fk_conta_id_fkey" FOREIGN KEY ("fk_conta_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_fk_conta_id_fkey" FOREIGN KEY ("fk_conta_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_fk_lote_id_fkey" FOREIGN KEY ("fk_lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_fk_usuarios_id_fkey" FOREIGN KEY ("fk_usuarios_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
