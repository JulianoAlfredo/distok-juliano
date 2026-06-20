'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const contrast = require('../../src/utils/contrast');

test('isHex valida #RRGGBB', () => {
  assert.ok(contrast.isHex('#1B7F3B'));
  assert.ok(!contrast.isHex('1B7F3B'));
  assert.ok(!contrast.isHex('#FFF'));
  assert.ok(!contrast.isHex('vermelho'));
});

test('contrastRatio: preto vs branco ~21', () => {
  const r = contrast.contrastRatio('#000000', '#FFFFFF');
  assert.ok(r > 20.9 && r <= 21, `esperado ~21, obtido ${r}`);
});

test('isPrimaryLegible: cores fortes passam (texto legível existe)', () => {
  assert.ok(contrast.isPrimaryLegible('#1B7F3B')); // verde escuro
  assert.ok(contrast.isPrimaryLegible('#2563EB')); // azul
  assert.ok(contrast.isPrimaryLegible('#FFFFFF')); // branco (texto preto legível)
  assert.ok(contrast.isPrimaryLegible('#000000')); // preto (texto branco legível)
});

test('isPrimaryLegible: cinza médio (~#777) reprova', () => {
  // tom em que nem branco nem preto atingem 4.5:1
  assert.ok(!contrast.isPrimaryLegible('#777777'));
});

test('bestTextOn escolhe a melhor cor de texto', () => {
  assert.strictEqual(contrast.bestTextOn('#1B7F3B').text, '#FFFFFF');
  assert.strictEqual(contrast.bestTextOn('#F5F5F5').text, '#0F172A');
});
