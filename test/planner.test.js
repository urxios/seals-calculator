const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSealPlan } = require('../assets/planner');

const levels = ['Normal', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Master'];

function template(id, name, price, ranks, attribute = 'AT') {
  return {
    id, name, attribute, baseValue: 0, unitCost: price, unitCosts: {}, orderIndex: id,
    levels: Object.fromEntries(levels.map((level, index) => [level, ranks[index]
      ? { threshold: ranks[index][0], value: ranks[index][1], percentage: null }
      : {}])),
  };
}

function plan(templates, target, extra = {}) {
  return buildSealPlan({ templates, seals: extra.seals || [], prices: extra.prices || {}, levels, serverKey: 'la', attribute: extra.attribute || 'AT', target, strategy: extra.strategy || 'auto', openersOwned: extra.openersOwned || 0, openerUnitCost: extra.openerUnitCost || 0, budget: extra.budget ?? null });
}

test('encontra o menor custo global, não apenas o próximo passo', () => {
  const result = plan([template(1, 'A', 1, [[6, 6]]), template(2, 'B', 11, [[1, 10]])], 10);
  assert.equal(result.totalGoldWithOpeners, 11);
  assert.deepEqual(result.entries.map((entry) => entry.name), ['B']);
});

test('considera a quantidade que o usuário já possui', () => {
  const result = plan([template(1, 'Atual', 1, [[50, 10], [200, 20]])], 20, { seals: [{ sealId: 1, quantity: 50 }] });
  assert.equal(result.totalSeals, 150);
  assert.equal(result.totalOpeners, 3);
});

test('mantém precisão em atributos percentuais', () => {
  const result = plan([template(1, 'CT A', 1, [[1, .1]], 'CT'), template(2, 'CT B', 1, [[1, .2]], 'CT')], .3, { attribute: 'CT' });
  assert.equal(result.missingAfterPlan, 0);
  assert.equal(result.projectedTotal, .3);
});

test('respeita orçamento e openers existentes', () => {
  const result = plan([template(1, 'A', 1, [[100, 100]]), template(2, 'B', 500, [[1, 100]])], 100, { openersOwned: 2, openerUnitCost: 1000, budget: 100 });
  assert.equal(result.totalGoldWithOpeners, 100);
  assert.equal(result.entries[0].name, 'A');
});
