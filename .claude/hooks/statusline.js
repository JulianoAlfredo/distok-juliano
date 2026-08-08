#!/usr/bin/env node
const { execSync } = require('child_process');

function readStdin() {
  try {
    const data = require('fs').readFileSync(0, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const input = readStdin();
const cwd = input.cwd || input.workspace?.current_dir || process.cwd();
const dir = require('path').basename(cwd);
const branch = run('git rev-parse --abbrev-ref HEAD', cwd);

const parts = ['🥶 caveman ativo', dir];
if (branch) parts.push(branch);
process.stdout.write(parts.join(' | '));
