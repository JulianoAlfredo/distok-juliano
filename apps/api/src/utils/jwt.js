'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

/** Assina o JWT (arch §5.1): payload { sub, tid, role, jti }. */
function sign(user) {
  const payload = {
    sub: user.id,
    tid: user.tenant_id || null,
    role: user.role,
    jti: crypto.randomUUID(),
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function verify(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { sign, verify };
