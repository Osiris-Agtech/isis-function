const functions = require('firebase-functions');
const { createYoga } = require('graphql-yoga');
const { makeSchema } = require('@nexus/schema');
const { nexusPrisma } = require('nexus-plugin-prisma');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const jwt = require('jsonwebtoken');

// Carregar todos os tipos Nexus existentes
const types = require('./schemas');

// Recriar o schema com makeSchema do Nexus + plugin Prisma
const schema = makeSchema({
    types,
    plugins: [nexusPrisma({ experimentalCRUD: true })],
    outputs: {
        schema: path.join(__dirname, 'schema.graphql'),
        typegen: path.join(__dirname, '..', 'prisma', 'generated', 'nexus.ts'),
    },
});

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

function getJwtSecretOrThrow() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('Configuração de autenticação inválida: JWT_SECRET ausente');
    }

    return secret;
}

function extractAuthUserId(request) {
    const authorizationHeader = request?.headers?.get('authorization');
    if (typeof authorizationHeader !== 'string') {
        return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return null;
    }

    const secret = getJwtSecretOrThrow();

    try {
        const payload = jwt.verify(token, secret);
        if (typeof payload === 'object' && Number.isInteger(payload.id)) {
            return payload.id;
        }
        return null;
    } catch (_error) {
        return null;
    }
}

const yoga = createYoga({
    schema,
    context: ({ request }) => ({
        prisma,
        authUserId: extractAuthUserId(request),
    }),
});

// Firebase Function: GraphQL API (HTTP, público)
exports.graphqlHandler = functions.https.onRequest(yoga);

// Firebase Function: Alerta de Agenda (HTTP, chamado por Cloud Scheduler)
const { handleAlertaAgenda } = require('./cron/alertaAgenda');
exports.alertaAgendaHandler = functions.https.onRequest(handleAlertaAgenda);
