# Structure

```
isis/
├── src/
│   ├── index.js                    # Entry point — Apollo Server + cron bootstrap
│   ├── schema.js                   # makeSchema() — carrega todos os tipos e gera SDL
│   ├── alerta_agenda.js            # Cron + envio de e-mail (credenciais hardcoded)
│   ├── schemas/
│   │   ├── index.js               # Re-exporta todos os tipos para schema.js
│   │   ├── query.js               # TODAS as queries (786 linhas)
│   │   ├── mutation.js            # TODAS as mutations (800+ linhas)
│   │   ├── datetime.js            # Scalar customizado DateTime
│   │   ├── loginResponse.js       # Tipo LoginResponse
│   │   ├── homeDashboard.js       # Tipos do dashboard (HomeResumo, HomeTarefas, etc.)
│   │   ├── relatorioCiclo.js      # Tipos do relatório de ciclo de cultura
│   │   ├── relatorioDesempenho.js # Tipos do relatório de desempenho
│   │   ├── area.js
│   │   ├── atividade.js
│   │   ├── cargo.js
│   │   ├── concentrada.js
│   │   ├── conta.js
│   │   ├── cultura.js
│   │   ├── fase.js
│   │   ├── fertilizante.js
│   │   ├── localizacao.js
│   │   ├── log.js
│   │   ├── lote.js
│   │   ├── notificacao.js
│   │   ├── nutriente.js
│   │   ├── permissao.js
│   │   ├── pessoa.js
│   │   ├── protocolo.js
│   │   ├── reservatorio.js
│   │   ├── setor.js
│   │   ├── snutritiva.js
│   │   ├── usuario.js
│   │   └── usuarios_contas_cargos.js  # Junction table ConectaConta
│   ├── plugins/
│   │   └── loggingPlugin.js       # Plugin Apollo para log de requests/responses
│   └── utils/
│       └── logger.js              # Classe Logger (criada mas pouco usada)
├── prisma/
│   ├── schema.prisma              # 39 models, credenciais hardcoded
│   ├── migrations/                # (gitignored)
│   └── generated/
│       └── nexus.ts               # Tipos TS gerados pelo nexus-plugin-prisma
├── src/schema.graphql             # SDL gerado em runtime pelo makeSchema()
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Entidades Prisma (39 models)

| Model | Propósito |
|-------|-----------|
| Conta | Empresa/fazenda — raiz do multi-tenancy |
| Usuario | Usuário do sistema |
| Pessoa | Dados pessoais do usuário |
| Localizacao | Endereço/GPS |
| Area | Zona da fazenda |
| Setor | Setor dentro de uma área |
| Lote | Ciclo de cultivo (batch) |
| Cultura | Tipo de cultura |
| Protocolo | Protocolo de cultivo |
| Fase | Fase de crescimento |
| Acao | Tarefa em uma fase do protocolo |
| Agenda | Tarefa agendada/lembrete |
| Reservatorio | Reservatório de água |
| SNutritiva | Solução nutritiva |
| Fertilizante | Produto fertilizante |
| Nutriente | Elemento nutritivo |
| Concentrada | Solução concentrada |
| Cargo | Função/cargo do usuário |
| Permissao | Permissão de acesso |
| Log | Log de auditoria |
| Notificacao | Configuração de notificação |
| ConectaConta | Junction: usuario ↔ conta ↔ cargo |
| Cargos_Permissoes | Junction: cargo ↔ permissão |
| Lotes_Atividades | Junction: lote ↔ atividade ↔ usuario |
| Fertilizantes_Nutrientes | Junction: fertilizante ↔ nutriente |
| Solucoes_Contas | Junction: solução ↔ conta |
| Solucoes_Fertilizantes_Concentradas | Junction: solução ↔ fertilizante/concentrada |
