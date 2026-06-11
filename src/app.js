import { loadBalance } from "./balance.js";
import {
  assignItemToSlot,
  benchUnit,
  buyItem,
  buyItemSlot,
  buyShopUnit,
  buyXp,
  computeTeamPower,
  computeTraitState,
  computeUnitStats,
  createInitialState,
  estimatePrestigeGain,
  fieldUnit,
  formatNumber,
  getCurrentLevel,
  getItemEffectText,
  getItemInSlot,
  getItemSlotCost,
  getNextLevel,
  getOfflineCapSeconds,
  getPreviewEnemyBoard,
  migrateState,
  moveBenchUnitToBoard,
  moveBoardUnit,
  moveBoardUnitToBench,
  prestigeReset,
  processElapsed,
  processOffline,
  reorderBenchUnit,
  refreshItemShop,
  rollShop,
  sellUnit,
  toggleShopLock,
} from "./game.js";
import { clearSave, loadSave, saveGame } from "./storage.js";

const BOARD_LABELS = ["Front L", "Front C", "Front R", "Back L", "Back C", "Back R"];

let balance;
let state;
let lastTickAt = Date.now();
let lastRenderAt = 0;
let lastAutosaveAt = 0;
let lastAnimatedRound = 0;
let combatAnimationToken = 0;
let combatAnimating = false;
let activeDragPayload = null;

const els = {
  saveStatus: document.querySelector("#save-status"),
  gold: document.querySelector("#gold"),
  level: document.querySelector("#level"),
  stage: document.querySelector("#stage"),
  prestigePoints: document.querySelector("#prestige-points"),
  offlineSummary: document.querySelector("#offline-summary"),
  board: document.querySelector("#board"),
  enemyBoard: document.querySelector("#enemy-board"),
  bench: document.querySelector("#bench"),
  benchCount: document.querySelector("#bench-count"),
  shop: document.querySelector("#shop"),
  itemShop: document.querySelector("#item-shop"),
  inventory: document.querySelector("#inventory"),
  itemSlots: document.querySelector("#item-slots"),
  itemSlotLabel: document.querySelector("#item-slot-label"),
  itemSlotButton: document.querySelector("#item-slot-button"),
  recap: document.querySelector("#recap"),
  teamPower: document.querySelector("#team-power"),
  prestigeSummary: document.querySelector("#prestige-summary"),
  prestigeButton: document.querySelector("#prestige-button"),
  roundProgress: document.querySelector("#round-progress"),
  roundLabel: document.querySelector("#round-label"),
  xpLabel: document.querySelector("#xp-label"),
  xpButton: document.querySelector("#xp-button"),
  rerollButton: document.querySelector("#reroll-button"),
  lockButton: document.querySelector("#lock-button"),
  itemRefreshButton: document.querySelector("#item-refresh-button"),
  saveButton: document.querySelector("#save-button"),
  exportButton: document.querySelector("#export-button"),
  importButton: document.querySelector("#import-button"),
  resetButton: document.querySelector("#reset-button"),
  saveDialog: document.querySelector("#save-dialog"),
  saveText: document.querySelector("#save-text"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogApply: document.querySelector("#dialog-apply"),
  windows: document.querySelectorAll("[data-window]"),
  windowToggles: document.querySelectorAll("[data-window-toggle]"),
};

init().catch((error) => {
  console.error(error);
  els.saveStatus.textContent = `Startup failed: ${error.message}`;
});

async function init() {
  balance = await loadBalance();
  const saved = await loadSave();
  state = saved ? migrateState(saved, balance) : createInitialState(balance);
  lastAnimatedRound = state.run.recap?.combatId ?? state.run.recap?.round ?? 0;
  const offline = saved ? processOffline(state, balance) : null;
  if (offline && offline.elapsedSeconds >= balance.offline.summaryThresholdSeconds) {
    showOfflineSummary(offline);
  }
  await saveGame(state);
  attachEvents();
  setStatus(saved ? "Loaded local save." : "Started new run.");
  render(true);
  lastTickAt = Date.now();
  window.setInterval(tick, 250);
}

function attachEvents() {
  document.body.addEventListener("click", handleClick);
  document.body.addEventListener("change", handleChange);
  document.body.addEventListener("dragstart", handleDragStart);
  document.body.addEventListener("dragover", handleDragOver);
  document.body.addEventListener("dragleave", handleDragLeave);
  document.body.addEventListener("drop", handleDrop);
  document.body.addEventListener("dragend", handleDragEnd);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveGame(state);
    } else {
      lastTickAt = Date.now();
      const offline = processOffline(state, balance);
      if (offline.elapsedSeconds >= balance.offline.summaryThresholdSeconds) showOfflineSummary(offline);
      render(true);
    }
  });
}

