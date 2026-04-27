const http = require('node:http');
const { createYoga } = require('graphql-yoga');
const { makeSchema } = require('@nexus/schema');
const { nexusPrisma } = require('nexus-plugin-prisma');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const jwt = require('jsonwebtoken');
const { maskGraphQLError } = require('./errors/apiErrors');

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
    maskedErrors: {
        maskError: (error) => maskGraphQLError(error),
    },
    context: ({ request }) => ({
        prisma,
        authUserId: extractAuthUserId(request),
    }),
});

const server = http.createServer(yoga);
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/graphql`);
});

module.exports = server;
