const http = require('node:http');
const { createYoga } = require('graphql-yoga');
const { makeSchema } = require('@nexus/schema');
const { nexusPrisma } = require('nexus-plugin-prisma');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

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

const yoga = createYoga({
    schema,
    context: () => ({ prisma }),
});

const server = http.createServer(yoga);
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/graphql`);
});

module.exports = server;
