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
    // Passenger (Hostinger) injeta o socket via variável; fora dele usa PORT.
    const listenOpts =
      typeof PhusionPassenger !== 'undefined'
        ? { path: 'passenger' }
        : { port: env.PORT, host: '0.0.0.0' };
    await app.listen(listenOpts);
    app.log.info(`DISTOK API no ar (${env.NODE_ENV})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (typeof PhusionPassenger !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}

start();
