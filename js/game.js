// ============================================================
// game.js - 게임 엔진 (상태, 인벤토리, 제작, 일꾼, 시장, 생존, 탈것)
// 전투는 systems/combat.js 에 위임
// ============================================================
import { RESOURCES, EQUIPMENT, ZONES, MONSTERS, RECIPES, VEHICLES,
         WORKER_TYPES, WORKER_NAMES, HIRE_COSTS, MARKET_BASE_PRICES,
         EXP_TABLE, INHERITABLE_CATEGORIES, ENV_NAMES } from './data.js';
import { CombatSystem } from './systems/combat.js';
import { GatheringSystem } from './systems/gathering.js';

// ---- 유틸리티 ----
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ---- 기본 상태 생성 ----
function createDefaultState() {
  return {
    player: {
      level: 1, exp: 0,
      hp: 100, maxHp: 100,
      hunger: 100, maxHunger: 100,
      stamina: 100, maxStamina: 100,
      attack: 5, defense: 2, speed: 10, luck: 5,
      gold: 50,
      legacyPoints: 0,
      deaths: 0,
      currentZone: 'plains',
      equippedVehicle: null,
    },
    inventory: { wood: 5, stone: 3, herb: 2, fiber: 3, raw_meat: 2 },
    equipment: [], // [ equipmentId, ... ] owned equipment items
    equippedGear: { weapon: null, armor: null, tool: null, accessory: null },
    unlockedZones: ['plains'],
    workers: [], // worker objects
    vehicles: [], // owned vehicle ids
    market: { prices: {}, lastUpdate: 0, trends: {} },
    // combat 상태는 CombatSystem이 관리 (여기엔 저장용 최소 데이터만)
    permanentBonuses: {
      gatherSpeed: 0, combatPower: 0, workerEfficiency: 0,
      maxHpBonus: 0, inheritanceSlots: 1,
    },
    inheritanceVault: [], // items preserved across death
    stats: { monstersKilled: 0, resourcesGathered: 0, itemsCrafted: 0, totalGoldEarned: 0 },
    tickCount: 0,
    lastSave: Date.now(),
  };
}

// ============================================================
// GameEngine 클래스
// ============================================================
export class GameEngine {
  constructor() {
    this.state = null;
    this.listeners = {};
    this.tickInterval = null;
    this.gatherCooldown = 0;
    this.combat = null; // CombatSystem 인스턴스
    this.gathering = null; // GatheringSystem 인스턴스
  }

  // ---- 이벤트 시스템 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ---- 초기화 ----
  init() {
    this.state = this.loadState() || createDefaultState();
    this.initCombatSystem();
    this.initGatheringSystem();
    this.initMarket();
    this.startGameLoop();
    this.emit('stateChanged', this.state);
  }

