// ============================================================
// game.js - 게임 엔진 (상태, 인벤토리, 제작, 일꾼, 시장, 생존, 탈것)
// 전투는 systems/combat.js 에 위임
// ============================================================
import { RESOURCES, EQUIPMENT, ZONES, MONSTERS, RECIPES, VEHICLES,
         WORKER_TYPES, WORKER_NAMES, HIRE_COSTS, MARKET_BASE_PRICES,
         EXP_TABLE, INHERITABLE_CATEGORIES, ENV_NAMES,
         BYPRODUCT_RULES, WORKER_FOOD_TABLE,
         MERCENARY_TYPES, MERCENARY_NAMES, MERCENARY_HIRE_COSTS,
         MERC_STAMINA_FOOD, EXPEDITION_CONFIG } from './data.js';
import { CombatSystem } from './systems/combat.js';
import { GatheringSystem } from './systems/gathering.js';
import { EnhancementSystem } from './systems/enhancement.js';
import { MarketSystem } from './systems/market.js';
import { CodexSystem } from './systems/codex.js';
import { MissionSystem } from './systems/missions.js';
import { ExpeditionSystem } from './systems/expedition.js';

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
    workerMaintenance: { autoFeed: true, autoRepair: true },
    codex: {
      entries: {
        resources: {},
        monsters: {},
        equipment: {}
      },
      milestones: {}
    },
    missions: {
      dailyMissions: [], weeklyMissions: [],
      dailyProgress: {}, weeklyProgress: {},
      achievements: {},
      lastDailyReset: '', lastWeeklyReset: '',
    },
    mercenaries: [],
    expedition: {
      activeExpeditions: [],
      expeditionHistory: [],
      staminaTickCounter: 0,
    },
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
    this.enhancement = null; // EnhancementSystem 인스턴스
    this.market = null; // MarketSystem 인스턴스
    this.codex = null; // CodexSystem 인스턴스
    this.missions = null; // MissionSystem 인스턴스
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
    this.initEnhancementSystem();
    this.initMarketSystem();
    this.initCodexSystem();
    this.initMissionSystem();
    this.initExpeditionSystem();
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
        const uid = this.state.equippedGear.weapon;
        if (!uid) return null;
        const eq = this.getEquipmentByUid(uid);
        return eq ? EQUIPMENT[eq.baseId] : null;
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
      if (data.reason === 'victory') {
        this.state.stats.monstersKilled++;

        // 도감 등록
        if (this.codex && data.monsterId) {
          this.codex.discoverMonster(data.monsterId);
        }
      }
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

  // ---- 강화 시스템 초기화 (콜백 브릿지) ----
  initEnhancementSystem() {
    this.enhancement = new EnhancementSystem({
      getPlayerGold: () => this.state.player.gold,
      consumeGold: (amt) => {
        if (this.state.player.gold < amt) return false;
        this.state.player.gold -= amt;
        return true;
      },
      hasItem: (id, amt) => this.hasItem(id, amt),
      removeItem: (id, amt) => this.removeItem(id, amt),
      getEquipmentInstance: (uid) => this.getEquipmentByUid(uid),
      updateEquipmentInstance: (uid, data) => {
        const idx = this.state.equipment.findIndex(e => e.uid === uid);
        if (idx >= 0) {
          this.state.equipment[idx] = data;
        }
      },
      destroyEquipmentInstance: (uid) => {
        // 장착 해제
        for (const [slot, eqUid] of Object.entries(this.state.equippedGear)) {
          if (eqUid === uid) {
            this.state.equippedGear[slot] = null;
          }
        }
        // 일꾼 장비 해제
        for (const w of this.state.workers) {
          for (const [slot, eqUid] of Object.entries(w.equipment)) {
            if (eqUid === uid) {
              w.equipment[slot] = null;
            }
          }
        }
        // 장비 제거
        this.state.equipment = this.state.equipment.filter(e => e.uid !== uid);
      },
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // EnhancementSystem 이벤트 → GameEngine 이벤트 전달
    this.enhancement.on('toast', (t) => this.emit('toast', t));
    this.enhancement.on('enhanceSuccess', (data) => {
      this.recalcPlayerStats();
      this.emit('stateChanged', this.state);
    });
    this.enhancement.on('enhanceFail', (data) => {
      this.recalcPlayerStats();
      this.emit('stateChanged', this.state);
    });
  }

  // ---- 시장 시스템 초기화 (콜백 브릿지) ----
  initMarketSystem() {
    this.market = new MarketSystem({
      getPlayerGold: () => this.state.player.gold,
      consumeGold: (amt) => {
        if (this.state.player.gold < amt) return false;
        this.state.player.gold -= amt;
        return true;
      },
      addGold: (amt) => {
        this.state.player.gold += amt;
        this.state.stats.totalGoldEarned += amt;
      },
      hasItem: (id, amt) => this.hasItem(id, amt),
      removeItem: (id, amt) => this.removeItem(id, amt),
      addItem: (id, amt) => this.addItem(id, amt),
      getItemName: (id) => this.getItemName(id),
      getItemIcon: (id) => RESOURCES[id]?.icon || '',
      getItemCount: (id) => this.getItemCount(id),
      getMaxResourceTier: () => {
        let maxTier = 1;
        for (const zId of this.state.unlockedZones) {
          const zone = ZONES[zId];
          if (zone && (zone.tier || 1) > maxTier) maxTier = zone.tier || 1;
        }
        return maxTier;
      },
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // 기존 state.market에서 복원
    if (this.state.market) {
      this.market.setState(this.state.market);
    }
    this.market.init();

    // MarketSystem 이벤트 → GameEngine 이벤트 전달
    this.market.on('toast', (t) => this.emit('toast', t));
    this.market.on('marketUpdate', (data) => {
      this.state.market = this.market.getState();
      this.emit('stateChanged', this.state);
    });
  }

  // ---- 도감 시스템 초기화 (콜백 브릿지) ----
  initCodexSystem() {
    this.codex = new CodexSystem({
      addPermanentBonus: (key, amount) => {
        if (!this.state.permanentBonuses[key]) {
          this.state.permanentBonuses[key] = 0;
        }
        this.state.permanentBonuses[key] += amount;
      },
      grantItem: (itemId, amount) => this.addItem(itemId, amount),
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // 기존 state.codex에서 복원
    if (this.state.codex) {
      this.codex.setState(this.state.codex);
    }

    // CodexSystem 이벤트 → GameEngine 이벤트 전달
    this.codex.on('toast', (t) => this.emit('toast', t));
    this.codex.on('milestoneUnlocked', (data) => {
      this.recalcPlayerStats();
      this.emit('stateChanged', this.state);
    });
  }

  // ---- 미션 시스템 초기화 (콜백 브릿지) ----
  initMissionSystem() {
    this.missions = new MissionSystem({
      getStats: () => ({ ...this.state.stats }),
      getLevel: () => this.state.player.level,
      getWorkerCount: () => this.state.workers.length,
      getCodexPercentage: () => this.codex ? this.codex.getTotalProgress().percentage : 0,
      getMaxEnhancement: () => {
        let max = 0;
        for (const eq of this.state.equipment) {
          if ((eq.enhancement || 0) > max) max = eq.enhancement;
        }
        return max;
      },
      getDeaths: () => this.state.player.deaths,
      addGold: (amt) => {
        this.state.player.gold += amt;
        this.state.stats.totalGoldEarned += amt;
      },
      addExp: (amt) => this.gainExp(amt),
      addLegacyPoints: (amt) => { this.state.player.legacyPoints += amt; },
      grantItem: (itemId, amount) => this.addItem(itemId, amount),
      addPermanentBonus: (key, amount) => {
        if (!this.state.permanentBonuses[key]) {
          this.state.permanentBonuses[key] = 0;
        }
        this.state.permanentBonuses[key] += amount;
      },
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // 기존 state.missions에서 복원
    if (this.state.missions) {
      this.missions.setState(this.state.missions);
    }

    // MissionSystem 이벤트 → GameEngine 이벤트 전달
    this.missions.on('toast', (t) => this.emit('toast', t));
    this.missions.on('achievementUnlocked', (data) => {
      this.recalcPlayerStats();
      this.emit('stateChanged', this.state);
    });
  }

  // ---- 원정 시스템 초기화 (콜백 브릿지) ----
  initExpeditionSystem() {
    this.expedition = new ExpeditionSystem({
      getMercenary: (id) => this.state.mercenaries.find(m => m.id === id),
      getAllMercenaries: () => this.state.mercenaries,
      updateMercenary: (id, data) => {
        const idx = this.state.mercenaries.findIndex(m => m.id === id);
        if (idx >= 0) Object.assign(this.state.mercenaries[idx], data);
      },
      getMercCombatPower: (merc) => this.getMercenaryCombatPower(merc),
      addLoot: (items) => {
        for (const item of items) this.addItem(item.id, item.amount);
      },
      addGold: (amt) => {
        this.state.player.gold += amt;
        this.state.stats.totalGoldEarned += amt;
      },
      addMercExp: (mercId, amount) => this.gainMercExp(mercId, amount),
      getItemName: (id) => RESOURCES[id]?.name || id,
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    // 기존 state.expedition에서 복원
    if (this.state.expedition) {
      this.expedition.setState(this.state.expedition);
    }

    // ExpeditionSystem 이벤트 → GameEngine 이벤트 전달
    this.expedition.on('toast', (t) => this.emit('toast', t));
    this.expedition.on('expeditionComplete', (data) => {
      // 도감 등록
      if (this.codex && data.totalLoot) {
        for (const [resId] of Object.entries(data.totalLoot)) {
          this.codex.discoverResource(resId, 0);
        }
      }
      this.emit('stateChanged', this.state);
    });
  }

  // ---- 용병 고용 ----
  hireMercenary(type) {
    const cost = MERCENARY_HIRE_COSTS[type];
    if (!cost) return;
    if (this.state.player.gold < cost) {
      this.emit('toast', { msg: `골드가 부족합니다! (${cost}G 필요)`, type: 'error' });
      return;
    }
    this.state.player.gold -= cost;
    const mType = MERCENARY_TYPES[type];
    const names = MERCENARY_NAMES[type];
    const merc = {
      id: uid(),
      name: names[rand(0, names.length - 1)],
      type,
      level: 1,
      exp: 0,
      stats: { ...mType.baseStats },
      equipment: { weapon: null, armor: null },
      stamina: EXPEDITION_CONFIG.maxStamina,
      maxStamina: EXPEDITION_CONFIG.maxStamina,
      status: 'idle',
      recoverUntil: 0,
      expeditionCount: 0,
      totalKills: 0,
    };
    // 스탯 랜덤 보정 ±3
    for (const k of Object.keys(merc.stats)) {
      merc.stats[k] += rand(-3, 3);
      merc.stats[k] = Math.max(1, merc.stats[k]);
    }
    this.state.mercenaries.push(merc);
    this.emit('toast', { msg: `${merc.name} 고용! (${mType.name})`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  // ---- 용병 장비 장착 (무기/방어구만) ----
  equipMercenary(mercId, equipmentUid) {
    const merc = this.state.mercenaries.find(m => m.id === mercId);
    if (!merc) return;
    const eqInstance = this.getEquipmentByUid(equipmentUid);
    if (!eqInstance) return;
    const base = EQUIPMENT[eqInstance.baseId];
    if (!base) return;
    const slot = base.slot;
    if (slot !== 'weapon' && slot !== 'armor') {
      this.emit('toast', { msg: '용병은 무기와 방어구만 장착 가능합니다.', type: 'error' });
      return;
    }
    // 같은 장비면 해제
    if (merc.equipment[slot] === equipmentUid) {
      merc.equipment[slot] = null;
      this.emit('toast', { msg: '장비 해제', type: 'info' });
    } else {
      // 다른 곳에서 해제
      for (const m of this.state.mercenaries) {
        if (m.equipment[slot] === equipmentUid) m.equipment[slot] = null;
      }
      for (const w of this.state.workers) {
        for (const s of Object.keys(w.equipment)) {
          if (w.equipment[s] === equipmentUid) w.equipment[s] = null;
        }
      }
      if (this.state.equippedGear[slot] === equipmentUid) {
        this.state.equippedGear[slot] = null;
      }
      merc.equipment[slot] = equipmentUid;
      const displayName = this.enhancement ? this.enhancement.formatEquipmentName(eqInstance) : eqInstance.name;
      this.emit('toast', { msg: `${merc.name}에게 ${displayName} 장착!`, type: 'success' });
    }
    this.emit('stateChanged', this.state);
  }

  // ---- 용병 전투력 계산 ----
  getMercenaryCombatPower(merc) {
    let power = merc.stats.str * 2 + merc.stats.dex + merc.stats.int * 0.5 + merc.stats.vit;
    power += merc.level * 3;
    for (const eqUid of Object.values(merc.equipment)) {
      if (eqUid) {
        const stats = this.getEnhancedEquipmentStats(eqUid);
        if (stats.attack) power += stats.attack;
        if (stats.defense) power += stats.defense * 0.5;
        if (stats.hp) power += stats.hp * 0.3;
      }
    }
    return power;
  }

  // ---- 용병 경험치/레벨업 ----
  gainMercExp(mercId, amount) {
    const merc = this.state.mercenaries.find(m => m.id === mercId);
    if (!merc) return;
    merc.exp += amount;
    while (merc.level < 30 && merc.exp >= merc.level * 30) {
      merc.exp -= merc.level * 30;
      merc.level++;
      const statKeys = Object.keys(merc.stats);
      for (let i = 0; i < 2; i++) {
        const key = statKeys[rand(0, statKeys.length - 1)];
        merc.stats[key] += 1;
      }
      this.emit('toast', { msg: `${merc.name} 레벨 ${merc.level} 달성!`, type: 'success' });
    }
  }

  // ---- 용병 스태미나 음식 사용 ----
  feedMercenaryStamina(mercId, foodId) {
    const merc = this.state.mercenaries.find(m => m.id === mercId);
    if (!merc) return;
    const foodDef = MERC_STAMINA_FOOD.find(f => f.id === foodId);
    if (!foodDef) return;
    if (!this.hasItem(foodId, 1)) {
      this.emit('toast', { msg: '음식이 없습니다!', type: 'error' });
      return;
    }
    this.removeItem(foodId, 1);
    merc.stamina = Math.min(merc.maxStamina, merc.stamina + foodDef.stamina);
    this.emit('toast', { msg: `${merc.name}에게 ${foodDef.name} 사용! 스태미나 +${foodDef.stamina}`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  // ---- 원정 파견 위임 ----
  dispatchExpedition(mercId, zoneId) {
    return this.expedition ? this.expedition.dispatch(mercId, zoneId) : { success: false };
  }
  getExpeditionSnapshot() {
    return this.expedition ? this.expedition.getSnapshot() : { activeExpeditions: [], history: [] };
  }

  // ---- 저장/불러오기 ----
  saveState() {
    this.state.lastSave = Date.now();
    // MarketSystem 상태 동기화
    if (this.market) {
      this.state.market = this.market.getState();
    }
    // CodexSystem 상태 동기화
    if (this.codex) {
      this.state.codex = this.codex.getState();
    }
    // MissionSystem 상태 동기화
    if (this.missions) {
      this.state.missions = this.missions.getState();
    }
    // ExpeditionSystem 상태 동기화
    if (this.expedition) {
      this.state.expedition = this.expedition.getState();
    }
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

      // ===== Migration: 장비 구조 변경 (string[] → object[]) =====
      if (state.equipment && state.equipment.length > 0 && typeof state.equipment[0] === 'string') {
        console.log('[Migration] 장비 데이터 구조 변환 중...');
        const oldEquipment = state.equipment;
        const newEquipment = [];
        const uidMap = {}; // oldId → uid 매핑

        // 장비 인스턴스 생성
        for (const baseId of oldEquipment) {
          const newUid = uid();
          newEquipment.push({
            uid: newUid,
            baseId: baseId,
            enhancement: 0,
            name: EQUIPMENT[baseId] ? EQUIPMENT[baseId].name : baseId,
          });
          // 첫 번째 등장만 매핑 (나중에 나온건 별도 인스턴스)
          if (!uidMap[baseId]) {
            uidMap[baseId] = newUid;
          }
        }

        state.equipment = newEquipment;

        // equippedGear 변환
        for (const [slot, oldId] of Object.entries(state.equippedGear)) {
          if (oldId && uidMap[oldId]) {
            state.equippedGear[slot] = uidMap[oldId];
            // 사용된 uid는 매핑에서 제거 (다음 slot은 다른 인스턴스 사용)
            delete uidMap[oldId];
          }
        }

        // workers 장비 변환
        for (const worker of state.workers || []) {
          if (worker.equipment) {
            for (const [slot, oldId] of Object.entries(worker.equipment)) {
              if (oldId && uidMap[oldId]) {
                worker.equipment[slot] = uidMap[oldId];
                delete uidMap[oldId];
              } else if (oldId) {
                // 매핑 없으면 첫 번째 일치하는 인스턴스 찾기
                const found = newEquipment.find(e => e.baseId === oldId && !Object.values(state.equippedGear).includes(e.uid));
                if (found) {
                  worker.equipment[slot] = found.uid;
                } else {
                  worker.equipment[slot] = null;
                }
              }
            }
          }
        }

        console.log('[Migration] 장비 데이터 구조 변환 완료!');
      }

      // ===== Migration: 일꾼 유지비 필드 =====
      for (const w of state.workers || []) {
        if (w.hunger === undefined) w.hunger = 100;
        if (w.toolDurability === undefined) w.toolDurability = 500;
        if (w.maxToolDurability === undefined) w.maxToolDurability = 500;
      }
      if (!state.workerMaintenance) state.workerMaintenance = { autoFeed: true, autoRepair: true };

      // ===== Migration: 용병/원정 시스템 =====
      if (!state.mercenaries) state.mercenaries = [];
      if (!state.expedition) state.expedition = { activeExpeditions: [], expeditionHistory: [], staminaTickCounter: 0 };

      return state;
    } catch { return null; }
  }
  resetGame() {
    localStorage.removeItem('tacgame_save');
    this.state = createDefaultState();
    this.initMarket();
    this.initExpeditionSystem();
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

    // 일꾼 유지비 체크 (360틱 = 6분마다)
    if (s.tickCount % 360 === 0 && s.workers.length > 0) {
      this.workerMaintenanceTick();
    }

    // 시장 가격 변동 (60초마다)
    if (s.tickCount % 60 === 0 && this.market) {
      this.market.updatePrices();
    }

    // 투자 결과 체크 (매 tick)
    if (this.market) {
      this.market.checkInvestments();
    }
    // 상인 의뢰 체크 (60틱마다)
    if (s.tickCount % 60 === 0 && this.market) {
      this.market.checkMerchantQuests();
    }

    // 미션 진행도 업데이트 (5초마다)
    if (s.tickCount % 5 === 0 && this.missions) {
      this.missions.update(s);
    }

    // 원정 시스템 업데이트 (매 틱)
    if (this.expedition) {
      this.expedition.update();
    }

    // 쿨다운
    if (this.gatherCooldown > 0) this.gatherCooldown--;

    // 자동저장 (30초)
    if (s.tickCount % 30 === 0) this.saveState();

    this.emit('tick', s);
  }

  // ---- 장비 Helper 함수 ----
  getEquipmentByUid(uid) {
    return this.state.equipment.find(e => e.uid === uid);
  }

  getEquipmentBaseData(uid) {
    const eq = this.getEquipmentByUid(uid);
    if (!eq) return null;
    return EQUIPMENT[eq.baseId];
  }

  // 강화 보너스가 적용된 장비 스탯 계산
  getEnhancedEquipmentStats(uid) {
    const eq = this.getEquipmentByUid(uid);
    if (!eq) return {};
    const base = EQUIPMENT[eq.baseId];
    if (!base) return {};

    const enhanceLevel = eq.enhancement || 0;
    const bonus = this.enhancement.getEnhancementBonus(enhanceLevel);

    const enhanced = { ...base.stats };
    for (const [key, value] of Object.entries(enhanced)) {
      if (typeof value === 'number') {
        enhanced[key] = Math.floor(value * bonus);
      }
    }

    return enhanced;
  }

  // ---- 플레이어 스탯 계산 ----
  getPlayerStats() {
    const s = this.state;
    const base = { attack: s.player.attack, defense: s.player.defense, speed: s.player.speed, luck: s.player.luck, hp: s.player.maxHp };
    // 장비 보너스 (강화 보너스 포함)
    for (const uid of Object.values(s.equippedGear)) {
      if (uid) {
        const stats = this.getEnhancedEquipmentStats(uid);
        if (stats.attack) base.attack += stats.attack;
        if (stats.defense) base.defense += stats.defense;
        if (stats.speed) base.speed += stats.speed;
        if (stats.luck) base.luck += stats.luck;
        if (stats.hp) base.hp += stats.hp;
        if (stats.crit) base.crit = (base.crit || 0) + stats.crit;
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
    for (const uid of Object.values(s.equippedGear)) {
      if (uid) {
        const eq = this.getEquipmentByUid(uid);
        const base = eq ? EQUIPMENT[eq.baseId] : null;
        if (base && base.resistances) {
          // 저항은 강화 보너스 미적용 (기본값 유지)
          for (const [k, v] of Object.entries(base.resistances)) {
            resist[k] = (resist[k] || 0) + v;
          }
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

    // 도감 등록
    if (this.codex && RESOURCES[itemId]) {
      this.codex.discoverResource(itemId, amount);
    }
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
  addEquipment(baseId) {
    // 개별 인스턴스 생성
    const equipment = {
      uid: uid(),
      baseId: baseId,
      enhancement: 0,
      name: EQUIPMENT[baseId] ? EQUIPMENT[baseId].name : baseId,
    };
    this.state.equipment.push(equipment);

    // 도감 등록
    if (this.codex && EQUIPMENT[baseId]) {
      this.codex.discoverEquipment(baseId);
    }

    return equipment.uid;
  }

  equipItem(uid) {
    const eq = this.getEquipmentByUid(uid);
    if (!eq) return;
    const base = EQUIPMENT[eq.baseId];
    if (!base) return;

    const slot = base.slot;
    // 기존 장비 해제
    if (this.state.equippedGear[slot]) {
      // 이미 같은 거면 해제만
      if (this.state.equippedGear[slot] === uid) {
        this.state.equippedGear[slot] = null;
        this.recalcPlayerStats();
        const displayName = this.enhancement.formatEquipmentName(eq);
        this.emit('toast', { msg: `${displayName} 해제`, type: 'info' });
        this.emit('stateChanged', this.state);
        return;
      }
    }
    this.state.equippedGear[slot] = uid;
    this.recalcPlayerStats();
    const displayName = this.enhancement.formatEquipmentName(eq);
    this.emit('toast', { msg: `${displayName} 장착!`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  recalcPlayerStats() {
    const stats = this.getPlayerStats();
    this.state.player.maxHp = stats.hp;
    if (this.state.player.hp > stats.hp) this.state.player.hp = stats.hp;
  }

  // ---- 부산물 체크 ----
  checkByproduct(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return null;
    for (const rule of BYPRODUCT_RULES) {
      let matches = false;
      if (rule.recipeIds && rule.recipeIds.includes(recipeId)) matches = true;
      if (rule.recipeType && rule.recipeType === recipe.type) matches = true;
      if (matches && Math.random() < rule.chance) {
        return { id: rule.byproduct, amount: rule.amount || 1 };
      }
    }
    return null;
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
      this.addEquipment(recipe.result); // 개별 인스턴스 생성
      this.emit('toast', { msg: `${recipe.name} 제작 완료!`, type: 'success' });
    } else {
      this.addItem(recipe.result, recipe.amount);
      this.emit('toast', { msg: `${recipe.name} x${recipe.amount} 제작 완료!`, type: 'success' });
    }
    this.state.stats.itemsCrafted++;
    const bp = this.checkByproduct(recipeId);
    if (bp) {
      this.addItem(bp.id, bp.amount);
      this.emit('toast', { msg: `부산물: ${this.getItemName(bp.id)} x${bp.amount}`, type: 'info' });
    }
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
      // 장비는 개별 인스턴스 생성
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
    // 부산물 생성
    let bpTotals = {};
    for (let i = 0; i < actualCount; i++) {
      const bp = this.checkByproduct(recipeId);
      if (bp) {
        this.addItem(bp.id, bp.amount);
        bpTotals[bp.id] = (bpTotals[bp.id] || 0) + bp.amount;
      }
    }
    if (Object.keys(bpTotals).length > 0) {
      const text = Object.entries(bpTotals).map(([id, amt]) => `${this.getItemName(id)} x${amt}`).join(', ');
      this.emit('toast', { msg: `부산물: ${text}`, type: 'info' });
    }
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
      hunger: 100,
      toolDurability: 500,
      maxToolDurability: 500,
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

  equipWorker(workerId, uid) {
    const worker = this.state.workers.find(w => w.id === workerId);
    if (!worker) return;
    const eqInstance = this.getEquipmentByUid(uid);
    if (!eqInstance) return;
    const eq = EQUIPMENT[eqInstance.baseId];
    if (!eq) return;

    const slot = eq.slot;
    const displayName = this.enhancement.formatEquipmentName(eqInstance);

    // 기존 장비 해제
    if (worker.equipment[slot] === uid) {
      worker.equipment[slot] = null;
      this.emit('toast', { msg: `${worker.name}의 ${displayName} 해제`, type: 'info' });
    } else {
      // 다른 일꾼이 끼고 있는지 체크
      for (const w of this.state.workers) {
        if (w.equipment[slot] === uid) {
          w.equipment[slot] = null;
        }
      }
      // 플레이어가 끼고 있으면 해제
      if (this.state.equippedGear[slot] === uid) {
        this.state.equippedGear[slot] = null;
      }
      worker.equipment[slot] = uid;
      this.emit('toast', { msg: `${worker.name}에게 ${displayName} 장착!`, type: 'success' });
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

    // 도구 보너스 (강화 보너스 포함)
    if (worker.equipment.tool) {
      const toolStats = this.getEnhancedEquipmentStats(worker.equipment.tool);
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

    // 유지비 페널티
    if (worker.hunger !== undefined && worker.hunger <= 0) eff *= 0.5;
    if (worker.toolDurability !== undefined && worker.toolDurability <= 0) eff *= 0.5;

    return eff;
  }

  getWorkerResistance(worker, type) {
    let resist = 0;
    for (const uid of Object.values(worker.equipment)) {
      if (uid) {
        const eq = this.getEquipmentByUid(uid);
        const base = eq ? EQUIPMENT[eq.baseId] : null;
        if (base && base.resistances) {
          resist += (base.resistances[type] || 0);
        }
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
          // 도구 내구도 감소
          if (worker.toolDurability !== undefined && worker.toolDurability > 0) {
            worker.toolDurability--;
          }
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

  // ---- 일꾼 유지비 ----
  feedWorker(worker) {
    const foodPriority = WORKER_FOOD_TABLE.map(f => f.id);
    for (const foodId of foodPriority) {
      const foodDef = WORKER_FOOD_TABLE.find(f => f.id === foodId);
      if (!foodDef) continue;
      if (this.hasItem(foodId, 1)) {
        this.removeItem(foodId, 1);
        worker.hunger = Math.min(100, worker.hunger + foodDef.hunger);
        return true;
      }
    }
    return false;
  }

  repairWorkerTool(worker) {
    if (this.hasItem('repair_kit', 1)) {
      this.removeItem('repair_kit', 1);
      worker.toolDurability = worker.maxToolDurability || 500;
      return true;
    }
    return false;
  }

  workerMaintenanceTick() {
    const s = this.state;
    const maint = s.workerMaintenance || { autoFeed: true, autoRepair: true };
    let hungryCount = 0;
    let brokenCount = 0;

    for (const worker of s.workers) {
      if (!worker.deployedZone) continue;
      if (worker.hunger === undefined) { worker.hunger = 100; worker.toolDurability = 500; worker.maxToolDurability = 500; }

      // 배고픔 감소 (360틱마다 5 감소 → 7200틱=2시간에 100→0)
      worker.hunger = Math.max(0, worker.hunger - 5);

      // 자동 급식
      if (worker.hunger < 50 && maint.autoFeed) {
        this.feedWorker(worker);
      }

      // 자동 수리
      if (worker.toolDurability <= 0 && maint.autoRepair) {
        this.repairWorkerTool(worker);
      }

      if (worker.hunger <= 0) hungryCount++;
      if (worker.toolDurability <= 0) brokenCount++;
    }

    // 경고
    if (hungryCount > 0) {
      const totalFood = WORKER_FOOD_TABLE.reduce((sum, f) => sum + (s.inventory[f.id] || 0), 0);
      if (totalFood === 0) {
        this.emit('toast', { msg: `⚠️ 일꾼 ${hungryCount}명이 배고픕니다! 식량이 없습니다!`, type: 'warning' });
      }
    }
    if (brokenCount > 0) {
      if (!this.hasItem('repair_kit', 1)) {
        this.emit('toast', { msg: `⚠️ 일꾼 ${brokenCount}명의 도구가 파손됐습니다! 수리 도구가 없습니다!`, type: 'warning' });
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
  // ---- 시장 (MarketSystem에 위임) ----
  buyFromMarket(itemId, quantity) {
    if (this.market) {
      this.market.buy(itemId, quantity);
    }
  }

  sellToMarket(itemId, quantity) {
    if (this.market) {
      this.market.sell(itemId, quantity);
    }
  }

  investInMarket(itemId, amount, predictedTrend) {
    if (this.market) {
      return this.market.invest(itemId, amount, predictedTrend);
    }
    return { success: false };
  }

  getMarketPrice(itemId) {
    return this.market ? this.market.getPrice(itemId) : 0;
  }

  getMarketTrend(itemId) {
    return this.market ? this.market.getTrend(itemId) : 0;
  }

  getDailyPurchased(itemId) {
    return this.market ? this.market.getDailyPurchased(itemId) : 0;
  }

  getDailyRemaining(itemId) {
    return this.market ? this.market.getDailyRemaining(itemId) : 0;
  }

  getActiveInvestments() {
    return this.market ? this.market.getActiveInvestments() : [];
  }

  getMerchantQuests() {
    return this.market ? this.market.getMerchantQuests() : [];
  }

  completeMerchantQuest(questId) {
    return this.market ? this.market.completeMerchantQuest(questId) : { success: false };
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
    const oldMercenaries = s.mercenaries.filter(m => m.level >= 3); // 레벨 3 이상 용병 유지
    const oldStats = { ...s.stats };
    const oldCodex = this.codex ? this.codex.getState() : null;
    const oldMissions = this.missions ? this.missions.getState() : null;

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
      w.hunger = 100;
      w.toolDurability = w.maxToolDurability || 500;
    }
    this.state.mercenaries = oldMercenaries;
    for (const m of this.state.mercenaries) {
      m.status = 'idle';
      m.stamina = m.maxStamina || EXPEDITION_CONFIG.maxStamina;
      m.recoverUntil = 0;
    }
    this.state.stats = oldStats;

    // 계승 아이템 복원
    for (const item of oldVault) {
      if (item.type === 'equipment') {
        // 장비는 강화 레벨 유지
        const newUid = this.addEquipment(item.baseId);
        const eq = this.getEquipmentByUid(newUid);
        if (eq) {
          eq.enhancement = item.enhancement || 0;
        }
      } else if (RESOURCES[item.id]) {
        this.addItem(item.id, item.amount);
      }
    }
    this.state.inheritanceVault = [];

    // 영구 보너스 (사망마다 소폭 증가)
    this.state.permanentBonuses.gatherSpeed += 2;
    this.state.permanentBonuses.combatPower += 1;
    this.state.permanentBonuses.workerEfficiency += 1;
    this.state.permanentBonuses.maxHpBonus += 5;

    this.initMarketSystem();
    this.initCodexSystem();
    if (oldCodex) this.codex.setState(oldCodex);
    this.initMissionSystem();
    if (oldMissions) this.missions.setState(oldMissions);
    this.initExpeditionSystem();
    this.recalcPlayerStats();
    this.saveState();
    this.emit('toast', { msg: `부활! 레거시 포인트로 영구 보너스 강화!`, type: 'info' });
    this.emit('stateChanged', this.state);
  }

  addToVault(uid, amount) {
    const s = this.state;
    const slots = s.permanentBonuses.inheritanceSlots + Math.floor(s.player.legacyPoints / 50);
    if (s.inheritanceVault.length >= slots) {
      this.emit('toast', { msg: `계승 슬롯이 가득 찼습니다! (${slots}칸)`, type: 'error' });
      return;
    }

    // 자원인 경우
    if (RESOURCES[uid]) {
      if (!this.hasItem(uid, amount)) return;
      this.removeItem(uid, amount);
      const existing = s.inheritanceVault.find(v => v.id === uid);
      if (existing) { existing.amount += amount; }
      else { s.inheritanceVault.push({ id: uid, amount }); }
      this.emit('toast', { msg: `${this.getItemName(uid)} 계승 보관함에 추가!`, type: 'success' });
    }
    // 장비 인스턴스인 경우
    else {
      const eq = this.getEquipmentByUid(uid);
      if (!eq) return;

      // 장착 해제
      for (const [slot, eqUid] of Object.entries(s.equippedGear)) {
        if (eqUid === uid) {
          s.equippedGear[slot] = null;
        }
      }

      // 장비 제거
      s.equipment = s.equipment.filter(e => e.uid !== uid);

      // 계승 보관함에 추가 (baseId와 enhancement 정보 유지)
      s.inheritanceVault.push({
        type: 'equipment',
        baseId: eq.baseId,
        enhancement: eq.enhancement,
        amount: 1
      });

      const displayName = this.enhancement.formatEquipmentName(eq);
      this.emit('toast', { msg: `${displayName} 계승 보관함에 추가!`, type: 'success' });
    }

    this.emit('stateChanged', s);
  }

  // ---- 장비 강화 (EnhancementSystem에 위임) ----
  enhanceEquipment(uid)  { return this.enhancement.enhance(uid); }
  getEnhanceInfo(uid) {
    const eq = this.getEquipmentByUid(uid);
    if (!eq) return null;
    const currentLevel = eq.enhancement || 0;
    return {
      currentLevel,
      maxLevel: 10,
      successRate: this.enhancement.getSuccessRate(currentLevel),
      cost: this.enhancement.getEnhanceCost(currentLevel),
      material: this.enhancement.getRequiredMaterial(currentLevel),
      canEnhance: currentLevel < 10,
    };
  }

  // ---- 접근자 ----
  getState() { return this.state; }

  getCodexProgress(category) {
    return this.codex ? this.codex.getProgress(category) : { discovered: 0, total: 0, percentage: 0 };
  }

  getCodexEntry(category, id) {
    return this.codex ? this.codex.entries[category][id] : null;
  }

  getCodexMilestones() {
    return this.codex ? this.codex.getMilestones() : [];
  }

  // ---- 미션 접근자 ----
  getDailyMissions() {
    return this.missions ? this.missions.getDailyMissions() : [];
  }
  getWeeklyMissions() {
    return this.missions ? this.missions.getWeeklyMissions() : [];
  }
  getAchievements() {
    return this.missions ? this.missions.getAchievements() : [];
  }
  getAchievementStats() {
    return this.missions ? this.missions.getAchievementStats() : { total: 0, unlocked: 0, percentage: 0 };
  }
  getMissionResetTimers() {
    return this.missions ? this.missions.getResetTimers() : { daily: '--', weekly: '--' };
  }
  claimDailyMission(index) {
    return this.missions ? this.missions.claimDaily(index) : false;
  }
  claimWeeklyMission(index) {
    return this.missions ? this.missions.claimWeekly(index) : false;
  }
}
