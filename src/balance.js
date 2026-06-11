export const BALANCE_FILES = {
  units: "../balance/units.csv",
  traits: "../balance/traits.csv",
  items: "../balance/items.csv",
  levels: "../balance/levels.csv",
  economy: "../balance/economy.csv",
  stages: "../balance/stages.csv",
  prestige: "../balance/prestige.csv",
  offline: "../balance/offline.csv",
};

export async function loadBalance() {
  const textMap = {};
  for (const [sheet, path] of Object.entries(BALANCE_FILES)) {
    const url = new URL(path, import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load ${sheet} balance sheet: ${response.status}`);
    }
    textMap[sheet] = await response.text();
  }
  return normalizeBalance(textMap);
}

export function normalizeBalance(textMap) {
  const raw = {};
  for (const [sheet, text] of Object.entries(textMap)) {
    raw[sheet] = parseCsv(text);
  }

  const units = raw.units.map((row) => ({
    id: required(row, "id", "units"),
    name: required(row, "name", "units"),
    cost: number(row.cost, "unit cost"),
    tier: number(row.tier, "unit tier"),
    traits: splitList(row.traits),
    role: row.role,
    health: number(row.health, "unit health"),
    attack: number(row.attack, "unit attack"),
    defense: number(row.defense, "unit defense"),
    speed: number(row.speed, "unit speed"),
    ability: row.ability,
    abilityPower: number(row.abilityPower, "unit abilityPower"),
  }));

  const traits = raw.traits.map((row) => ({
    id: required(row, "id", "traits"),
    name: required(row, "name", "traits"),
    breakpoints: parseBreakpoints(row.breakpoints),
    stat: row.stat,
    mode: row.mode,
    target: row.target,
    description: row.description,
  }));

  const items = raw.items.map((row) => ({
    id: required(row, "id", "items"),
    name: required(row, "name", "items"),
    cost: number(row.cost, "item cost"),
    rarity: row.rarity,
    stat: row.stat,
    value: number(row.value, "item value"),
    mode: row.mode || (row.stat === "speed" ? "percent" : "add"),
    effect: row.effect,
  }));

  const levels = raw.levels.map((row) => {
    const odds = {};
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith("tier")) {
        odds[key.replace("tier", "")] = number(value || 0, `${key} odds`);
      }
    }
    return {
      level: number(row.level, "level"),
      xpRequired: number(row.xpRequired, "xpRequired"),
      boardCap: number(row.boardCap, "boardCap"),
      odds,
    };
  });

  const economy = keyValueSheet(raw.economy);
  const prestige = keyValueSheet(raw.prestige);
  const offline = keyValueSheet(raw.offline);

  const stages = raw.stages.map((row) => ({
    stage: number(row.stage, "stage"),
    enemyPower: number(row.enemyPower, "enemyPower"),
    goldReward: number(row.goldReward, "stage goldReward"),
    itemEvery: number(row.itemEvery, "itemEvery"),
    notes: row.notes,
  }));

  const balance = {
    units,
    traits,
    items,
    levels,
    economy,
    stages,
    prestige,
    offline,
    unitById: Object.fromEntries(units.map((unit) => [unit.id, unit])),
    traitById: Object.fromEntries(traits.map((trait) => [trait.id, trait])),
    itemById: Object.fromEntries(items.map((item) => [item.id, item])),
    levelByNumber: Object.fromEntries(levels.map((level) => [level.level, level])),
    stageByNumber: Object.fromEntries(stages.map((stage) => [stage.stage, stage])),
  };

  validateBalance(balance);
  return balance;
}

export function validateBalance(balance) {
  const errors = [];
  const unitIds = new Set();
  for (const unit of balance.units) {
    if (unitIds.has(unit.id)) errors.push(`Duplicate unit id: ${unit.id}`);
    unitIds.add(unit.id);
    if (unit.traits.length === 0) errors.push(`${unit.id} has no traits`);
    for (const traitId of unit.traits) {
      if (!balance.traitById[traitId]) errors.push(`${unit.id} references missing trait ${traitId}`);
    }
  }

  for (const level of balance.levels) {
    const sum = Object.values(level.odds).reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 100) > 0.001) {
      errors.push(`Level ${level.level} shop odds sum to ${sum}, expected 100`);
    }
  }

  for (const trait of balance.traits) {
    if (trait.breakpoints.length === 0) errors.push(`${trait.id} has no breakpoints`);
    if (!["add", "percent"].includes(trait.mode)) errors.push(`${trait.id} has invalid mode ${trait.mode}`);
    if (!["all", "trait"].includes(trait.target)) errors.push(`${trait.id} has invalid target ${trait.target}`);
  }

  for (const key of ["startingGold", "roundSeconds", "rerollCost", "shopSize"]) {
    if (typeof balance.economy[key] !== "number") errors.push(`Missing economy key ${key}`);
  }

  if (errors.length > 0) {
    throw new Error(`Balance validation failed:\n${errors.join("\n")}`);
  }
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    return record;
  });
}

function parseBreakpoints(value) {
  return splitList(value, ";").map((entry) => {
    const [count, bonus] = entry.split(":");
    return { count: number(count, "breakpoint count"), value: number(bonus, "breakpoint value") };
  }).sort((a, b) => a.count - b.count);
}

function keyValueSheet(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, number(row.value, row.key)]));
}

function splitList(value, separator = "|") {
  if (!value) return [];
  return value.split(separator).map((entry) => entry.trim()).filter(Boolean);
}

function required(row, key, sheet) {
  if (!row[key]) throw new Error(`Missing ${key} in ${sheet}`);
  return row[key];
}

function number(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number for ${label}: ${value}`);
  return parsed;
}
