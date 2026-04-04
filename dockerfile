FROM node:lts

RUN apt-get install libssl-dev

WORKDIR api/
COPY . .

RUN npm install --force
RUN npx prisma generate
CMD ["node", "src/index.js"]