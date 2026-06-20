'use strict';

const { buildApp } = require('./app');
const env = require('./config/env');

/**
 * Entry point. Compatível com:
 *  - execução standalone (node src/server.js) — escuta em PORT
 *  - Passenger (Hostinger) — Passenger injeta o socket/porta via env
 */
async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`DISTOK API ouvindo em :${env.PORT} (${env.NODE_ENV})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
