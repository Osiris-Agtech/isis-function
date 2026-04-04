# Sistema de Logging da API

Este documento descreve o sistema de logging implementado na API GraphQL.

## Visão Geral

O sistema de logging captura automaticamente informações sobre todas as requisições GraphQL, incluindo:
- Operação executada (query/mutation)
- Status da requisição (sucesso/erro)
- Tempo de execução
- Resumo da resposta (tipo de dados, tamanho de listas)
- Informações de erro quando aplicável
- IP do cliente

## Formato dos Logs

Os logs são emitidos em formato JSON estruturado, facilitando o processamento por ferramentas de análise de logs.

### Exemplo de Log de Requisição

```json
{
  "timestamp": "2024-01-14T12:00:00.000Z",
  "level": "info",
  "type": "request",
  "operation": "GetUsuarios",
  "operationType": "query",
  "ip": "192.168.1.1",
  "hasVariables": true,
  "queryLength": 245
}
```

### Exemplo de Log de Resposta (Sucesso)

```json
{
  "timestamp": "2024-01-14T12:00:00.150Z",
  "level": "info",
  "type": "response",
  "operation": "GetUsuarios",
  "status": "success",
  "duration": "150ms",
  "responseSummary": {
    "usuarios": {
      "type": "array",
      "length": 10,
      "itemType": "object"
    }
  }
}
```

### Exemplo de Log de Resposta (Erro)

```json
{
  "timestamp": "2024-01-14T12:00:00.150Z",
  "level": "error",
  "type": "response",
  "operation": "Login",
  "status": "error",
  "duration": "50ms",
  "errors": [
    {
      "message": "Credenciais inválidas",
      "path": ["login"],
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

## Componentes

### Logger (`src/utils/logger.js`)

Classe utilitária que fornece métodos para logging estruturado:
- `log(logData)`: Método principal para emitir logs
- `logRequest(requestContext)`: Log de requisições recebidas
- `logResponse(requestContext, response)`: Log de respostas enviadas
- `logError(error, context)`: Log de erros
- `summarizeResponse(data)`: Cria resumo estruturado dos dados de resposta

### Logging Plugin (`src/plugins/loggingPlugin.js`)

Plugin do Apollo Server que integra o sistema de logging:
- Captura requisições no início (`requestDidStart`)
- Registra respostas ao serem enviadas (`willSendResponse`)
- Captura erros durante parsing/validação (`didEncounterErrors`)

## Características

### Segurança
- Não loga dados sensíveis (senhas, tokens completos)
- Não loga queries completas, apenas metadados
- Loga apenas estrutura e tipos de dados retornados

### Performance
- Logging assíncrono não bloqueia requisições
- Resumos de dados limitados para evitar logs excessivamente grandes
- Limitação de profundidade em objetos aninhados

### Informações Capturadas

**Requisições:**
- Nome da operação
- Tipo (query/mutation/subscription)
- IP do cliente
- Presença de variáveis
- Tamanho da query

**Respostas:**
- Status (sucesso/erro)
- Tempo de execução
- Resumo dos dados retornados:
  - Tipo de dados (array, object, primitivo)
  - Tamanho de listas
  - Estrutura de objetos (chaves principais)
- Detalhes de erros (mensagem, path, código)

## Uso em Produção

Para uso em produção, recomenda-se:
1. Integrar com serviços de logging (ELK, CloudWatch, Datadog, etc.)
2. Configurar rotação de logs
3. Adicionar filtros para logs sensíveis
4. Monitorar métricas de performance através dos logs

## Exemplo de Integração com Serviço de Logging

```javascript
// Em src/utils/logger.js, modificar o método log():
static log(logData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        ...logData
    };
    
    // Enviar para serviço de logging externo
    // cloudwatch.putLogEvents(...)
    // ou
    // winston.info(JSON.stringify(logEntry))
    
    console.log(JSON.stringify(logEntry));
}
```
