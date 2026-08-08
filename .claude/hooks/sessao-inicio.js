#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const BRAIN_DIR = path.join(process.env.HOME || '', 'distok-brain');

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

try {
  const input = readStdin();
  const sessionId = input.session_id || 'unknown';

  const branch = run('git rev-parse --abbrev-ref HEAD') || '(sem branch)';
  const statusLines = run('git status --porcelain').split('\n').filter(Boolean);
  const dirty = statusLines.length > 0 ? `suja, ${statusLines.length} arquivo(s)` : 'limpa';
  const commits = run('git log -5 --oneline') || '(sem commits)';

  let estadoAtual;
  try {
    const content = fs.readFileSync(path.join(BRAIN_DIR, '01 - Projeto', 'Estado Atual.md'), 'utf8');
    estadoAtual = content.split('\n').slice(0, 60).join('\n');
  } catch {
    estadoAtual = '(Estado Atual.md não encontrado em distok-brain)';
  }

  const context = [
    'ESTADO VIVO DO DISTOK — injetado pelo hook SessionStart.',
    `Branch: ${branch}`,
    `Árvore: ${dirty}`,
    'Últimos commits:',
    commits,
    '',
    'Estado Atual (distok-brain):',
    estadoAtual,
  ].join('\n');

  const tmpDir = path.join(PROJECT_DIR, '.claude', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, `sessao-${sessionId}.inicio`), String(Date.now()));

  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));
} catch {
  // falha aberta: sessão abre normal mesmo se o hook quebrar
}