  // ---- 전투 시스템 초기화 (콜백 브릿지) ----
  initCombatSystem() {
    this.combat = new CombatSystem({
      getPlayerStats:  () => this.getPlayerStats(),
      getPlayerResist: () => this.getPlayerResistances(),
      getPlayerHp:     () => ({ hp: this.state.player.hp, maxHp: this.state.player.maxHp }),
      getWeaponData:   () => {
        const wId = this.state.equippedGear.weapon;
        return wId ? EQUIPMENT[wId] : null;
      },
      damagePlayer: (dmg) => {
        this.state.player.hp = clamp(this.state.player.hp - dmg, 0, this.state.player.maxHp);
      },
      healPlayer: (amt) => {
        this.state.player.hp = clamp(this.state.player.hp + amt, 0, this.state.player.maxHp);
      },
      hasPotion: () => {
        return this.hasItem('herb_potion', 1) || this.hasItem('fire_potion', 1) || this.hasItem('ice_potion', 1);
      },
      usePotion: () => {
        // 우선순위: 고급 물약 → 기본 물약
        const potions = [
          { id: 'fire_potion', heal: 50, name: '화염 물약' },
          { id: 'ice_potion',  heal: 50, name: '빙결 물약' },
          { id: 'herb_potion', heal: 30, name: '약초 물약' },
        ];
        for (const p of potions) {
          if (this.hasItem(p.id, 1)) {
            this.removeItem(p.id, 1);
            this.state.player.hp = clamp(this.state.player.hp + p.heal, 0, this.state.player.maxHp);
            return { healed: p.heal, name: p.name };
          }
        }
        return { healed: 0, name: '' };
      },
      addLoot: (items) => {
        for (const item of items) {
          this.addItem(item.id, item.amount);
        }
      },
      addExp:  (amt) => this.gainExp(amt),
      addGold: (amt) => {
        this.state.player.gold += amt;
        this.state.stats.totalGoldEarned += amt;
      },
      onDeath: (cause) => this.die(cause),
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // CombatSystem 이벤트 → GameEngine 이벤트 전달
    this.combat.on('toast', (t) => this.emit('toast', t));
    this.combat.on('combatStart', () => {
      this.state.stats.monstersKilled; // 참조만
      this.emit('stateChanged', this.state);
    });
    this.combat.on('combatEnd', (data) => {
      if (data.reason === 'victory') this.state.stats.monstersKilled++;
      this.emit('stateChanged', this.state);
    });
    this.combat.on('turnComplete', () => this.emit('stateChanged', this.state));
    this.combat.on('autoStart', () => this.emit('stateChanged', this.state));
    this.combat.on('autoStop', () => this.emit('stateChanged', this.state));
  }

  // ---- 자동채집 시스템 초기화 (콜백 브릿지) ----
  initGatheringSystem() {
    this.gathering = new GatheringSystem({
      getCurrentZone: () => this.state.player.currentZone,
      getPlayerStamina: () => ({
        stamina: this.state.player.stamina,
        maxStamina: this.state.player.maxStamina
      }),
      getPlayerLevel: () => this.state.player.level,
      getToolBonus: () => {
        const tool = this.state.equippedGear.tool;
        if (!tool || !EQUIPMENT[tool]) return { efficiency: 0, cooldownReduce: 0 };
        const eq = EQUIPMENT[tool];
        return {
          efficiency: eq.stats.gathering || 0,
          cooldownReduce: 0 // 나중에 장비에 추가 가능
        };
      },
      consumeStamina: (amt) => {
        if (this.state.player.stamina < amt) return false;
        this.state.player.stamina = clamp(this.state.player.stamina - amt, 0, this.state.player.maxStamina);
        return true;
      },
      gatherResource: () => {
        // 기존 gatherResource 로직 재사용 (쿨다운 없이)
        const s = this.state;
        const zone = ZONES[s.player.currentZone];
        if (!zone) return [];

        const gathered = [];
        const bonusSpeed = 1 + s.permanentBonuses.gatherSpeed * 0.01;
        for (const resId of zone.resources) {
          const rate = (zone.resourceRates[resId] || 0.5) * bonusSpeed;
          if (Math.random() < rate) {
            const amount = rand(1, 3);
            this.addItem(resId, amount);
            gathered.push({ id: resId, amount });
            s.stats.resourcesGathered += amount;
          }
        }
        return gathered;
      },
      hasStaminaFood: () => {
        return this.hasItem('herb_stew', 1) ||
               this.hasItem('nutrient_soup', 1) ||
               this.hasItem('energy_steak', 1) ||
               this.hasItem('energy_drink', 1);
      },
      useStaminaFood: () => {
        // 우선순위: 저티어 → 고티어 (효율적 사용)
        const foods = [
          { id: 'herb_stew', recover: 30, name: '허브 스튜' },
          { id: 'nutrient_soup', recover: 50, name: '영양 수프' },
          { id: 'energy_steak', recover: 80, name: '에너지 스테이크' },
          { id: 'energy_drink', recover: 120, name: '정제된 에너지 드링크' },
        ];
        for (const food of foods) {
          if (this.hasItem(food.id, 1)) {
            this.removeItem(food.id, 1);
            this.state.player.stamina = clamp(
              this.state.player.stamina + food.recover,
              0,
              this.state.player.maxStamina
            );
            return { recovered: food.recover, name: food.name };
          }
        }
        return { recovered: 0, name: '' };
      },
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // GatheringSystem 이벤트 → GameEngine 이벤트 전달
    this.gathering.on('toast', (t) => this.emit('toast', t));
    this.gathering.on('gatherStart', () => this.emit('stateChanged', this.state));
    this.gathering.on('gatherStop', () => this.emit('stateChanged', this.state));
    this.gathering.on('gatherTick', () => this.emit('stateChanged', this.state));
  }

  // ---- 저장/불러오기 ----
  saveState() {
    this.state.lastSave = Date.now();
    try {
      localStorage.setItem('tacgame_save', JSON.stringify(this.state));
    } catch (e) { /* quota exceeded */ }
  }
  loadState() {
    try {
      const raw = localStorage.getItem('tacgame_save');
      if (!raw) return null;
      const state = JSON.parse(raw);
      // 호환성: 새 필드 채우기
      const def = createDefaultState();
      for (const k of Object.keys(def)) {
        if (state[k] === undefined) state[k] = def[k];
      }
      if (!state.permanentBonuses) state.permanentBonuses = def.permanentBonuses;
      if (!state.stats) state.stats = def.stats;
      return state;
    } catch { return null; }
  }
  resetGame() {
    localStorage.removeItem('tacgame_save');
    this.state = createDefaultState();
    this.initMarket();
    this.emit('stateChanged', this.state);
    this.emit('toast', { msg: '게임이 초기화되었습니다.', type: 'info' });
  }

  // ---- 게임 루프 ----
  startGameLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    const s = this.state;
    s.tickCount++;

    // 배고픔 감소
    s.player.hunger = clamp(s.player.hunger - 0.15, 0, s.player.maxHunger);
    // 배고프면 HP 감소
    if (s.player.hunger <= 0) {
      s.player.hp = clamp(s.player.hp - 1, 0, s.player.maxHp);
      if (s.player.hp <= 0) {
        this.die('굶주림으로 사망했습니다.');
        return;
      }
    }
    // 스태미나 회복
    if (!this.combat.inCombat) {
      s.player.stamina = clamp(s.player.stamina + 0.5, 0, s.player.maxStamina);
    }
    // HP 자연회복 (배고픔 > 50)
    if (s.player.hunger > 50 && !this.combat.inCombat) {
      s.player.hp = clamp(s.player.hp + 0.3, 0, s.player.maxHp);
    }

    // 환경 피해
    const zone = ZONES[s.player.currentZone];
    if (zone && zone.hazardDmg > 0) {
      const resist = this.getPlayerResistances();
      const env = zone.environment;
      if (env) {
        const rVal = resist[env] || 0;
        const reduction = clamp(rVal / 100, 0, 1);
        const dmg = zone.hazardDmg * (1 - reduction);
        if (dmg > 0.1) {
          s.player.hp = clamp(s.player.hp - dmg, 0, s.player.maxHp);
          if (s.player.hp <= 0) {
            this.die(`${zone.name}의 환경 피해로 사망했습니다.`);
            return;
          }
        }
      }
    }

    // 일꾼 수집
    if (s.tickCount % 3 === 0) {
      this.workerGatherTick();
    }

    // 시장 가격 변동 (60초마다)
    if (s.tickCount % 60 === 0) {
      this.updateMarketPrices();
    }

    // 쿨다운
    if (this.gatherCooldown > 0) this.gatherCooldown--;

    // 자동저장 (30초)
    if (s.tickCount % 30 === 0) this.saveState();

    this.emit('tick', s);
  }

  // ---- 플레이어 스탯 계산 ----
  getPlayerStats() {
    const s = this.state;
    const base = { attack: s.player.attack, defense: s.player.defense, speed: s.player.speed, luck: s.player.luck, hp: s.player.maxHp };
    // 장비 보너스
    for (const slot of Object.values(s.equippedGear)) {
      if (slot && EQUIPMENT[slot]) {
        const eq = EQUIPMENT[slot];
        if (eq.stats.attack) base.attack += eq.stats.attack;
        if (eq.stats.defense) base.defense += eq.stats.defense;
        if (eq.stats.speed) base.speed += eq.stats.speed;
        if (eq.stats.luck) base.luck += eq.stats.luck;
        if (eq.stats.hp) base.hp += eq.stats.hp;
        if (eq.stats.crit) base.crit = (base.crit || 0) + eq.stats.crit;
      }
    }
    // 레벨 보너스
    base.attack += s.player.level * 2;
    base.defense += s.player.level;
    base.hp += s.player.level * 5;
    // 영구 보너스
    base.attack += s.permanentBonuses.combatPower;
    base.hp += s.permanentBonuses.maxHpBonus;
    return base;
  }

  getPlayerResistances() {
    const resist = { fire: 0, cold: 0, lightning: 0, void: 0, pressure: 0, radiation: 0 };
    const s = this.state;
    for (const slot of Object.values(s.equippedGear)) {
      if (slot && EQUIPMENT[slot] && EQUIPMENT[slot].resistances) {
        for (const [k, v] of Object.entries(EQUIPMENT[slot].resistances)) {
          resist[k] = (resist[k] || 0) + v;
        }
      }
    }
    return resist;
  }

  // ---- 지역 이동 ----
  canEnterZone(zoneId) {
    const zone = ZONES[zoneId];
    if (!zone) return { ok: false, reason: '존재하지 않는 지역' };
    const s = this.state;
    // 선행 지역
    if (zone.requiredZone && !s.unlockedZones.includes(zone.requiredZone)) {
      return { ok: false, reason: `${ZONES[zone.requiredZone].name} 해금 필요` };
    }
    // 탈것
    if (zone.requiredVehicle && !s.vehicles.includes(zone.requiredVehicle)) {
      return { ok: false, reason: `${VEHICLES[zone.requiredVehicle].name} 필요` };
    }
    // 저항 체크 (플레이어)
    const resist = this.getPlayerResistances();
    for (const [rType, rVal] of Object.entries(zone.requiredResist)) {
      if ((resist[rType] || 0) < rVal) {
        return { ok: false, reason: `${ENV_NAMES[rType] || rType} 저항 ${rVal} 이상 필요 (현재: ${resist[rType] || 0})` };
      }
    }
    return { ok: true };
  }

  enterZone(zoneId) {
    const check = this.canEnterZone(zoneId);
    if (!check.ok) {
      this.emit('toast', { msg: check.reason, type: 'error' });
      return false;
    }
    this.state.player.currentZone = zoneId;
    if (!this.state.unlockedZones.includes(zoneId)) {
      this.state.unlockedZones.push(zoneId);
    }
    this.emit('toast', { msg: `${ZONES[zoneId].name}에 도착했습니다.`, type: 'info' });
    this.emit('stateChanged', this.state);
    return true;
  }

  // 해금된 지역 + 해금 가능한 지역 리스트
  getVisibleZones() {
    const s = this.state;
    const visible = new Set(s.unlockedZones);
    // 해금된 지역의 다음 단계 지역 표시
    for (const [zId, zone] of Object.entries(ZONES)) {
      if (visible.has(zId)) continue;
      if (!zone.requiredZone || visible.has(zone.requiredZone)) {
        visible.add(zId);
      }
    }
    return [...visible];
  }

  // ---- 자원 수집 (수동) ----
  gatherResource() {
    if (this.gatherCooldown > 0) {
      this.emit('toast', { msg: '잠시 후 다시 채집하세요.', type: 'warning' });
      return;
    }
    const s = this.state;
    if (s.player.stamina < 5) {
      this.emit('toast', { msg: '스태미나가 부족합니다!', type: 'error' });
      return;
    }
    const zone = ZONES[s.player.currentZone];
    if (!zone) return;

    s.player.stamina -= 5;
    this.gatherCooldown = 1;

    const gathered = [];
    const bonusSpeed = 1 + s.permanentBonuses.gatherSpeed * 0.01;
    for (const resId of zone.resources) {
      const rate = (zone.resourceRates[resId] || 0.5) * bonusSpeed;
      if (Math.random() < rate) {
        const amount = rand(1, 3);
        this.addItem(resId, amount);
        gathered.push({ id: resId, amount });
        s.stats.resourcesGathered += amount;
      }
    }

    if (gathered.length > 0) {
      const text = gathered.map(g => `${this.getItemName(g.id)} x${g.amount}`).join(', ');
      this.emit('toast', { msg: `채집: ${text}`, type: 'success' });
    } else {
      this.emit('toast', { msg: '아무것도 발견하지 못했습니다.', type: 'info' });
    }
    this.emit('stateChanged', s);
    return gathered;
  }

  // ---- 인벤토리 ----
  addItem(itemId, amount = 1) {
    if (!this.state.inventory[itemId]) this.state.inventory[itemId] = 0;
    this.state.inventory[itemId] += amount;
  }
  removeItem(itemId, amount = 1) {
    if (!this.state.inventory[itemId]) return false;
    if (this.state.inventory[itemId] < amount) return false;
    this.state.inventory[itemId] -= amount;
    if (this.state.inventory[itemId] <= 0) delete this.state.inventory[itemId];
    return true;
  }
  hasItem(itemId, amount = 1) {
    return (this.state.inventory[itemId] || 0) >= amount;
  }
  getItemCount(itemId) {
    return this.state.inventory[itemId] || 0;
  }
  getItemName(itemId) {
    if (RESOURCES[itemId]) return RESOURCES[itemId].name;
    if (EQUIPMENT[itemId]) return EQUIPMENT[itemId].name;
    return itemId;
  }
  getItemIcon(itemId) {
    if (RESOURCES[itemId]) return RESOURCES[itemId].icon;
    if (EQUIPMENT[itemId]) return EQUIPMENT[itemId].icon;
    return '❓';
  }
  getItemTier(itemId) {
    if (RESOURCES[itemId]) return RESOURCES[itemId].tier;
    if (EQUIPMENT[itemId]) return EQUIPMENT[itemId].tier;
    return 1;
  }

  // ---- 장비 ----
  addEquipment(eqId) {
    this.state.equipment.push(eqId);
  }
  equipItem(eqId) {
    const eq = EQUIPMENT[eqId];
    if (!eq) return;
    if (!this.state.equipment.includes(eqId)) return;
    const slot = eq.slot;
    // 기존 장비 해제
    if (this.state.equippedGear[slot]) {
      // 이미 같은 거면 해제만
      if (this.state.equippedGear[slot] === eqId) {
        this.state.equippedGear[slot] = null;
        this.recalcPlayerStats();
        this.emit('toast', { msg: `${eq.name} 해제`, type: 'info' });
        this.emit('stateChanged', this.state);
        return;
      }
    }
    this.state.equippedGear[slot] = eqId;
    this.recalcPlayerStats();
    this.emit('toast', { msg: `${eq.name} 장착!`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  recalcPlayerStats() {
    const stats = this.getPlayerStats();
    this.state.player.maxHp = stats.hp;
    if (this.state.player.hp > stats.hp) this.state.player.hp = stats.hp;
  }

  // ---- 제작 ----
  canCraft(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;
    return recipe.ingredients.every(ing => this.hasItem(ing.id, ing.amount));
  }

  // 최대 제작 가능 수량 계산
  getMaxCraftableAmount(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return 0;

    let maxAmount = Infinity;
    for (const ing of recipe.ingredients) {
      const available = this.getItemCount(ing.id);
      const possible = Math.floor(available / ing.amount);
      maxAmount = Math.min(maxAmount, possible);
    }

    return maxAmount === Infinity ? 0 : maxAmount;
  }

  craft(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    if (!this.canCraft(recipeId)) {
      this.emit('toast', { msg: '재료가 부족합니다.', type: 'error' });
      return;
    }
    // 재료 소모
    for (const ing of recipe.ingredients) {
      this.removeItem(ing.id, ing.amount);
    }
    // 결과물
    if (recipe.type === 'equipment') {
      this.addEquipment(recipe.result);
      this.emit('toast', { msg: `${recipe.name} 제작 완료!`, type: 'success' });
    } else {
      this.addItem(recipe.result, recipe.amount);
      this.emit('toast', { msg: `${recipe.name} x${recipe.amount} 제작 완료!`, type: 'success' });
    }
    this.state.stats.itemsCrafted++;
    this.emit('stateChanged', this.state);
  }

  // 대량 제작
  craftMultiple(recipeId, count) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // 실제 제작 가능한 수량 계산
    const maxAmount = this.getMaxCraftableAmount(recipeId);
    const actualCount = Math.min(count, maxAmount);

    if (actualCount <= 0) {
      this.emit('toast', { msg: '재료가 부족합니다.', type: 'error' });
      return;
    }

    // 재료 소모
    for (const ing of recipe.ingredients) {
      this.removeItem(ing.id, ing.amount * actualCount);
    }

    // 결과물
    if (recipe.type === 'equipment') {
      // 장비는 개별 생성
      for (let i = 0; i < actualCount; i++) {
        this.addEquipment(recipe.result);
      }
      this.emit('toast', { msg: `${recipe.name} x${actualCount} 제작 완료!`, type: 'success' });
    } else {
      const totalAmount = recipe.amount * actualCount;
      this.addItem(recipe.result, totalAmount);
      this.emit('toast', { msg: `${recipe.name} x${totalAmount} 제작 완료! (${actualCount}회 제작)`, type: 'success' });
    }

    this.state.stats.itemsCrafted += actualCount;
    this.emit('stateChanged', this.state);

    return actualCount;
  }

  // ---- 전투 (CombatSystem에 위임) ----
  startCombat(monsterId) { return this.combat.startCombat(monsterId); }
  combatAttack()         { this.combat.attack(); }
  combatUsePotion()      { this.combat.usePotion(); }
  combatFlee()           { this.combat.flee(); }
  startAutoCombat(monsterId, count, speed) { this.combat.startAuto(monsterId, count, speed); }
  stopAutoCombat()       { this.combat.stopAuto('자동전투를 중단했습니다.'); }
  setAutoSpeed(speed)    { this.combat.setAutoSpeed(speed); }
  getCombatSnapshot()    { return this.combat.getSnapshot(); }
  getAutoSnapshot()      { return this.combat.getAutoSnapshot(); }

  // ---- 자동채집 (GatheringSystem에 위임) ----
  startAutoGather()      { return this.gathering.start(); }
  stopAutoGather()       { this.gathering.stop('자동채집을 중단했습니다.'); }
  setAutoFood(enabled)   { this.gathering.setAutoFood(enabled); }
  setFoodThreshold(val)  { this.gathering.setFoodThreshold(val); }
  setStopThreshold(val)  { this.gathering.setStopThreshold(val); }
  getGatherSnapshot()    { return this.gathering.getSnapshot(); }

  // ---- 경험치 / 레벨업 ----
  gainExp(amount) {
    const s = this.state;
    s.player.exp += amount;
    while (s.player.level < EXP_TABLE.length && s.player.exp >= EXP_TABLE[s.player.level]) {
      s.player.exp -= EXP_TABLE[s.player.level];
      s.player.level++;
      s.player.maxHp += 10;
      s.player.hp = s.player.maxHp;
      s.player.attack += 2;
      s.player.defense += 1;
      // 스태미나 증가 (레벨당 +4)
      s.player.maxStamina += 4;
      s.player.stamina = s.player.maxStamina;
      this.emit('toast', { msg: `🎉 레벨 ${s.player.level} 달성!`, type: 'success' });
    }
  }

  // ---- 음식 사용 ----
  useFood(itemId) {
    if (!this.hasItem(itemId, 1)) return;
    let healed = 0;
    let fed = 0;
    switch(itemId) {
      case 'cooked_meat':  fed = 30; healed = 10; break;
      case 'raw_meat':     fed = 10; break;
      case 'fish':         fed = 15; healed = 5; break;
      case 'herb_potion':  healed = 30; break;
      case 'mushroom':     fed = 8; healed = 5; break;
      case 'herb':         healed = 5; break;
      case 'cactus':       fed = 5; healed = 3; break;
      case 'fire_potion':  healed = 50; break;
      case 'ice_potion':   healed = 50; break;
      default: return;
    }
    this.removeItem(itemId, 1);
    if (fed > 0) {
      this.state.player.hunger = clamp(this.state.player.hunger + fed, 0, this.state.player.maxHunger);
    }
    if (healed > 0) {
      this.state.player.hp = clamp(this.state.player.hp + healed, 0, this.state.player.maxHp);
    }
    this.emit('toast', { msg: `${this.getItemName(itemId)} 사용! HP+${healed} 포만감+${fed}`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  // ---- 일꾼 시스템 ----
  hireWorker(type) {
    const cost = HIRE_COSTS[type];
    if (!cost) return;
    if (this.state.player.gold < cost) {
      this.emit('toast', { msg: `골드가 부족합니다! (${cost}골드 필요)`, type: 'error' });
      return;
    }
    this.state.player.gold -= cost;
    const wType = WORKER_TYPES[type];
    const names = WORKER_NAMES[type];
    const worker = {
      id: uid(),
      name: names[rand(0, names.length - 1)],
      type: type,
      level: 1,
      exp: 0,
      stats: { ...wType.baseStats },
      // 스탯 랜덤 보정
      equipment: { weapon: null, armor: null, tool: null, accessory: null },
      deployedZone: null,
      gatherCount: 0,
    };
    // 랜덤 보정 ±3
    for (const k of Object.keys(worker.stats)) {
      worker.stats[k] += rand(-3, 3);
      worker.stats[k] = Math.max(1, worker.stats[k]);
    }
    this.state.workers.push(worker);
    this.emit('toast', { msg: `${worker.name} 고용! (${type})`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  deployWorker(workerId, zoneId) {
    const worker = this.state.workers.find(w => w.id === workerId);
    if (!worker) return;
    const zone = ZONES[zoneId];
    if (!zone) return;

    // 슬롯 체크
    const deployed = this.state.workers.filter(w => w.deployedZone === zoneId);
    if (deployed.length >= zone.workerSlots) {
      this.emit('toast', { msg: `${zone.name}의 배치 슬롯이 가득 찼습니다! (${zone.workerSlots}/${zone.workerSlots})`, type: 'error' });
      return;
    }

    // 해금 체크
    if (!this.state.unlockedZones.includes(zoneId)) {
      this.emit('toast', { msg: '해금되지 않은 지역입니다.', type: 'error' });
      return;
    }

    worker.deployedZone = zoneId;
    this.emit('toast', { msg: `${worker.name}을(를) ${zone.name}에 배치!`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  recallWorker(workerId) {
    const worker = this.state.workers.find(w => w.id === workerId);
    if (!worker) return;
    worker.deployedZone = null;
    this.emit('toast', { msg: `${worker.name} 복귀`, type: 'info' });
    this.emit('stateChanged', this.state);
  }

  equipWorker(workerId, eqId) {
    const worker = this.state.workers.find(w => w.id === workerId);
    if (!worker) return;
    const eq = EQUIPMENT[eqId];
    if (!eq) return;
    if (!this.state.equipment.includes(eqId)) return;

    const slot = eq.slot;
    // 기존 장비 해제 (기존 장비가 플레이어가 끼고 있는 것이면 안 됨)
    if (worker.equipment[slot] === eqId) {
      worker.equipment[slot] = null;
      this.emit('toast', { msg: `${worker.name}의 ${eq.name} 해제`, type: 'info' });
    } else {
      // 다른 일꾼이 끼고 있는지 체크
      for (const w of this.state.workers) {
        if (w.equipment[slot] === eqId) {
          w.equipment[slot] = null;
        }
      }
      // 플레이어가 끼고 있으면 해제
      if (this.state.equippedGear[slot] === eqId) {
        this.state.equippedGear[slot] = null;
      }
      worker.equipment[slot] = eqId;
      this.emit('toast', { msg: `${worker.name}에게 ${eq.name} 장착!`, type: 'success' });
    }
    this.emit('stateChanged', this.state);
  }

  getWorkerEfficiency(worker) {
    if (!worker.deployedZone) return 0;
    const zone = ZONES[worker.deployedZone];
    const wType = WORKER_TYPES[worker.type];
    let eff = 1.0;

    // 스탯 기반 효율
    const statBonus = (worker.stats.str + worker.stats.dex + worker.stats.int) / 30;
    eff *= (1 + statBonus);

    // 도구 보너스
    if (worker.equipment.tool && EQUIPMENT[worker.equipment.tool]) {
      const tool = EQUIPMENT[worker.equipment.tool];
      const toolStats = tool.stats;
      if (toolStats.mining && (zone.resources.some(r => RESOURCES[r]?.category === 'ore' || RESOURCES[r]?.category === 'stone'))) {
        eff *= (1 + toolStats.mining / 100);
      }
      if (toolStats.logging && (zone.resources.some(r => RESOURCES[r]?.category === 'wood'))) {
        eff *= (1 + toolStats.logging / 100);
      }
      if (toolStats.fishing && (zone.resources.some(r => RESOURCES[r]?.category === 'food' && r.includes('fish')))) {
        eff *= (1 + toolStats.fishing / 100);
      }
      if (toolStats.gathering) {
        eff *= (1 + toolStats.gathering / 200);
      }
    }

    // 환경 저항 효율
    if (zone.environment) {
      const resist = this.getWorkerResistance(worker, zone.environment);
      const needed = zone.requiredResist[zone.environment] || 0;
      if (needed > 0) {
        const ratio = clamp(resist / needed, 0, 2);
        if (ratio < 1) {
          eff *= ratio * 0.5; // 저항 부족하면 크게 페널티
        } else {
          eff *= 1 + (ratio - 1) * 0.3; // 초과하면 소폭 보너스
        }
      }
    }

    // 일꾼 레벨 보너스
    eff *= (1 + worker.level * 0.1);

    // 영구 보너스
    eff *= (1 + this.state.permanentBonuses.workerEfficiency * 0.01);

    return eff;
  }

  getWorkerResistance(worker, type) {
    let resist = 0;
    for (const slot of Object.values(worker.equipment)) {
      if (slot && EQUIPMENT[slot] && EQUIPMENT[slot].resistances) {
        resist += (EQUIPMENT[slot].resistances[type] || 0);
      }
    }
    return resist;
  }

  workerGatherTick() {
    const s = this.state;
    for (const worker of s.workers) {
      if (!worker.deployedZone) continue;
      const zone = ZONES[worker.deployedZone];
      if (!zone) continue;

      const eff = this.getWorkerEfficiency(worker);
      if (eff <= 0) continue;

      // 각 자원에 대해 채집 시도
      for (const resId of zone.resources) {
        const baseRate = (zone.resourceRates[resId] || 0.3) * 0.3; // 일꾼은 수동 대비 30%
        const finalRate = baseRate * eff;
        if (Math.random() < finalRate) {
          const amount = 1;
          this.addItem(resId, amount);
          worker.gatherCount++;
          s.stats.resourcesGathered += amount;
        }
      }

      // 일꾼 경험치
      worker.exp += 1;
      if (worker.exp >= worker.level * 20) {
        worker.exp = 0;
        worker.level++;
        // 스탯 증가
        const statKeys = Object.keys(worker.stats);
        const upStat = statKeys[rand(0, statKeys.length - 1)];
        worker.stats[upStat] += 1;
      }
    }
  }

  // ---- 탈것 ----
  canCraftVehicle(vehicleId) {
    const v = VEHICLES[vehicleId];
    if (!v) return false;
    if (this.state.vehicles.includes(vehicleId)) return false;
    if (v.prerequisite && !this.state.vehicles.includes(v.prerequisite)) return false;
    return v.ingredients.every(ing => this.hasItem(ing.id, ing.amount));
  }

  craftVehicle(vehicleId) {
    const v = VEHICLES[vehicleId];
    if (!v) return;
    if (!this.canCraftVehicle(vehicleId)) {
      this.emit('toast', { msg: '재료가 부족하거나 조건을 충족하지 못했습니다.', type: 'error' });
      return;
    }
    for (const ing of v.ingredients) {
      this.removeItem(ing.id, ing.amount);
    }
    this.state.vehicles.push(vehicleId);
    // 해금 지역
    for (const zId of v.unlocksZones) {
      if (!this.state.unlockedZones.includes(zId)) {
        this.state.unlockedZones.push(zId);
        this.emit('toast', { msg: `🗺️ ${ZONES[zId].name} 해금!`, type: 'success' });
      }
    }
    this.emit('toast', { msg: `🚀 ${v.name} 제작 완료!`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  equipVehicle(vehicleId) {
    if (!this.state.vehicles.includes(vehicleId)) return;
    if (this.state.player.equippedVehicle === vehicleId) {
      this.state.player.equippedVehicle = null;
      this.emit('toast', { msg: `${VEHICLES[vehicleId].name} 해제`, type: 'info' });
    } else {
      this.state.player.equippedVehicle = vehicleId;
      this.emit('toast', { msg: `${VEHICLES[vehicleId].name} 탑승!`, type: 'success' });
    }
    this.emit('stateChanged', this.state);
  }

  // ---- 시장 ----
  initMarket() {
    const s = this.state;
    if (!s.market.prices || Object.keys(s.market.prices).length === 0) {
      s.market.prices = {};
      s.market.trends = {};
      for (const [id, base] of Object.entries(MARKET_BASE_PRICES)) {
        s.market.prices[id] = base;
        s.market.trends[id] = 0; // -1, 0, 1
      }
    }
  }

  updateMarketPrices() {
    const s = this.state;
    for (const [id, base] of Object.entries(MARKET_BASE_PRICES)) {
      const old = s.market.prices[id] || base;
      const volatility = 0.08 + (RESOURCES[id]?.tier || 1) * 0.02;
      const change = (Math.random() * 2 - 1) * volatility;
      let newPrice = old * (1 + change);
      // 가격 범위 제한 (기본가의 40% ~ 200%)
      newPrice = clamp(newPrice, base * 0.4, base * 2.0);
      newPrice = Math.round(newPrice * 10) / 10;
      s.market.trends[id] = newPrice > old ? 1 : newPrice < old ? -1 : 0;
      s.market.prices[id] = newPrice;
    }
    this.emit('marketUpdate', s.market);
  }

  buyFromMarket(itemId, quantity) {
    const s = this.state;
    const price = s.market.prices[itemId];
    if (!price) return;
    const totalCost = Math.ceil(price * quantity * 1.1); // 매입 수수료 10%
    if (s.player.gold < totalCost) {
      this.emit('toast', { msg: '골드가 부족합니다!', type: 'error' });
      return;
    }
    s.player.gold -= totalCost;
    this.addItem(itemId, quantity);
    // 수요 증가 → 가격 약간 상승
    s.market.prices[itemId] *= 1.02;
    this.emit('toast', { msg: `${this.getItemName(itemId)} x${quantity} 구매! (-${totalCost}G)`, type: 'success' });
    this.emit('stateChanged', s);
  }

  sellToMarket(itemId, quantity) {
    const s = this.state;
    const price = s.market.prices[itemId];
    if (!price) return;
    if (!this.hasItem(itemId, quantity)) {
      this.emit('toast', { msg: '수량이 부족합니다!', type: 'error' });
      return;
    }
    const totalGain = Math.floor(price * quantity * 0.9); // 매도 수수료 10%
    this.removeItem(itemId, quantity);
    s.player.gold += totalGain;
    s.stats.totalGoldEarned += totalGain;
    // 공급 증가 → 가격 약간 하락
    s.market.prices[itemId] *= 0.98;
    this.emit('toast', { msg: `${this.getItemName(itemId)} x${quantity} 판매! (+${totalGain}G)`, type: 'success' });
    this.emit('stateChanged', s);
  }

  // ---- 사망 / 계승 ----
  die(cause) {
    const s = this.state;
    if (this.combat) this.combat.stopAuto();
    s.player.deaths++;

    // 레거시 포인트 계산
    const lpGain = Math.floor(s.player.level * 2 + s.stats.monstersKilled * 0.1 + s.stats.resourcesGathered * 0.01);
    s.player.legacyPoints += lpGain;

    this.emit('death', {
      cause,
      level: s.player.level,
      legacyGain: lpGain,
      totalLegacy: s.player.legacyPoints,
    });
  }

  revive() {
    const s = this.state;
    const oldLegacy = s.player.legacyPoints;
    const oldBonuses = { ...s.permanentBonuses };
    const oldDeaths = s.player.deaths;
    const oldVault = [...s.inheritanceVault];
    const oldVehicles = [...s.vehicles]; // 탈것은 유지
    const oldUnlockedZones = [...s.unlockedZones];
    const oldWorkers = s.workers.filter(w => w.level >= 5); // 레벨 5 이상 일꾼만 유지
    const oldStats = { ...s.stats };

    // 리셋
    const fresh = createDefaultState();
    this.state = fresh;
    this.state.player.legacyPoints = oldLegacy;
    this.state.player.deaths = oldDeaths;
    this.state.permanentBonuses = oldBonuses;
    this.state.vehicles = oldVehicles;
    this.state.unlockedZones = oldUnlockedZones;
    this.state.workers = oldWorkers;
    for (const w of this.state.workers) {
      w.deployedZone = null; // 배치 해제
    }
    this.state.stats = oldStats;

    // 계승 아이템 복원
    for (const item of oldVault) {
      if (RESOURCES[item.id]) {
        this.addItem(item.id, item.amount);
      } else if (EQUIPMENT[item.id]) {
        this.addEquipment(item.id);
      }
    }
    this.state.inheritanceVault = [];

    // 영구 보너스 (사망마다 소폭 증가)
    this.state.permanentBonuses.gatherSpeed += 2;
    this.state.permanentBonuses.combatPower += 1;
    this.state.permanentBonuses.workerEfficiency += 1;
    this.state.permanentBonuses.maxHpBonus += 5;

    this.initMarket();
    this.recalcPlayerStats();
    this.saveState();
    this.emit('toast', { msg: `부활! 레거시 포인트로 영구 보너스 강화!`, type: 'info' });
    this.emit('stateChanged', this.state);
  }

  addToVault(itemId, amount) {
    const s = this.state;
    const slots = s.permanentBonuses.inheritanceSlots + Math.floor(s.player.legacyPoints / 50);
    if (s.inheritanceVault.length >= slots) {
      this.emit('toast', { msg: `계승 슬롯이 가득 찼습니다! (${slots}칸)`, type: 'error' });
      return;
    }
    if (RESOURCES[itemId]) {
      if (!this.hasItem(itemId, amount)) return;
      this.removeItem(itemId, amount);
      const existing = s.inheritanceVault.find(v => v.id === itemId);
      if (existing) { existing.amount += amount; }
      else { s.inheritanceVault.push({ id: itemId, amount }); }
    } else if (EQUIPMENT[itemId]) {
      if (!s.equipment.includes(itemId)) return;
      s.equipment = s.equipment.filter(e => e !== itemId);
      s.inheritanceVault.push({ id: itemId, amount: 1 });
    }
    this.emit('toast', { msg: `${this.getItemName(itemId)} 계승 보관함에 추가!`, type: 'success' });
    this.emit('stateChanged', s);
  }

  // ---- 접근자 ----
  getState() { return this.state; }
}
