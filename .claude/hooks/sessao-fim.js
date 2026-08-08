#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const BRAIN_DIR = path.join(process.env.HOME || '', 'distok-brain');
const TMP_DIR = path.join(PROJECT_DIR, '.claude', 'tmp');

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

function liberar() {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
  process.exit(0);
}

function tocouRecentemente(dir, sinceMs, depth) {
  if (depth > 6) return false;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name === '.obsidian' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (tocouRecentemente(full, sinceMs, depth + 1)) return true;
      continue;
    }
    try {
      if (fs.statSync(full).mtimeMs >= sinceMs) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

try {
  const input = readStdin();

  // evita loop infinito: não bloqueia duas vezes na mesma cadeia de Stop
  if (input.stop_hook_active) {
    liberar();
  }

  const sessionId = input.session_id || 'unknown';
  const markerInicio = path.join(TMP_DIR, `sessao-${sessionId}.inicio`);
  const markerBloqueado = path.join(TMP_DIR, `sessao-${sessionId}.bloqueado`);

  // já bloqueou uma vez nesta sessão: não insiste
  if (fs.existsSync(markerBloqueado)) {
    liberar();
  }

  let inicioMs = 0;
  try {
    inicioMs = Number(fs.readFileSync(markerInicio, 'utf8'));
  } catch {
    // sem marcador: sessão não passou pelo SessionStart deste hook, libera
    liberar();
  }

  const statusLines = run('git status --porcelain').split('\n').filter(Boolean);
  const treeDirty = statusLines.length > 0;
  const lastCommitMs = (Number(run('git log -1 --format=%ct')) || 0) * 1000;
  const commitNovo = lastCommitMs >= inicioMs;
  const mexeuNoCodigo = treeDirty || commitNovo;

  if (!mexeuNoCodigo) {
    liberar();
  }

  if (tocouRecentemente(BRAIN_DIR, inicioMs, 0)) {
    liberar();
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(markerBloqueado, String(Date.now()));

  const reason = [
    'TRAVA DE MEMÓRIA: esta sessão mexeu em código e nada foi registrado no distok-brain.',
    'Delegue ao agente escriba antes de encerrar. Onde gravar, conforme o que aconteceu:',
    '- Feature entregue -> 01 - Projeto/Estado Atual.md',
    '- Pendência/dívida/TODO -> 01 - Projeto/Roadmap e Backlog.md',
    '- Decisão arquitetural -> 02 - Arquitetura/ADRs.md',
    '- Tabela/coluna/migration -> 03 - Schema do Banco/',
    '- Endpoint novo -> 04 - Módulos/API - Visão Geral.md',
    '- Tela nova -> 04 - Módulos/Web - Telas.md',
    '- Achado de segurança -> 05 - Segurança/Postura de Segurança.md',
    '- Incidente -> 08 - Operação/',
    '- Conclusão solta de conversa -> 99 - Meta/Log de Aprendizados.md',
    'Data absoluta, wikilinks, sem duplicar nota existente.',
  ].join('\n');

  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
} catch {
  liberar();
}
