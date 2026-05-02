const Area = require('./area')
const Conta = require('./conta')
const Atividade = require('./atividade')
const Cargo = require('./cargo')
const Cargos_Permissoes = require('./cargos_permissoes')
const SConcentrada = require('./concentrada')
const Cultura = require('./cultura')
const Fase = require('./fase')
const Fertilizante = require('./fertilizante')
const Fertilizantes_Nutrientes = require('./fertilizantes_nutrientes')
const Localizacao = require('./localizacao')
const Log = require('./log')
const Lote = require('./lote')
const Lotes_Atividades = require('./lotes_atividades')
const Nutriente = require('./nutriente')
const Notificacao = require('./notificacoes')
const SNutritiva = require('./snutritiva')
const Permissao = require('./permissao')
const Pessoa = require('./pessoa')
const Reservatorio = require('./reservatorio')
const Solucoes_Contas = require('./solucoes_contas')
const Solucoes_Fertilizantes_Concentradas = require('./solucoes_fertilizantes_concentradas')
const Usuario = require('./usuario')
const ConectaConta = require('./usuarios_contas_cargos')
const Setor = require('./setor')
const Query = require('./query')
const {
  Mutation,
  UpdateFertilizanteInput,
  CreateFertilizanteInput,
  FertilizanteNutrienteInput,
} = require('./mutation')
const DateTime = require('./datetime')
const LoginResponse = require('./loginResponse')
const DescadastroUsuarioContaResponse = require('./descadastroUsuarioContaResponse')
const {
  HomeResumo,
  HomeTarefas,
  HomeProducao,
  HomeCultura,
  HomeDashboard,
  HomeLoteStatus,
  HomeEspecieDetalhe,
  HomeTarefasPorVencimento,
  HomeTarefasPorPrioridade,
  HomeTarefaDetalhe,
  HomeProducaoMensal,
  HomeTaxasMedia,
  HomeComparativoPeriodo,
  HomeCulturaDestaque,
  HomeEquipeResumo,
  HomeAlertaCritico
} = require('./homeDashboard')

// New Tables
const Agenda = require('./agenda')
const Protocolo = require('./protocolo')
const Acao = require('./acao')

const {
  RelatorioCicloFiltros,
  CicloLoteDetalhe,
  CicloRankingCultura,
  RelatorioCicloResult,
} = require('./relatorioCiclo')

const {
  RelatorioDesempenhoFiltros,
  DesempenhoAtividadeItem,
  DesempenhoAgendaItem,
  DesempenhoUsuarioRanking,
  RelatorioDesempenhoResult,
} = require('./relatorioDesempenho')

const {
  RelatorioProdutividadeFiltros,
  ProdutividadeAreaDetalhe,
  ProdutividadeSetorRanking,
  RelatorioProdutividadeResult,
} = require('./relatorioProdutividade')

const {
  RelatorioAgendaFiltros,
  AgendaTarefaItem,
  AgendaLoteTaxaConclusao,
  RelatorioAgendaResult,
} = require('./relatorioAgenda')

module.exports = {
  Agenda,
  Protocolo,
  Acao,
  // Relatório Ciclo
  RelatorioCicloFiltros,
  CicloLoteDetalhe,
  CicloRankingCultura,
  RelatorioCicloResult,
  // Relatório Desempenho
  RelatorioDesempenhoFiltros,
  DesempenhoAtividadeItem,
  DesempenhoAgendaItem,
  DesempenhoUsuarioRanking,
  RelatorioDesempenhoResult,
  // Relatório Produtividade
  RelatorioProdutividadeFiltros,
  ProdutividadeAreaDetalhe,
  ProdutividadeSetorRanking,
  RelatorioProdutividadeResult,
  // Relatório Agenda
  RelatorioAgendaFiltros,
  AgendaTarefaItem,
  AgendaLoteTaxaConclusao,
  RelatorioAgendaResult,
  // Home Dashboard
  HomeResumo,
  HomeTarefas,
  HomeProducao,
  HomeCultura,
  HomeDashboard,
  HomeLoteStatus,
  HomeEspecieDetalhe,
  HomeTarefasPorVencimento,
  HomeTarefasPorPrioridade,
  HomeTarefaDetalhe,
  HomeProducaoMensal,
  HomeTaxasMedia,
  HomeComparativoPeriodo,
  HomeCulturaDestaque,
  HomeEquipeResumo,
  HomeAlertaCritico,
  DateTime,
  Area,
  Conta,
  Atividade,
  Cargo,
  Cargos_Permissoes,
  SConcentrada,
  Cultura,
  Fase,
  Fertilizante,
  Fertilizantes_Nutrientes,
  Localizacao,
  Log,
  Lote,
  Lotes_Atividades,
  Nutriente,
  Notificacao,
  SNutritiva,
  Permissao,
  Pessoa,
  Reservatorio,
  Solucoes_Contas,
  Solucoes_Fertilizantes_Concentradas,
  Usuario,
  ConectaConta,
  Setor,
  Query,
  Mutation,
  CreateFertilizanteInput,
  UpdateFertilizanteInput,
  FertilizanteNutrienteInput,
  LoginResponse,
  DescadastroUsuarioContaResponse,
}