async function handleClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  let result = null;

  if (button.dataset.windowToggle) {
    toggleWindow(button.dataset.windowToggle);
    return;
  } else if (button.dataset.windowClose) {
    closeWindow(button.dataset.windowClose);
    return;
  } else if (button === els.rerollButton) result = rollShop(state, balance);
  else if (button === els.lockButton) {
    toggleShopLock(state);
    result = { ok: true, message: state.run.shopLocked ? "Shop locked." : "Shop unlocked." };
  } else if (button === els.xpButton) result = buyXp(state, balance);
  else if (button === els.itemRefreshButton) result = refreshItemShop(state, balance);
  else if (button === els.itemSlotButton) result = buyItemSlot(state, balance);
  else if (button === els.saveButton) {
    await saveGame(state);
    setStatus("Saved.");
    return;
  } else if (button === els.exportButton) {
    openSaveDialog("Export Save", JSON.stringify(state, null, 2), false);
    return;
  } else if (button === els.importButton) {
    openSaveDialog("Import Save", "", true);
    return;
  } else if (button === els.resetButton) {
    if (confirm("Clear the local save and restart?")) {
      await clearSave();
      state = createInitialState(balance);
      await saveGame(state);
      render(true);
      setStatus("Save reset.");
    }
    return;
  } else if (button === els.prestigeButton) result = prestigeReset(state, balance);
  else if (action === "buy-unit") result = buyShopUnit(state, balance, Number(button.dataset.index));
  else if (action === "field-unit") result = fieldUnit(state, balance, Number(button.dataset.index));
  else if (action === "field-slot") result = fieldUnit(state, balance, 0, Number(button.dataset.slot));
  else if (action === "bench-unit") result = benchUnit(state, balance, Number(button.dataset.slot));
  else if (action === "sell-unit") result = sellUnit(state, balance, button.dataset.location, Number(button.dataset.index));
  else if (action === "buy-item") result = buyItem(state, balance, Number(button.dataset.index));
  else if (button === els.dialogApply) {
    applyImport();
    return;
  }

  if (result) {
    setStatus(result.message);
    if (result.ok) await saveGame(state);
    render(true);
  }
}

async function handleChange(event) {
  const select = event.target.closest("select[data-action='assign-item-slot']");
  if (!select) return;
  const result = assignItemToSlot(state, select.dataset.itemId, select.value || null);
  setStatus(result.message);
  await saveGame(state);
  render(true);
}

function handleDragStart(event) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest("button, select, textarea")) {
    event.preventDefault();
    return;
  }

  const tile = event.target.closest("[data-drag-source]");
  if (!tile || !event.dataTransfer) return;

  activeDragPayload = {
    source: tile.dataset.dragSource,
    boardSlot: tile.dataset.boardSlot === undefined ? null : Number(tile.dataset.boardSlot),
    benchIndex: tile.dataset.benchIndex === undefined ? null : Number(tile.dataset.benchIndex),
  };

  tile.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/json", JSON.stringify(activeDragPayload));
  event.dataTransfer.setData("text/plain", JSON.stringify(activeDragPayload));
}

