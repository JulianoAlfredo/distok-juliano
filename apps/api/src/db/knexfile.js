'use strict';

const path = require('path');
const env = require('../config/env');

/** Configuração base do Knex para MySQL (Hostinger). */
const base = {
  client: 'mysql2',
  connection: {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    charset: 'utf8mb4',
    timezone: 'Z', // grava/lê em UTC
    dateStrings: true,
  },
  pool: { min: 0, max: 7 }, // pool pequeno: shared hosting
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(__dirname, 'seeds'),
  },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
