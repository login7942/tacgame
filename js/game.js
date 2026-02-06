// ============================================================
// game.js - 게임 엔진 (상태, 인벤토리, 제작, 전투, 일꾼, 시장, 생존, 탈것)
// ============================================================
import { RESOURCES, EQUIPMENT, ZONES, MONSTERS, RECIPES, VEHICLES,
         WORKER_TYPES, WORKER_NAMES, HIRE_COSTS, MARKET_BASE_PRICES,
         EXP_TABLE, INHERITABLE_CATEGORIES, ENV_NAMES } from './data.js';

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
    combat: { inCombat: false, enemy: null, enemyHp: 0, log: [] },
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
    this.initMarket();
    this.startGameLoop();
    this.emit('stateChanged', this.state);
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
    if (!s.combat.inCombat) {
      s.player.stamina = clamp(s.player.stamina + 0.5, 0, s.player.maxStamina);
    }
    // HP 자연회복 (배고픔 > 50)
    if (s.player.hunger > 50 && !s.combat.inCombat) {
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

  // ---- 전투 ----
  startCombat(monsterId) {
    const mon = MONSTERS[monsterId];
    if (!mon) return;
    if (this.state.combat.inCombat) {
      this.emit('toast', { msg: '이미 전투 중입니다!', type: 'warning' });
      return;
    }
    if (this.state.player.hp < 10) {
      this.emit('toast', { msg: 'HP가 너무 낮아 전투할 수 없습니다!', type: 'error' });
      return;
    }
    this.state.combat = {
      inCombat: true,
      enemyId: monsterId,
      enemy: { ...mon },
      enemyHp: mon.hp,
      enemyMaxHp: mon.hp,
      log: [`⚔️ ${mon.name}과(와) 전투 시작!`],
      turn: 0,
    };
    this.emit('combatStart', this.state.combat);
    this.emit('stateChanged', this.state);
  }

  combatAttack() {
    const c = this.state.combat;
    if (!c.inCombat) return;
    const pStats = this.getPlayerStats();
    const mon = c.enemy;

    c.turn++;

    // 플레이어 공격
    let pDmg = Math.max(1, pStats.attack - mon.def * 0.5);
    // 크리티컬
    const critChance = (pStats.crit || 0) + pStats.luck * 0.5;
    let isCrit = false;
    if (Math.random() * 100 < critChance) {
      pDmg = Math.floor(pDmg * 1.8);
      isCrit = true;
    }
    // 속성 보너스
    const resist = this.getPlayerResistances();
    if (mon.weakness === 'fire' && (this.state.equippedGear.weapon && EQUIPMENT[this.state.equippedGear.weapon]?.stats?.fireDmg)) {
      pDmg += EQUIPMENT[this.state.equippedGear.weapon].stats.fireDmg;
    }
    if (mon.weakness === 'cold' && (this.state.equippedGear.weapon && EQUIPMENT[this.state.equippedGear.weapon]?.stats?.iceDmg)) {
      pDmg += EQUIPMENT[this.state.equippedGear.weapon].stats.iceDmg;
    }

    pDmg = Math.floor(pDmg * (1 + rand(-10, 10) / 100));
    c.enemyHp -= pDmg;
    c.log.push(`${isCrit ? '💥 크리티컬! ' : ''}${pDmg} 데미지를 입혔다!`);

    // 몬스터 처치 체크
    if (c.enemyHp <= 0) {
      c.enemyHp = 0;
      this.combatVictory();
      return;
    }

    // 몬스터 공격
    let mDmg = Math.max(1, mon.atk - pStats.defense * 0.5);
    // 속성 방어
    if (mon.element && resist[mon.element]) {
      mDmg *= (1 - clamp(resist[mon.element] / 100, 0, 0.8));
    }
    mDmg = Math.floor(mDmg * (1 + rand(-15, 15) / 100));
    this.state.player.hp -= mDmg;
    c.log.push(`${mon.name}의 공격! ${mDmg} 데미지를 받았다!`);

    if (this.state.player.hp <= 0) {
      this.state.player.hp = 0;
      c.inCombat = false;
      c.log.push(`💀 ${mon.name}에게 패배했습니다...`);
      this.emit('stateChanged', this.state);
      this.die(`${mon.name}에게 패배했습니다.`);
      return;
    }

    this.emit('stateChanged', this.state);
  }

  combatUsePotion() {
    const c = this.state.combat;
    if (!c.inCombat) return;

    // 사용 가능한 물약 찾기
    if (this.hasItem('herb_potion', 1)) {
      this.removeItem('herb_potion', 1);
      const heal = 30;
      this.state.player.hp = clamp(this.state.player.hp + heal, 0, this.state.player.maxHp);
      c.log.push(`🧪 약초 물약 사용! HP +${heal}`);

      // 몬스터 턴
      this.combatEnemyTurn();
    } else {
      this.emit('toast', { msg: '사용할 물약이 없습니다!', type: 'error' });
    }
  }

  combatEnemyTurn() {
    const c = this.state.combat;
    const pStats = this.getPlayerStats();
    const mon = c.enemy;
    const resist = this.getPlayerResistances();

    let mDmg = Math.max(1, mon.atk - pStats.defense * 0.5);
    if (mon.element && resist[mon.element]) {
      mDmg *= (1 - clamp(resist[mon.element] / 100, 0, 0.8));
    }
    mDmg = Math.floor(mDmg * (1 + rand(-15, 15) / 100));
    this.state.player.hp -= mDmg;
    c.log.push(`${mon.name}의 공격! ${mDmg} 데미지를 받았다!`);

    if (this.state.player.hp <= 0) {
      this.state.player.hp = 0;
      c.inCombat = false;
      this.die(`${mon.name}에게 패배했습니다.`);
      return;
    }
    this.emit('stateChanged', this.state);
  }

  combatFlee() {
    const c = this.state.combat;
    if (!c.inCombat) return;
    const pStats = this.getPlayerStats();
    const fleeChance = 50 + (pStats.speed - c.enemy.spd) * 2;
    if (Math.random() * 100 < fleeChance) {
      c.inCombat = false;
      c.log.push('🏃 도주에 성공했습니다!');
      this.emit('toast', { msg: '도주 성공!', type: 'info' });
    } else {
      c.log.push('🏃 도주 실패!');
      this.combatEnemyTurn();
    }
    this.emit('stateChanged', this.state);
  }

  combatVictory() {
    const c = this.state.combat;
    const mon = c.enemy;
    c.inCombat = false;
    c.log.push(`🎉 ${mon.name}을(를) 처치했습니다!`);

    // 경험치
    this.gainExp(mon.exp);
    // 골드
    const goldGain = mon.gold + rand(0, Math.floor(mon.gold * 0.3));
    this.state.player.gold += goldGain;
    this.state.stats.totalGoldEarned += goldGain;
    c.log.push(`💰 ${goldGain} 골드 획득!`);

    // 드롭
    const drops = [];
    for (const loot of (MONSTERS[c.enemyId]?.loot || [])) {
      const luckBonus = this.state.player.luck * 0.005;
      if (Math.random() < loot.chance + luckBonus) {
        const amt = rand(loot.min, loot.max);
        this.addItem(loot.id, amt);
        drops.push({ id: loot.id, amount: amt });
      }
    }
    if (drops.length > 0) {
      const text = drops.map(d => `${this.getItemName(d.id)} x${d.amount}`).join(', ');
      c.log.push(`📦 드롭: ${text}`);
    }

    this.state.stats.monstersKilled++;
    this.emit('stateChanged', this.state);
  }

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
    s.combat.inCombat = false;
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