function handleDragOver(event) {
  const dropZone = getDropZone(event.target);
  if (!dropZone || !canDropOnZone(activeDragPayload, dropZone)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  setActiveDropZone(dropZone);
}

function handleDragLeave(event) {
  const dropZone = getDropZone(event.target);
  if (!dropZone || dropZone.contains(event.relatedTarget)) return;
  dropZone.classList.remove("drag-over");
}

async function handleDrop(event) {
  const dropZone = getDropZone(event.target);
  const payload = getDragPayload(event);
  if (!dropZone || !canDropOnZone(payload, dropZone)) return;

  event.preventDefault();
  clearDragState();
  const result = applyDraggedUnitDrop(payload, dropZone);
  if (!result) return;

  setStatus(result.message);
  if (result.ok) await saveGame(state);
  render(true);
}

function handleDragEnd() {
  clearDragState();
}

function getDropZone(target) {
  return target instanceof Element ? target.closest("[data-drop-zone]") : null;
}

function getDragPayload(event) {
  if (activeDragPayload) return activeDragPayload;
  const raw = event.dataTransfer?.getData("application/json") || event.dataTransfer?.getData("text/plain");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function canDropOnZone(payload, dropZone) {
  if (!payload || !dropZone) return false;
  if (dropZone.dataset.dropZone === "board") {
    const targetSlot = Number(dropZone.dataset.slot);
    if (!Number.isInteger(targetSlot)) return false;
    if (payload.source === "board") return payload.boardSlot !== targetSlot;
    if (payload.source === "bench") {
      const targetOccupied = Boolean(state.run.board[targetSlot]);
      const canField = boardUnitCount() < getCurrentLevel(balance, state).boardCap;
      return targetOccupied || canField;
    }
  }
  if (dropZone.dataset.dropZone === "bench") {
    if (payload.source === "board") return state.run.bench.length < balance.economy.benchCap;
    if (payload.source === "bench") return state.run.bench.length > 1;
  }
  return false;
}

function setActiveDropZone(dropZone) {
  for (const element of document.querySelectorAll(".drag-over")) {
    if (element !== dropZone) element.classList.remove("drag-over");
  }
  dropZone.classList.add("drag-over");
}

function clearDragState() {
  activeDragPayload = null;
  for (const element of document.querySelectorAll(".dragging, .drag-over")) {
    element.classList.remove("dragging", "drag-over");
  }
}

function applyDraggedUnitDrop(payload, dropZone) {
  if (dropZone.dataset.dropZone === "board") {
    const targetSlot = Number(dropZone.dataset.slot);
    if (payload.source === "board") return moveBoardUnit(state, payload.boardSlot, targetSlot);
    if (payload.source === "bench") return moveBenchUnitToBoard(state, balance, payload.benchIndex, targetSlot);
  }

  if (dropZone.dataset.dropZone === "bench") {
    const targetIndex = dropZone.dataset.benchIndex === undefined ? state.run.bench.length : Number(dropZone.dataset.benchIndex);
    if (payload.source === "board") return moveBoardUnitToBench(state, balance, payload.boardSlot, targetIndex);
    if (payload.source === "bench") return reorderBenchUnit(state, payload.benchIndex, targetIndex);
  }

  return null;
}

function tick() {
  if (!state || !balance) return;
  const now = Date.now();
  const elapsed = now - lastTickAt;
  lastTickAt = now;
  const result = processElapsed(state, balance, elapsed);
  if (result.rounds > 0) {
    saveGame(state);
  }
  if (now - lastAutosaveAt > 10000) {
    lastAutosaveAt = now;
    saveGame(state);
  }
  if (result.rounds > 0 || (!combatAnimating && now - lastRenderAt > 350)) {
    render();
  }
  if (result.rounds > 0) {
    animateLatestCombat();
  }
}

function render(force = false) {
  if (!force && Date.now() - lastRenderAt < 100) return;
  lastRenderAt = Date.now();
  const level = getCurrentLevel(balance, state);
  const nextLevel = getNextLevel(balance, state);
  const roundMs = balance.economy.roundSeconds * 1000;

  els.gold.textContent = formatNumber(state.run.gold);
  els.level.textContent = state.run.level;
  els.stage.textContent = state.run.stage;
  els.prestigePoints.textContent = state.prestige.points;
  els.roundProgress.value = Math.min(1, state.run.roundProgressMs / roundMs);
  els.roundLabel.textContent = `Stage round ${state.run.round} resolves automatically`;
  els.xpLabel.textContent = nextLevel
    ? `XP ${formatNumber(state.run.xp)} / ${formatNumber(nextLevel.xpRequired)} | Board ${boardUnitCount()} / ${level.boardCap}`
    : `Max level | Board ${boardUnitCount()} / ${level.boardCap}`;
  els.xpButton.disabled = state.run.gold < balance.economy.xpBuyCost || !nextLevel;
  els.xpButton.textContent = `XP ${balance.economy.xpBuyCost}g`;
  els.rerollButton.disabled = state.run.gold < balance.economy.rerollCost;
  els.rerollButton.textContent = `Reroll ${balance.economy.rerollCost}g`;
  els.lockButton.textContent = state.run.shopLocked ? "Locked" : "Lock";
  els.itemRefreshButton.disabled = state.run.gold < balance.economy.itemRefreshCost;
  els.itemRefreshButton.textContent = `Refresh ${balance.economy.itemRefreshCost}g`;
  const itemSlotCost = getItemSlotCost(state, balance);
  const itemSlotsMaxed = state.run.itemSlots >= balance.economy.maxItemSlots;
  els.itemSlotLabel.textContent = `Item slots ${state.run.itemSlots}/${balance.economy.maxItemSlots}`;
  els.itemSlotButton.disabled = itemSlotsMaxed || state.run.gold < itemSlotCost;
  els.itemSlotButton.textContent = itemSlotsMaxed ? "Max Slots" : `Buy Slot ${itemSlotCost}g`;

  renderWindowButtons();
  renderBoard();
  renderEnemyBoard();
  renderBench();
  renderShop();
  renderItemShop();
  renderItemSlots();
  renderInventory();
  renderRecap();
  renderPrestige();
}

function renderBoard() {
  const traitState = computeTraitState(state, balance);
  els.board.innerHTML = state.run.board.map((instance, slot) => `
    <div class="slot" data-drop-zone="board" data-slot="${slot}">
      <div class="slot-label">${BOARD_LABELS[slot]}</div>
      ${instance ? renderUnitTile(instance, {
        location: "board",
        index: slot,
        traitState,
        boardSlot: slot,
      }) : renderEmptySlot(slot)}
    </div>
  `).join("");
}

function renderEnemyBoard() {
  const enemyBoard = getPreviewEnemyBoard(state, balance);
  els.enemyBoard.innerHTML = enemyBoard.map((enemy, slot) => `
    <div class="slot enemy-slot">
      <div class="slot-label">${BOARD_LABELS[slot]}</div>
      ${enemy ? renderEnemyTile(enemy) : `<div class="unit-tile board-unit enemy-unit empty-enemy"><div class="subtle">Empty</div></div>`}
    </div>
  `).join("");
}

function renderBench() {
  els.benchCount.textContent = `${state.run.bench.length}/${balance.economy.benchCap}`;
  els.bench.innerHTML = state.run.bench.length
    ? state.run.bench.map((instance, index) => renderUnitTile(instance, { location: "bench", index })).join("")
    : `<p class="subtle">No bench units.</p>`;
}

function renderWindowButtons() {
  for (const button of els.windowToggles) {
    const windowElement = document.getElementById(button.dataset.windowToggle);
    button.classList.toggle("active", Boolean(windowElement && !windowElement.hidden));
    button.setAttribute("aria-expanded", String(Boolean(windowElement && !windowElement.hidden)));
  }
}

function renderShop() {
  const currentTraits = new Set(computeTraitState(state, balance).filter((entry) => entry.active || entry.count > 0).map((entry) => entry.trait.id));
  els.shop.innerHTML = state.run.shop.map((unitId, index) => {
    if (!unitId) return `<article class="unit-tile"><div class="subtle">Purchased</div></article>`;
    const unit = balance.unitById[unitId];
    const completes = unit.traits.some((traitId) => currentTraits.has(traitId));
    return `
      <article class="unit-tile ${completes ? "shop-completes" : ""}">
        <div class="unit-top">
          <span class="unit-name">${escapeHtml(unit.name)}</span>
          <span class="unit-meta">${unit.cost}g | T${unit.tier}</span>
        </div>
        <div class="unit-meta">${escapeHtml(unit.role)} | ${escapeHtml(unit.ability)}</div>
        <div class="chips">${unit.traits.map((traitId) => traitChip(traitId)).join("")}</div>
        <div class="unit-actions">
          <button type="button" data-action="buy-unit" data-index="${index}" ${state.run.gold < unit.cost ? "disabled" : ""}>Buy</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderItemShop() {
  els.itemShop.innerHTML = state.run.itemShop.map((itemId, index) => {
    if (!itemId) return `<article class="item-row"><div class="subtle">Purchased</div></article>`;
    const item = balance.itemById[itemId];
    return `
      <article class="item-row">
        <div class="item-top">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-meta">${item.cost}g</span>
        </div>
        <div class="item-meta">${escapeHtml(item.effect)} ${formatItemStat(item)}</div>
        <div class="item-actions">
          <button type="button" data-action="buy-item" data-index="${index}" ${state.run.gold < item.cost ? "disabled" : ""}>Buy</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderItemSlots() {
  els.itemSlots.innerHTML = state.run.itemSlots > 0
    ? Array.from({ length: state.run.itemSlots }, (_, slotIndex) => {
      const itemInstance = getItemInSlot(state, slotIndex);
      const item = itemInstance ? balance.itemById[itemInstance.itemId] : null;
      return `
        <article class="item-slot">
          <div class="item-top">
            <span class="item-name">Slot ${slotIndex + 1}</span>
            <span class="item-meta">${item ? escapeHtml(item.name) : "Empty"}</span>
          </div>
          <div class="item-meta">${item ? escapeHtml(getItemEffectText(item)) : "Assign an owned item to activate it."}</div>
        </article>
      `;
    }).join("")
    : `<p class="subtle">No active item slots. Buy a slot to activate owned items.</p>`;
}

function renderInventory() {
  els.inventory.innerHTML = state.run.items.length
    ? state.run.items.map((itemInstance) => {
      const item = balance.itemById[itemInstance.itemId];
      return `
        <article class="item-row">
          <div class="item-top">
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-meta">${escapeHtml(getItemEffectText(item))}</span>
          </div>
          <div class="item-meta">${escapeHtml(item.effect)}</div>
          <select data-action="assign-item-slot" data-item-id="${itemInstance.instanceId}" aria-label="Assign ${escapeHtml(item.name)} to item slot" ${state.run.itemSlots === 0 ? "disabled" : ""}>
            <option value="">Inactive</option>
            ${Array.from({ length: state.run.itemSlots }, (_, slotIndex) => {
              const occupyingItem = getItemInSlot(state, slotIndex);
              const label = occupyingItem && occupyingItem.instanceId !== itemInstance.instanceId
                ? `Slot ${slotIndex + 1} (${balance.itemById[occupyingItem.itemId].name})`
                : `Slot ${slotIndex + 1}`;
              return `<option value="${slotIndex}" ${itemInstance.slotIndex === slotIndex ? "selected" : ""}>${escapeHtml(label)}</option>`;
            }).join("")}
          </select>
        </article>
      `;
    }).join("")
    : `<p class="subtle">No items yet. Buy or win items.</p>`;
}

function renderRecap() {
  const power = computeTeamPower(state, balance);
  els.teamPower.textContent = `Team power ${formatNumber(power)}`;
  els.teamPower.className = "pill good";
  const recap = state.run.recap;
  const recapTable = recap ? `
    <table class="recap-table">
      <tbody>
        <tr><th>Result</th><td>${recap.won ? "Win" : "Loss"}</td></tr>
        <tr><th>Stage</th><td>${recap.previousStage} -> ${recap.nextStage}</td></tr>
        <tr><th>Team</th><td>${formatNumber(recap.teamPower)}</td></tr>
        <tr><th>Enemy</th><td>${formatNumber(recap.enemyPower)}</td></tr>
        <tr><th>Attacks</th><td>${recap.attackEvents?.length ?? 0}</td></tr>
      </tbody>
    </table>
  ` : `<p class="subtle">First combat is resolving automatically.</p>`;
  const log = state.run.combatLog.length
    ? `<ul class="log-list">${state.run.combatLog.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
    : "";
  els.recap.innerHTML = recapTable + log;
}

function renderPrestige() {
  const gain = estimatePrestigeGain(state, balance);
  const cap = getOfflineCapSeconds(state, balance);
  els.prestigeSummary.innerHTML = `
    <div>Prestige gain now: <strong>${gain}</strong></div>
    <div>Minimum stage: ${balance.prestige.minStage}</div>
    <div>Power bonus: +${state.prestige.points * balance.prestige.powerPercentPerPoint}%</div>
    <div>Offline cap: ${formatDuration(cap)}</div>
  `;
  els.prestigeButton.disabled = gain <= 0;
  els.prestigeButton.textContent = gain > 0 ? `Prestige for ${gain}` : `Reach stage ${balance.prestige.minStage}`;
}

function renderEmptySlot(slot) {
  const canField = state.run.bench.length > 0 && boardUnitCount() < getCurrentLevel(balance, state).boardCap;
  return `
    <div class="unit-tile board-unit">
      <div class="subtle">Empty</div>
      <div class="unit-actions">
        <button type="button" data-action="field-slot" data-slot="${slot}" ${canField ? "" : "disabled"}>Field Bench</button>
      </div>
    </div>
  `;
}

function renderUnitTile(instance, options) {
  const unit = balance.unitById[instance.unitId];
  const stats = computeUnitStats(instance, state, balance, options.traitState);
  const hp = getHpSnapshot(instance.instanceId, stats.health);
  const isBoard = options.location === "board";
  const dragAttributes = isBoard
    ? `draggable="true" data-drag-source="board" data-board-slot="${options.boardSlot}" title="Drag to rearrange board position"`
    : `draggable="true" data-drag-source="bench" data-bench-index="${options.index}" data-drop-zone="bench" title="Drag to field or reorder bench unit"`;
  return `
    <article class="unit-tile ${isBoard ? "board-unit combatant" : ""}" ${isBoard ? `data-combat-id="${escapeHtml(instance.instanceId)}"` : ""} ${dragAttributes}>
      <div class="unit-top">
        <span class="unit-name">${escapeHtml(unit.name)} ${"*".repeat(instance.starLevel)}</span>
        <span class="unit-meta">${unit.cost}g | ${escapeHtml(unit.role)}</span>
      </div>
      ${renderHpGauge(hp.current, hp.max)}
      <div class="unit-meta">ATK ${formatNumber(stats.attack)} | DEF ${formatNumber(stats.defense)}</div>
      <div class="chips">${unit.traits.map((traitId) => traitChip(traitId)).join("")}</div>
      <div class="unit-actions">
        ${isBoard ? `
          <button type="button" data-action="bench-unit" data-slot="${options.boardSlot}">Bench</button>
          <button type="button" data-action="sell-unit" data-location="board" data-index="${options.index}">Sell</button>
        ` : `
          <button type="button" data-action="field-unit" data-index="${options.index}" ${boardUnitCount() >= getCurrentLevel(balance, state).boardCap ? "disabled" : ""}>Field</button>
          <button type="button" data-action="sell-unit" data-location="bench" data-index="${options.index}">Sell</button>
        `}
      </div>
    </article>
  `;
}

function renderEnemyTile(enemy) {
  const hp = getHpSnapshot(enemy.instanceId, enemy.health);
  return `
    <article class="unit-tile board-unit enemy-unit combatant" data-combat-id="${escapeHtml(enemy.instanceId)}">
      <div class="unit-top">
        <span class="unit-name">${escapeHtml(enemy.name)}</span>
        <span class="unit-meta">${escapeHtml(enemy.role)}</span>
      </div>
      ${renderHpGauge(hp.current, hp.max)}
      <div class="unit-meta">ATK ${formatNumber(enemy.attack)} | DEF ${formatNumber(enemy.defense)}</div>
      <div class="chips">
        <span class="chip enemy-chip">Enemy</span>
      </div>
    </article>
  `;
}

function renderHpGauge(current, max) {
  const safeMax = Math.max(1, Math.round(max));
  const safeCurrent = clamp(Math.round(current), 0, safeMax);
  const percent = safeCurrent / safeMax;
  const status = percent > 0.75 ? "high" : percent > 0.35 ? "mid" : "low";
  const hue = Math.round(percent * 120);
  return `
    <div class="hp-gauge hp-${status}" title="HP ${safeCurrent}/${safeMax}" aria-label="HP ${safeCurrent} of ${safeMax}" style="--hp-color: hsl(${hue} 58% 40%)">
      <div class="hp-fill" style="width: ${Math.round(percent * 100)}%"></div>
      <span class="hp-label">${formatNumber(safeCurrent)} / ${formatNumber(safeMax)}</span>
    </div>
  `;
}

function getHpSnapshot(combatId, fallbackMax) {
  const snapshot = state.run.recap?.healthByCombatId?.[combatId];
  if (snapshot && Math.round(snapshot.max) === Math.round(fallbackMax)) return snapshot;
  return { current: fallbackMax, max: fallbackMax };
}

async function animateLatestCombat() {
  const recap = state.run.recap;
  if (!recap?.attackEvents?.length || recap.combatId === lastAnimatedRound) return;
  lastAnimatedRound = recap.combatId;
  const token = combatAnimationToken + 1;
  combatAnimationToken = token;
  combatAnimating = true;
  await delay(120);

  for (const event of recap.attackEvents) {
    if (token !== combatAnimationToken) {
      combatAnimating = false;
      return;
    }
    animateAttackEvent(event);
    await delay(230);
  }
  if (token === combatAnimationToken) combatAnimating = false;
}

function animateAttackEvent(event) {
  const attacker = document.querySelector(`[data-combat-id="${event.attackerId}"]`);
  const defender = document.querySelector(`[data-combat-id="${event.defenderId}"]`);
  if (!attacker || !defender) return;

  attacker.classList.remove("shake-attack");
  defender.classList.remove("shake-hit");
  void attacker.offsetWidth;
  attacker.classList.add("shake-attack");
  defender.classList.add("shake-hit");
  showDamage(defender, event.damage, event.source);

  window.setTimeout(() => {
    attacker.classList.remove("shake-attack");
    defender.classList.remove("shake-hit");
  }, 210);
}

function showDamage(target, damage, source) {
  const pop = document.createElement("span");
  pop.className = `damage-pop ${source === "enemy" ? "enemy-damage" : "player-damage"}`;
  pop.textContent = `-${formatNumber(damage)}`;
  target.append(pop);
  window.setTimeout(() => pop.remove(), 720);
}

function openSaveDialog(title, value, importing) {
  els.dialogTitle.textContent = title;
  els.saveText.value = value;
  els.dialogApply.hidden = !importing;
  els.saveDialog.showModal();
}

async function applyImport() {
  try {
    const imported = JSON.parse(els.saveText.value);
    state = migrateState(imported, balance);
    await saveGame(state);
    els.saveDialog.close();
    render(true);
    setStatus("Imported save.");
  } catch (error) {
    setStatus(`Import failed: ${error.message}`);
  }
}

function showOfflineSummary(result) {
  els.offlineSummary.hidden = false;
  els.offlineSummary.textContent = `Offline progress: ${result.rounds} rounds, ${formatNumber(result.goldDelta)} gold, ${result.stageDelta >= 0 ? "+" : ""}${result.stageDelta} stages${result.capped ? " (capped)" : ""}.`;
}

function setStatus(message) {
  els.saveStatus.textContent = message;
}

function toggleWindow(windowId) {
  const windowElement = document.getElementById(windowId);
  if (!windowElement) return;
  windowElement.hidden = !windowElement.hidden;
  if (!windowElement.hidden) bringWindowForward(windowElement);
  renderWindowButtons();
}

function closeWindow(windowId) {
  const windowElement = document.getElementById(windowId);
  if (!windowElement) return;
  windowElement.hidden = true;
  renderWindowButtons();
}

function bringWindowForward(windowElement) {
  const currentMax = [...els.windows].reduce((max, element) => {
    const zIndex = Number(getComputedStyle(element).zIndex);
    return Number.isFinite(zIndex) ? Math.max(max, zIndex) : max;
  }, 40);
  windowElement.style.zIndex = String(currentMax + 1);
}

function boardUnitCount() {
  return state.run.board.filter(Boolean).length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function traitChip(traitId) {
  const trait = balance.traitById[traitId];
  if (!trait) return `<span class="chip">${escapeHtml(traitId)}</span>`;
  const entry = computeTraitState(state, balance).find((candidate) => candidate.trait.id === traitId);
  const count = entry?.count ?? 0;
  const active = entry?.active ?? null;
  const next = entry?.next ?? null;
  const breakpointText = trait.breakpoints
    .map((breakpoint) => `${breakpoint.count}: ${formatTraitBonus(trait, breakpoint.value)}`)
    .join(" | ");
  const status = active
    ? `Active at ${active.count}. ${next ? `Next: ${next.count}.` : "Max breakpoint active."}`
    : `Inactive. Next: ${next?.count ?? trait.breakpoints[0].count}.`;
  const tooltipText = `${trait.name} ${count}/${next?.count ?? active?.count ?? trait.breakpoints[0].count}. ${trait.description} ${status} ${breakpointText}`;
  return `
    <span class="chip trait-chip ${active ? "active" : ""}" tabindex="0" title="${escapeHtml(tooltipText)}" aria-label="${escapeHtml(tooltipText)}">
      ${escapeHtml(trait.name)}
      <span class="trait-tooltip" role="tooltip">
        <strong>${escapeHtml(trait.name)} ${count}/${next?.count ?? active?.count ?? trait.breakpoints[0].count}</strong>
        <span>${escapeHtml(trait.description)}</span>
        <span>${escapeHtml(status)}</span>
        <span>${escapeHtml(breakpointText)}</span>
      </span>
    </span>
  `;
}

function formatTraitBonus(trait, value) {
  return trait.mode === "percent" ? `+${value}% ${trait.stat}` : `+${value} ${trait.stat}`;
}

function formatItemStat(item) {
  return `(${getItemEffectText(item)})`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
