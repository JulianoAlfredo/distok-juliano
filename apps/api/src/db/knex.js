'use strict';

const knexLib = require('knex');
const env = require('../config/env');
const config = require('./knexfile');

// Instância única do Knex (pool compartilhado em todo o processo).
const knex = knexLib(config[env.NODE_ENV] || config.development);

module.exports = knex;
