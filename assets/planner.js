const GAIN_SCALE = 10000;

function numeric(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rounded(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeAttribute(value) {
  return String(value || "").trim().toUpperCase();
}

function levelValue(info, baseValue) {
  const explicit = numeric(info?.value);
  if (explicit !== null) return explicit;
  const percentage = numeric(info?.percentage);
  return percentage === null ? null : (numeric(baseValue, 0) * percentage) / 100;
}

function templateValueAt(template, quantity, levels) {
  const baseValue = numeric(template?.baseValue, 0);
  let best = { threshold: 0, value: 0 };
  for (const levelName of levels) {
    const info = template?.levels?.[levelName] || {};
    const threshold = numeric(info.threshold, 0);
    const value = levelValue(info, baseValue);
    if (value !== null && quantity >= threshold && threshold >= best.threshold) best = { threshold, value };
  }
  return best.value;
}

function upgradePath(template, currentQuantity, levels) {
  const baseValue = numeric(template?.baseValue, 0);
  const thresholdValues = new Map();
  for (const levelName of levels) {
    const info = template?.levels?.[levelName] || {};
    const threshold = numeric(info.threshold);
    const value = levelValue(info, baseValue);
    if (threshold === null || threshold <= currentQuantity || value === null) continue;
    if (!thresholdValues.has(threshold) || value > thresholdValues.get(threshold)) thresholdValues.set(threshold, value);
  }
  const path = [];
  let fromQuantity = currentQuantity;
  let fromValue = templateValueAt(template, currentQuantity, levels);
  for (const [targetQuantity, nextValue] of [...thresholdValues.entries()].sort((a, b) => a[0] - b[0])) {
    const gain = rounded(nextValue - fromValue, 4);
    if (targetQuantity <= fromQuantity || gain <= 0) continue;
    path.push({
      fromQuantity,
      targetQuantity,
      currentValue: fromValue,
      nextValue,
      gain,
      sealsNeeded: targetQuantity - fromQuantity,
    });
    fromQuantity = targetQuantity;
    fromValue = nextValue;
  }
  return path;
}

function openers(currentQuantity, targetQuantity) {
  return Math.ceil(Math.max(numeric(targetQuantity, 0) - numeric(currentQuantity, 0), 0) / 50);
}

function templateCost(template, entry, prices, serverKey) {
  if (Object.prototype.hasOwnProperty.call(prices || {}, template.id)) return numeric(prices[template.id], 0);
  if (entry?.unitCost !== null && entry?.unitCost !== undefined) return numeric(entry.unitCost, 0);
  const costs = template.unitCosts || {};
  if (Object.prototype.hasOwnProperty.call(costs, serverKey)) return numeric(costs[serverKey], 0);
  return Object.keys(costs).length ? 0 : numeric(template.unitCost, 0);
}

function totalCost(state, openersOwned, openerUnitCost) {
  return state.sealGold + Math.max(state.openers - openersOwned, 0) * openerUnitCost;
}

function compareNumber(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareStates(left, right, strategy, openersOwned, openerUnitCost) {
  const leftCost = totalCost(left, openersOwned, openerUnitCost);
  const rightCost = totalCost(right, openersOwned, openerUnitCost);
  if (strategy === "seals") {
    return compareNumber(left.seals, right.seals)
      || compareNumber(leftCost, rightCost)
      || compareNumber(left.actualGain, right.actualGain)
      || compareNumber(left.openers, right.openers);
  }
  if (strategy === "openers") {
    return compareNumber(left.openers, right.openers)
      || compareNumber(leftCost, rightCost)
      || compareNumber(left.actualGain, right.actualGain)
      || compareNumber(left.seals, right.seals);
  }
  return compareNumber(leftCost, rightCost)
    || compareNumber(left.actualGain, right.actualGain)
    || compareNumber(left.seals, right.seals)
    || compareNumber(left.openers, right.openers);
}

function stateKey(state, strategy, requiredGainUnits, openersOwned) {
  const gain = Math.min(state.gainUnits, requiredGainUnits);
  if (strategy === "openers") return String(gain);
  return `${gain}:${Math.min(state.openers, openersOwned)}`;
}

function addBestState(states, candidate, strategy, requiredGainUnits, openersOwned, openerUnitCost) {
  const key = stateKey(candidate, strategy, requiredGainUnits, openersOwned);
  const current = states.get(key);
  if (!current || compareStates(candidate, current, strategy, openersOwned, openerUnitCost) < 0) {
    states.set(key, candidate);
  }
}

function buildUpgradeOptions(info) {
  return info.path.map((step) => {
    const sealsNeeded = step.targetQuantity - info.currentQuantity;
    const gain = rounded(step.nextValue - info.currentValue, 4);
    return {
      template: info.template,
      currentQuantity: info.currentQuantity,
      targetQuantity: step.targetQuantity,
      currentValue: info.currentValue,
      projectedValue: step.nextValue,
      gain,
      gainUnits: Math.max(Math.round(gain * GAIN_SCALE), 0),
      sealsNeeded,
      openersNeeded: openers(info.currentQuantity, step.targetQuantity),
      unitCost: info.unitCost,
      goldNeeded: rounded(info.unitCost * sealsNeeded, 2),
    };
  }).filter((option) => option.gainUnits > 0);
}

function optimizeOptions(optionGroups, requiredGain, strategy, openersOwned, openerUnitCost, budget) {
  const requiredGainUnits = Math.max(Math.ceil(requiredGain * GAIN_SCALE - 0.000001), 0);
  const availableGain = optionGroups.reduce(
    (sum, options) => sum + Math.max(...options.map((option) => option.gain), 0),
    0,
  );
  if (budget === null && requiredGain >= availableGain - 0.0001) {
    let complete = {
      gainUnits: 0,
      actualGain: 0,
      seals: 0,
      openers: 0,
      sealGold: 0,
      parent: null,
      choice: null,
    };
    for (const options of optionGroups) {
      const option = options[options.length - 1];
      complete = {
        gainUnits: complete.gainUnits + option.gainUnits,
        actualGain: rounded(complete.actualGain + option.gain, 4),
        seals: complete.seals + option.sealsNeeded,
        openers: complete.openers + option.openersNeeded,
        sealGold: rounded(complete.sealGold + option.goldNeeded, 2),
        parent: complete,
        choice: option,
      };
    }
    return { state: complete, reached: complete.gainUnits >= requiredGainUnits };
  }
  let states = new Map();
  const initial = {
    gainUnits: 0,
    actualGain: 0,
    seals: 0,
    openers: 0,
    sealGold: 0,
    parent: null,
    choice: null,
  };
  states.set(stateKey(initial, strategy, requiredGainUnits, openersOwned), initial);

  for (const options of optionGroups) {
    const nextStates = new Map();
    for (const state of states.values()) {
      addBestState(nextStates, state, strategy, requiredGainUnits, openersOwned, openerUnitCost);
      if (state.gainUnits >= requiredGainUnits) continue;
      for (const option of options) {
        const candidate = {
          gainUnits: Math.min(state.gainUnits + option.gainUnits, requiredGainUnits),
          actualGain: rounded(state.actualGain + option.gain, 4),
          seals: state.seals + option.sealsNeeded,
          openers: state.openers + option.openersNeeded,
          sealGold: rounded(state.sealGold + option.goldNeeded, 2),
          parent: state,
          choice: option,
        };
        if (budget !== null && totalCost(candidate, openersOwned, openerUnitCost) > budget + 0.0001) continue;
        addBestState(nextStates, candidate, strategy, requiredGainUnits, openersOwned, openerUnitCost);
      }
    }
    states = nextStates;
  }

  const allStates = [...states.values()];
  const reached = allStates.filter((state) => state.gainUnits >= requiredGainUnits);
  if (reached.length) {
    reached.sort((left, right) => compareStates(left, right, strategy, openersOwned, openerUnitCost));
    return { state: reached[0], reached: true };
  }
  allStates.sort((left, right) => compareNumber(right.actualGain, left.actualGain)
    || compareStates(left, right, strategy, openersOwned, openerUnitCost));
  return { state: allStates[0], reached: requiredGainUnits === 0 };
}

function selectedOptions(state) {
  const selected = [];
  let cursor = state;
  while (cursor) {
    if (cursor.choice) selected.push(cursor.choice);
    cursor = cursor.parent;
  }
  return selected.reverse();
}

function serializeEntry(option) {
  return {
    id: option.template.id,
    name: option.template.name,
    attribute: option.template.attribute,
    orderIndex: option.template.orderIndex,
    currentValue: option.currentValue,
    projectedValue: option.projectedValue,
    gain: rounded(option.gain, 2),
    sealsNeeded: option.sealsNeeded,
    openersNeeded: option.openersNeeded,
    openersEquivalent: option.openersNeeded,
    currentQuantity: option.currentQuantity,
    targetQuantity: option.targetQuantity,
    unitCost: option.unitCost,
    goldNeeded: option.goldNeeded,
    sealsPerPoint: option.gain > 0 ? rounded(option.sealsNeeded / option.gain, 2) : 0,
    goldPerPoint: option.gain > 0 ? rounded(option.goldNeeded / option.gain, 2) : 0,
  };
}

function strategyMetadata(strategy) {
  if (strategy === "seals") {
    return { label: "Menos selos", notice: "Plano global que usa a menor quantidade de selos para atingir a meta." };
  }
  if (strategy === "openers") {
    return { label: "Menos openers", notice: "Plano global que consome a menor quantidade de openers para atingir a meta." };
  }
  return {
    label: "Menor custo exato",
    notice: "Otimizacao global: compara todas as combinacoes uteis e minimiza selos + openers, nao apenas o proximo passo.",
  };
}

function buildSealPlan(options = {}) {
  const templates = Array.isArray(options.templates) ? options.templates : [];
  const seals = Array.isArray(options.seals) ? options.seals : [];
  const prices = options.prices || {};
  const levels = Array.isArray(options.levels) ? options.levels : [];
  const attribute = normalizeAttribute(options.attribute);
  const target = Math.max(numeric(options.target, 0), 0);
  const strategy = ["auto", "ultra", "seals", "openers"].includes(options.strategy) ? options.strategy : "auto";
  const openersOwned = Math.max(Math.trunc(numeric(options.openersOwned, 0)), 0);
  const openerUnitCost = Math.max(numeric(options.openerUnitCost, 0), 0);
  const budget = options.budget === null || options.budget === undefined ? null : Math.max(numeric(options.budget, 0), 0);
  const blockedTemplateIds = new Set((Array.isArray(options.blockedTemplateIds) ? options.blockedTemplateIds : [])
    .map((id) => Number(id)).filter(Number.isFinite));
  const entriesById = new Map(seals.map((entry) => [Number(entry.sealId), entry]));
  const matching = templates.filter((template) => normalizeAttribute(template.attribute) === attribute);
  let currentTotal = 0;
  let excludedUnpricedCount = 0;
  let availableGain = 0;
  const optionGroups = [];

  for (const template of matching) {
    const accountEntry = entriesById.get(Number(template.id)) || null;
    const currentQuantity = Math.max(numeric(accountEntry?.quantity, 0), 0);
    const currentValue = templateValueAt(template, currentQuantity, levels);
    currentTotal += currentValue;
    const path = upgradePath(template, currentQuantity, levels);
    if (!path.length || blockedTemplateIds.has(Number(template.id))) continue;
    const unitCost = templateCost(template, accountEntry, prices, options.serverKey);
    if (!(unitCost > 0)) {
      excludedUnpricedCount += 1;
      continue;
    }
    const upgradeOptions = buildUpgradeOptions({ template, currentQuantity, currentValue, unitCost, path });
    if (!upgradeOptions.length) continue;
    availableGain += Math.max(...upgradeOptions.map((option) => option.gain));
    optionGroups.push(upgradeOptions);
  }

  const remainingTarget = Math.max(target - currentTotal, 0);
  const optimization = optimizeOptions(
    optionGroups,
    remainingTarget,
    strategy,
    openersOwned,
    openerUnitCost,
    budget,
  );
  const chosenState = optimization.state;
  const entries = selectedOptions(chosenState)
    .map(serializeEntry)
    .sort((left, right) => (numeric(left.orderIndex, 0) - numeric(right.orderIndex, 0)) || (left.id - right.id));
  const totalOpeners = chosenState.openers;
  const openersOwnedUsed = Math.min(openersOwned, totalOpeners);
  const openersToBuy = Math.max(totalOpeners - openersOwned, 0);
  const openerGoldNeeded = rounded(openersToBuy * openerUnitCost, 2);
  const totalGold = rounded(chosenState.sealGold, 2);
  const totalGoldWithOpeners = rounded(totalGold + openerGoldNeeded, 2);
  const projectedTotal = rounded(currentTotal + chosenState.actualGain, 4);
  const missingAfterPlan = Math.max(rounded(target - projectedTotal, 4), 0);
  const metadata = strategyMetadata(strategy);
  const budgetBlocked = budget !== null && missingAfterPlan > 0 && availableGain + 0.0001 >= remainingTarget;

  return {
    attribute,
    target,
    currentTotal,
    remainingTarget,
    projectedTotal,
    totalSeals: chosenState.seals,
    totalOpeners,
    totalGold,
    totalGoldWithOpeners,
    openerGoldNeeded,
    openersToBuy,
    openersOwnedUsed,
    openersOwned,
    openerUnitCost,
    entries,
    missingAfterPlan,
    strategyRequested: strategy,
    strategyUsed: strategy,
    strategyLabel: metadata.label,
    strategyNotice: metadata.notice,
    optimizationMethod: "exact-multiple-choice",
    budgetMode: budget !== null,
    budget,
    budgetUsed: budget !== null ? totalGoldWithOpeners : null,
    budgetRemaining: budget !== null ? Math.max(rounded(budget - totalGoldWithOpeners, 2), 0) : null,
    budgetBlocked,
    excludedUnpricedCount,
    unknownCostEntries: 0,
    unknownCostSeals: 0,
    singleSealSuggestion: null,
  };
}

if (typeof window !== "undefined") window.StaticSealPlanner = { buildSealPlan };
if (typeof module !== "undefined") module.exports = { buildSealPlan };
