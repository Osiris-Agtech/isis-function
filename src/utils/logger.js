/**
 * Sistema de logging estruturado para a API
 * Formato baseado em boas práticas de logging em produção
 */

class Logger {
    /**
     * Formata e exibe log estruturado de forma simplificada
     * @param {Object} logData - Dados do log
     */
    static log(logData) {
        const timestamp = new Date().toISOString();
        const { level, type, operation, status, duration, message } = logData;
        
        // Formato simplificado e legível
        if (type === 'request') {
            console.log(`[${timestamp}] ${operation.toUpperCase()} - ${logData.operationType}`);
        } else if (type === 'response') {
            const statusIcon = status === 'success' ? '✓' : '✗';
            const durationStr = duration ? ` (${duration})` : '';
            console.log(`[${timestamp}] ${statusIcon} ${operation.toUpperCase()}${durationStr}${status === 'error' ? ' - ERRO' : ''}`);
            
            // Se houver erros, mostrar mensagem
            if (logData.errors && logData.errors.length > 0) {
                logData.errors.forEach(err => {
                    console.log(`  → ${err.message}`);
                });
            }
        } else if (type === 'error') {
            console.log(`[${timestamp}] ✗ ERRO em ${operation}: ${message}`);
        }
    }

    /**
     * Log de requisição recebida
     */
    static logRequest(requestContext) {
        const { request } = requestContext;
        const operationName = request.operationName || 'Anonymous';
        
        // Determinar tipo de operação (query/mutation/subscription)
        const operationType = this._extractOperationType(request.query);

        this.log({
            level: 'info',
            type: 'request',
            operation: operationName,
            operationType
        });
    }

    /**
     * Log de resposta enviada
     */
    static logResponse(requestContext, response, duration) {
        const { request } = requestContext;
        const operationName = request.operationName || 'Anonymous';
        const { data, errors } = response;

        const logData = {
            level: errors ? 'error' : 'info',
            type: 'response',
            operation: operationName,
            status: errors ? 'error' : 'success',
            duration: `${duration}ms`
        };

        if (errors) {
            // Log de erros - apenas mensagem principal
            logData.errors = errors.map(err => ({
                message: err.message
            }));
        }

        this.log(logData);
    }

    /**
     * Extrai o tipo de operação da query GraphQL
     */
    static _extractOperationType(query) {
        if (!query) return 'unknown';
        const upperQuery = query.toUpperCase().trim();
        if (upperQuery.startsWith('QUERY')) return 'query';
        if (upperQuery.startsWith('MUTATION')) return 'mutation';
        if (upperQuery.startsWith('SUBSCRIPTION')) return 'subscription';
        return 'query'; // default
    }

    /**
     * Log de erro
     */
    static logError(error, context = {}) {
        const { operation, duration } = context;
        const durationStr = duration ? ` (${duration})` : '';
        const timestamp = new Date().toISOString();
        
        console.log(`[${timestamp}] ✗ ERRO em ${operation || 'Unknown'}${durationStr}: ${error.message}`);
    }
}

module.exports = Logger;
