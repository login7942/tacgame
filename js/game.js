// ============================================================
// game.js - 게임 엔진 (상태, 인벤토리, 제작, 일꾼, 시장, 생존, 탈것)
// 전투는 systems/combat.js 에 위임
// ============================================================
import { RESOURCES, EQUIPMENT, ZONES, MONSTERS, RECIPES, VEHICLES,
         WORKER_TYPES, WORKER_NAMES, HIRE_COSTS, MARKET_BASE_PRICES,
         EXP_TABLE, INHERITABLE_CATEGORIES, ENV_NAMES,
         BYPRODUCT_RULES, WORKER_FOOD_TABLE,
         MERCENARY_TYPES, MERCENARY_NAMES, MERCENARY_HIRE_COSTS,
         MERC_STAMINA_FOOD, EXPEDITION_CONFIG,
         SHRINE_CONFIG, BUFF_DEFINITIONS,
         DEFEAT_CONFIG, MASTERY_CONFIG,
         CRAFT_TIMES, DEFAULT_CRAFT_TIME } from './data.js';
import { CombatSystem } from './systems/combat.js';
import { GatheringSystem } from './systems/gathering.js';
import { EnhancementSystem } from './systems/enhancement.js';
import { MarketSystem } from './systems/market.js';
import { CodexSystem } from './systems/codex.js';
import { MissionSystem } from './systems/missions.js';
import { ExpeditionSystem } from './systems/expedition.js';
import { ShrineSystem } from './systems/shrine.js';
import { CraftingSystem } from './systems/crafting.js';
import { rand, clamp, uid } from './utils.js';

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
      defeats: 0,
      currentZone: 'plains',
      equippedVehicle: null,
    },
    inventory: { wood: 5, stone: 3, herb: 2, fiber: 3, raw_meat: 2 },
    craftQueue: null, // { recipeId, startTime, endTime }
    equipment: [], // [ equipmentId, ... ] owned equipment items
    equippedGear: { weapon: null, armor: null, tool: null, accessory: null },
    unlockedZones: ['plains'],
    workers: [], // worker objects
    vehicles: [], // owned vehicle ids
    market: { prices: {}, lastUpdate: 0, trends: {} },
    // combat 상태는 CombatSystem이 관리 (여기엔 저장용 최소 데이터만)
    permanentBonuses: {
      gatherSpeed: 0, combatPower: 0, workerEfficiency: 0,
      maxHpBonus: 0,
    },
    mastery: {
      combat: { monsters: {}, totalKills: 0, claimedMilestones: [] },
      gathering: { resources: {}, totalGathered: 0, claimedMilestones: [] },
      crafting: { recipes: {}, totalCrafted: 0, claimedMilestones: [] },
    },
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
    shrine: {
      totalOfferings: 0, totalPoints: 0,
      statPoints: { attack: 0, defense: 0, hp: 0, speed: 0, luck: 0 },
      milestones: {},
    },
    activeBuffs: [],
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
    this.shrine = null; // ShrineSystem 인스턴스
    this.crafting = null; // CraftingSystem 인스턴스
  }

  // ============================================================
  // 이벤트 시스템
  // ============================================================
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ============================================================
  // 초기화
  // ============================================================
  init() {
    this.state = this.loadState() || createDefaultState();
    this.initCombatSystem();
    this.initGatheringSystem();
    this.initEnhancementSystem();
    this.initMarketSystem();
    this.initCodexSystem();
    this.initMissionSystem();
    this.initExpeditionSystem();
    this.initShrineSystem();
    this.initCraftingSystem();
    this.startGameLoop();
    this.emit('stateChanged', this.state);
  }

  // ============================================================
  // 서브시스템 초기화 (콜백 브릿지)
  // ============================================================
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
      onDefeat: (cause) => this.defeat(cause, 'combat'),
      getMonsterMastery: (monsterId) => this.getMasteryTier((this.state.mastery.combat.monsters[monsterId] || 0)),
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

        // 숙련도 추적
        if (data.monsterId) {
          this.trackCombatMastery(data.monsterId);
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
      getDefeats: () => this.state.defeats || 0,
      getMasterySnapshot: () => this.getMasterySnapshot(),
      addGold: (amt) => {
        this.state.player.gold += amt;
        this.state.stats.totalGoldEarned += amt;
      },
      addExp: (amt) => this.gainExp(amt),
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
      // 용병 장비 내구도 감소
      if (data.mercenaryId) {
        const merc = this.state.mercenaries.find(m => m.id === data.mercenaryId);
        if (merc) {
          for (const slot of ['weapon', 'armor']) {
            const eqUid = merc.equipment[slot];
            if (eqUid) {
              const eq = this.getEquipmentByUid(eqUid);
              if (eq && eq.durability !== undefined) {
                eq.durability = Math.max(0, eq.durability - 10);
              }
            }
          }
        }
      }
      // 도감 등록
      if (this.codex && data.totalLoot) {
        for (const [resId] of Object.entries(data.totalLoot)) {
          this.codex.discoverResource(resId, 0);
        }
      }
      this.emit('stateChanged', this.state);
    });
  }

  // ---- 봉헌 시스템 초기화 (콜백 브릿지) ----
  initShrineSystem() {
    this.shrine = new ShrineSystem({
      getEquipmentInstance: (uid) => this.getEquipmentByUid(uid),
      isEquipmentEquipped: (uid) => {
        if (Object.values(this.state.equippedGear).includes(uid)) return true;
        for (const w of this.state.workers) {
          if (Object.values(w.equipment).includes(uid)) return true;
        }
        for (const m of this.state.mercenaries) {
          if (Object.values(m.equipment).includes(uid)) return true;
        }
        return false;
      },
      removeEquipment: (uid) => {
        this.state.equipment = this.state.equipment.filter(e => e.uid !== uid);
      },
      addPermanentBonus: (key, amount) => {
        if (!this.state.permanentBonuses[key]) this.state.permanentBonuses[key] = 0;
        this.state.permanentBonuses[key] += amount;
      },
      onStateChanged: () => this.emit('stateChanged', this.state),
    });

    if (this.state.shrine) {
      this.shrine.setState(this.state.shrine);
    }

    this.shrine.on('toast', (t) => this.emit('toast', t));
    this.shrine.on('milestoneUnlocked', () => {
      this.recalcPlayerStats();
      this.emit('stateChanged', this.state);
    });
  }

  initCraftingSystem() {
    this.crafting = new CraftingSystem({
      getState: () => this.state,
      canCraft: (recipeId) => this.canCraft(recipeId),
      consumeIngredients: (recipe) => {
        let maxEnhancement = 0;
        for (const ing of recipe.ingredients) {
          if (ing.type === 'equipment') {
            const eqInstances = this.findAvailableEquipmentForCraft(ing.id, ing.amount);
            for (const eq of eqInstances) {
              if ((eq.enhancement || 0) > maxEnhancement) {
                maxEnhancement = eq.enhancement || 0;
              }
              this.state.equipment = this.state.equipment.filter(e => e.uid !== eq.uid);
            }
          } else {
            this.removeItem(ing.id, ing.amount);
          }
        }
        return maxEnhancement;
      },
      refundIngredients: (recipe) => {
        for (const ing of recipe.ingredients) {
          if (ing.type === 'equipment') {
            for (let i = 0; i < ing.amount; i++) {
              this.addEquipment(ing.id);
            }
          } else {
            this.addItem(ing.id, ing.amount);
          }
        }
      },
      addEquipment: (id) => this.addEquipment(id),
      addItem: (id, amount) => this.addItem(id, amount),
      setEquipmentEnhancement: (uid, level) => {
        const eq = this.getEquipmentByUid(uid);
        if (eq) eq.enhancement = level;
      },
      getEquipmentEnhancement: (uid) => {
        const eq = this.getEquipmentByUid(uid);
        return eq ? (eq.enhancement || 0) : 0;
      },
      getCraftMastery: (recipeId) => {
        return this.state.mastery.crafting.recipes[recipeId] || 0;
      },
      getMasteryTier: (mastery) => this.getMasteryTier(mastery),
      incrementCraftStats: (recipeId) => {
        this.state.stats.itemsCrafted++;
        this.trackCraftMastery(recipeId);
      },
      showToast: (msg, type) => this.emit('toast', { msg, type }),
      onStateChanged: () => this.emit('stateChanged', this.state),
    });
  }

  // ---- 봉헌 위임 ----
  offerToShrine(equipmentUid, targetStat) {
    return this.shrine ? this.shrine.offer(equipmentUid, targetStat) : { success: false };
  }
  getShrineSnapshot() {
    return this.shrine ? this.shrine.getSnapshot() : null;
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

  // ---- 버프 시스템 ----
  useBuff(itemId) {
    const buffDef = BUFF_DEFINITIONS[itemId];
    if (!buffDef) return;
    if (!this.hasItem(itemId, 1)) {
      this.emit('toast', { msg: '아이템이 부족합니다!', type: 'error' });
      return;
    }
    // 같은 종류 버프 중복 불가 (기존 갱신)
    this.state.activeBuffs = this.state.activeBuffs.filter(b => b.id !== itemId);
    this.removeItem(itemId, 1);
    this.state.activeBuffs.push({
      id: itemId,
      name: buffDef.name,
      stat: buffDef.stat,
      value: buffDef.value,
      ticksRemaining: buffDef.duration,
      icon: buffDef.icon,
      isPercent: buffDef.isPercent || false,
    });
    const min = Math.floor(buffDef.duration / 60);
    this.emit('toast', { msg: `${buffDef.icon} ${buffDef.name} 활성화! (${min}분)`, type: 'success' });
    this.recalcPlayerStats();
    this.emit('stateChanged', this.state);
  }

  tickBuffs() {
    if (!this.state.activeBuffs || this.state.activeBuffs.length === 0) return;
    let expired = false;
    for (const buff of this.state.activeBuffs) {
      buff.ticksRemaining--;
      if (buff.ticksRemaining <= 0) expired = true;
    }
    if (expired) {
      const removed = this.state.activeBuffs.filter(b => b.ticksRemaining <= 0);
      this.state.activeBuffs = this.state.activeBuffs.filter(b => b.ticksRemaining > 0);
      for (const b of removed) {
        this.emit('toast', { msg: `${b.icon} ${b.name} 효과가 종료되었습니다.`, type: 'info' });
      }
      this.recalcPlayerStats();
    }
  }

  // ---- 장비 수리 (일꾼/용병 장비) ----
  repairEquipment(equipmentUid) {
    const eq = this.getEquipmentByUid(equipmentUid);
    if (!eq) return;
    if (eq.durability === undefined || eq.durability >= (eq.maxDurability || 0)) {
      this.emit('toast', { msg: '수리가 필요 없습니다.', type: 'info' });
      return;
    }
    const repairCost = Math.max(1, Math.floor((eq.maxDurability - eq.durability) * 0.5));
    if (!this.hasItem('repair_kit', 1)) {
      this.emit('toast', { msg: '수리 도구가 필요합니다!', type: 'error' });
      return;
    }
    if (this.state.player.gold < repairCost) {
      this.emit('toast', { msg: `골드가 부족합니다! (${repairCost}G 필요)`, type: 'error' });
      return;
    }
    this.removeItem('repair_kit', 1);
    this.state.player.gold -= repairCost;
    eq.durability = eq.maxDurability;
    const base = EQUIPMENT[eq.baseId];
    const name = base ? base.name : eq.baseId;
    this.emit('toast', { msg: `${name} 수리 완료! (-${repairCost}G, 수리 도구 -1)`, type: 'success' });
    this.emit('stateChanged', this.state);
  }

  // ============================================================
  // 저장/불러오기
  // ============================================================
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
    // ShrineSystem 상태 동기화
    if (this.shrine) {
      this.state.shrine = this.shrine.getState();
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

      // ===== Migration: 봉헌 시스템 =====
      if (!state.shrine) state.shrine = {
        totalOfferings: 0, totalPoints: 0,
        statPoints: { attack: 0, defense: 0, hp: 0, speed: 0, luck: 0 },
        milestones: {},
      };
      if (!state.activeBuffs) state.activeBuffs = [];

      // ===== Migration: 장비 내구도 =====
      for (const eq of (state.equipment || [])) {
        if (eq.durability === undefined) {
          const base = EQUIPMENT[eq.baseId];
          const tier = base ? (base.tier || 1) : 1;
          eq.maxDurability = tier * 100;
          eq.durability = eq.maxDurability;
        }
      }

      // ===== Migration: 패배/숙련도 시스템 =====
      if (state.player.legacyPoints !== undefined) delete state.player.legacyPoints;
      if (state.player.deaths !== undefined) delete state.player.deaths;
      if (state.inheritanceVault !== undefined) delete state.inheritanceVault;
      if (state.permanentBonuses && state.permanentBonuses.inheritanceSlots !== undefined) {
        delete state.permanentBonuses.inheritanceSlots;
      }
      if (state.defeats === undefined) state.defeats = 0;
      if (!state.mastery) {
        state.mastery = {
          combat: { monsters: {}, totalKills: 0, claimedMilestones: [] },
          gathering: { resources: {}, totalGathered: 0, claimedMilestones: [] },
          crafting: { recipes: {}, totalCrafted: 0, claimedMilestones: [] },
        };
      }

      // ===== Migration: craftQueue =====
      if (!state.craftQueue) state.craftQueue = null;

      // ===== 오프라인 제작 완료 처리 =====
      if (state.craftQueue && state.craftQueue.endTime) {
        const now = Date.now();
        if (now >= state.craftQueue.endTime) {
          // 오프라인 중 제작 완료 - 결과물만 추가하고 큐 초기화
          const q = state.craftQueue;
          const recipe = RECIPES.find(r => r.id === q.recipeId);
          if (recipe) {
            if (q.recipeType === 'equipment') {
              const newUid = uid();
              state.equipment.push({
                uid: newUid,
                baseId: q.recipeResult,
                enhancement: q.maxEnhancement > 0 ? Math.floor(q.maxEnhancement / 2) : 0,
                name: EQUIPMENT[q.recipeResult] ? EQUIPMENT[q.recipeResult].name : q.recipeResult,
                durability: EQUIPMENT[q.recipeResult] ? (EQUIPMENT[q.recipeResult].tier || 1) * 100 : 100,
                maxDurability: EQUIPMENT[q.recipeResult] ? (EQUIPMENT[q.recipeResult].tier || 1) * 100 : 100,
              });
            } else {
              if (!state.inventory[q.recipeResult]) state.inventory[q.recipeResult] = 0;
              state.inventory[q.recipeResult] += q.recipeAmount;
            }
            if (!state.mastery.crafting.recipes[q.recipeId]) state.mastery.crafting.recipes[q.recipeId] = 0;
            state.mastery.crafting.recipes[q.recipeId]++;
            state.mastery.crafting.totalCrafted++;
            state.stats.itemsCrafted++;
          }
          state.craftQueue = null;
        }
      }

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

  // ============================================================
  // 게임 루프 (500ms 틱)
  // ============================================================
  startGameLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    const s = this.state;
    s.tickCount++;

    // 배고픔 감소
    s.player.hunger = clamp(s.player.hunger - 0.15, 0, s.player.maxHunger);
    // 배고프면 HP 감소 (비활성화)
    // if (s.player.hunger <= 0) {
    //   s.player.hp = clamp(s.player.hp - 1, 0, s.player.maxHp);
    //   if (s.player.hp <= 0) {
    //     this.defeat('굶주림으로 쓰러졌습니다.', 'starvation');
    //     return;
    //   }
    // }
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
            this.defeat(`${zone.name}의 환경 피해로 쓰러졌습니다.`, 'environment');
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

    // 버프 틱다운
    this.tickBuffs();

    // 제작 시스템 업데이트
    if (this.crafting) {
      this.crafting.checkCompletion();
    }

    // 쿨다운
    if (this.gatherCooldown > 0) this.gatherCooldown--;

    // 자동저장 (30초)
    if (s.tickCount % 30 === 0) this.saveState();

    this.emit('tick', s);
  }

  // ============================================================
  // 장비 시스템
  // ============================================================
  // 장비 조회/계산
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

    // 내구도 0이면 스탯 0 (일꾼/용병 장비용)
    if (eq.durability !== undefined && eq.durability <= 0) {
      const zeroed = {};
      for (const key of Object.keys(base.stats)) zeroed[key] = 0;
      return zeroed;
    }

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

  // ============================================================
  // 플레이어 시스템 (스탯, 이동, 채집)
  // ============================================================
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

    // 봉헌 스탯 보너스
    if (this.shrine) {
      const shrineStats = this.shrine.statPoints;
      base.attack += shrineStats.attack || 0;
      base.defense += shrineStats.defense || 0;
      base.hp += shrineStats.hp || 0;
      base.speed += shrineStats.speed || 0;
      base.luck += shrineStats.luck || 0;
    }

    // 봉헌 마일스톤 퍼센트 보너스
    if (s.shrine && s.shrine.milestones) {
      if (s.shrine.milestones['30']) base.attack = Math.floor(base.attack * 1.10);
      if (s.shrine.milestones['200']) {
        base.attack = Math.floor(base.attack * 1.10);
        base.defense = Math.floor(base.defense * 1.10);
        base.hp = Math.floor(base.hp * 1.10);
        base.speed = Math.floor(base.speed * 1.10);
        base.luck = Math.floor(base.luck * 1.10);
      }
    }

    // 활성 버프 적용
    for (const buff of (s.activeBuffs || [])) {
      if (buff.stat === 'gatherSpeed') continue; // 채집 속도는 별도 처리
      if (buff.isPercent && base[buff.stat] !== undefined) {
        base[buff.stat] = Math.floor(base[buff.stat] * (1 + buff.value / 100));
      } else if (base[buff.stat] !== undefined) {
        base[buff.stat] += buff.value;
      }
    }

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
    let bonusSpeed = 1 + s.permanentBonuses.gatherSpeed * 0.01;
    // 채집 버프 적용
    for (const buff of (s.activeBuffs || [])) {
      if (buff.stat === 'gatherSpeed' && buff.isPercent) {
        bonusSpeed *= (1 + buff.value / 100);
      }
    }
    for (const resId of zone.resources) {
      // 숙련도 보너스 적용
      const resMastery = this.getMasteryTier(s.mastery.gathering.resources[resId] || 0);
      const masteryBonus = 1 + resMastery * MASTERY_CONFIG.gathering.perTierBonus.gatherChancePercent / 100;
      const rate = (zone.resourceRates[resId] || 0.5) * bonusSpeed * masteryBonus;
      if (Math.random() < rate) {
        const amount = rand(1, 3);
        this.addItem(resId, amount);
        gathered.push({ id: resId, amount });
        s.stats.resourcesGathered += amount;
        this.trackGatherMastery(resId, amount);
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

  // ============================================================
  // 인벤토리 시스템
  // ============================================================
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

  // 장비 인스턴스 생성/장착
  addEquipment(baseId) {
    // 개별 인스턴스 생성
    const base = EQUIPMENT[baseId];
    const tier = base ? (base.tier || 1) : 1;
    const maxDurability = tier * 100;
    const equipment = {
      uid: uid(),
      baseId: baseId,
      enhancement: 0,
      name: base ? base.name : baseId,
      durability: maxDurability,
      maxDurability: maxDurability,
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

  // ---- 제작 재료용 장비 인스턴스 검색 (미장착 상태만) ----
  findAvailableEquipmentForCraft(baseId, amount) {
    const found = [];
    for (const eq of this.state.equipment) {
      if (eq.baseId !== baseId) continue;
      const eqUid = eq.uid;
      if (Object.values(this.state.equippedGear).includes(eqUid)) continue;
      let equipped = false;
      for (const w of this.state.workers) {
        if (Object.values(w.equipment).includes(eqUid)) { equipped = true; break; }
      }
      if (equipped) continue;
      for (const m of this.state.mercenaries) {
        if (Object.values(m.equipment).includes(eqUid)) { equipped = true; break; }
      }
      if (equipped) continue;
      found.push(eq);
      if (found.length >= amount) return found;
    }
    return found.length >= amount ? found : null;
  }

  // ============================================================
  // 제작 시스템
  // ============================================================
  canCraft(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;
    return recipe.ingredients.every(ing => {
      if (ing.type === 'equipment') {
        return this.findAvailableEquipmentForCraft(ing.id, ing.amount) !== null;
      }
      return this.hasItem(ing.id, ing.amount);
    });
  }

  // 최대 제작 가능 수량 계산
  getMaxCraftableAmount(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return 0;

    let maxAmount = Infinity;
    for (const ing of recipe.ingredients) {
      if (ing.type === 'equipment') {
        const avail = this.findAvailableEquipmentForCraft(ing.id, ing.amount);
        if (!avail) return 0;
        maxAmount = 1; // 장비 재료가 있으면 최대 1개만
      } else {
        const available = this.getItemCount(ing.id);
        const possible = Math.floor(available / ing.amount);
        maxAmount = Math.min(maxAmount, possible);
      }
    }

    return maxAmount === Infinity ? 0 : maxAmount;
  }

  craft(recipeId) {
    // 시간 기반 제작 시스템으로 위임
    if (this.crafting) {
      this.crafting.startCraft(recipeId);
    }
  }

  // 제작 취소
  cancelCraft() {
    if (this.crafting) {
      this.crafting.cancelCraft();
    }
  }

  // 제작 진행 상황
  getCraftProgress() {
    return this.crafting ? this.crafting.getProgress() : null;
  }

  // 대량 제작
  craftMultiple(recipeId, count) {
    // 시간 기반 제작에서는 대량 제작 불가 (한 번에 1개만)
    this.emit('toast', { msg: '시간 기반 제작에서는 한 번에 1개씩만 제작할 수 있습니다.', type: 'info' });
    this.craft(recipeId);
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

  // ============================================================
  // 일꾼 시스템 (고용, 배치, 유지비)
  // ============================================================
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
          // 도구 내구도 감소 (일꾼 자체)
          if (worker.toolDurability !== undefined && worker.toolDurability > 0) {
            worker.toolDurability--;
          }
          // 장비 인스턴스 내구도 감소 (도구)
          const toolUid = worker.equipment.tool;
          if (toolUid) {
            const toolEq = this.getEquipmentByUid(toolUid);
            if (toolEq && toolEq.durability > 0) {
              toolEq.durability--;
            }
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

  // ============================================================
  // 탈것 시스템
  // ============================================================
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
  // ============================================================
  // 시장 시스템 (위임)
  // ============================================================
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

  // ============================================================
  // 패배 시스템
  // ============================================================
  defeat(cause, type = 'combat') {
    const s = this.state;
    if (this.combat) this.combat.stopAuto();
    s.defeats = (s.defeats || 0) + 1;

    const cfg = DEFEAT_CONFIG[type] || DEFEAT_CONFIG.combat;
    const penalties = [];

    // 골드 차감
    if (cfg.goldLossPercent) {
      const goldLoss = Math.floor(s.player.gold * cfg.goldLossPercent / 100);
      if (goldLoss > 0) {
        s.player.gold -= goldLoss;
        penalties.push(`💰 -${goldLoss} 골드`);
      }
    }

    // 장비 내구도 감소 (전투 패배만)
    if (cfg.durabilityLossPercent) {
      for (const eqUid of Object.values(s.equippedGear)) {
        if (!eqUid) continue;
        const eq = this.getEquipmentByUid(eqUid);
        if (eq && eq.durability !== undefined) {
          const loss = Math.floor(eq.maxDurability * cfg.durabilityLossPercent / 100);
          eq.durability = Math.max(0, eq.durability - loss);
        }
      }
      penalties.push(`🔧 장비 내구도 -${cfg.durabilityLossPercent}%`);
    }

    // 강제 퇴각 (환경 피해)
    if (cfg.forceRetreat) {
      const firstZone = Object.keys(ZONES)[0];
      if (firstZone) {
        s.currentZone = firstZone;
        penalties.push(`🗺️ ${ZONES[firstZone].name}(으)로 강제 이동`);
      }
    }

    // HP 복구
    const restoreHp = Math.floor(s.player.maxHp * (cfg.hpRestorePercent || 20) / 100);
    s.player.hp = Math.max(restoreHp, s.player.hp);
    if (s.player.hp < restoreHp) s.player.hp = restoreHp;

    // 디버프 적용 (activeBuffs 시스템 활용)
    if (cfg.debuff) {
      const d = cfg.debuff;
      // 기존 같은 이름의 디버프 제거 (갱신)
      s.activeBuffs = (s.activeBuffs || []).filter(b => b.name !== d.name);
      s.activeBuffs.push({
        name: d.name,
        icon: d.icon,
        stat: d.stat,
        value: d.value,
        isPercent: d.isPercent || false,
        ticksRemaining: d.duration,
        isDebuff: true,
      });
      const statName = { attack: '공격력', defense: '방어력', speed: '속도', gatherSpeed: '채집속도' }[d.stat] || d.stat;
      penalties.push(`${d.icon} ${d.name} (${statName} ${d.value}%, ${d.duration}초)`);
    }

    this.recalcPlayerStats();
    this.saveState();

    this.emit('defeat', {
      cause,
      type,
      penalties,
      hpRestored: restoreHp,
    });
    this.emit('stateChanged', s);
  }

  // ============================================================
  // 숙련도 시스템 (Mastery)
  // ============================================================
  getMasteryTier(count) {
    const tiers = MASTERY_CONFIG.tiers;
    let tier = 0;
    for (const t of tiers) {
      if (count >= t.threshold) tier++;
      else break;
    }
    return tier;
  }

  getMasteryLabel(count) {
    const tiers = MASTERY_CONFIG.tiers;
    let label = '';
    for (const t of tiers) {
      if (count >= t.threshold) label = t.label;
      else break;
    }
    return label;
  }

  trackCombatMastery(monsterId) {
    if (!monsterId) return;
    const m = this.state.mastery.combat;
    m.monsters[monsterId] = (m.monsters[monsterId] || 0) + 1;
    m.totalKills++;
    this.checkMasteryMilestones('combat');
  }

  trackGatherMastery(resourceId, amount) {
    if (!resourceId) return;
    const m = this.state.mastery.gathering;
    m.resources[resourceId] = (m.resources[resourceId] || 0) + (amount || 1);
    m.totalGathered += (amount || 1);
    this.checkMasteryMilestones('gathering');
  }

  trackCraftMastery(recipeId) {
    if (!recipeId) return;
    const m = this.state.mastery.crafting;
    m.recipes[recipeId] = (m.recipes[recipeId] || 0) + 1;
    m.totalCrafted++;
    this.checkMasteryMilestones('crafting');
  }

  checkMasteryMilestones(category) {
    const cfg = MASTERY_CONFIG[category];
    if (!cfg || !cfg.milestones) return;
    const m = this.state.mastery[category];
    const total = category === 'combat' ? m.totalKills
                : category === 'gathering' ? m.totalGathered
                : m.totalCrafted;
    const countKey = category === 'combat' ? 'kills' : 'count';

    for (const milestone of cfg.milestones) {
      const threshold = milestone[countKey];
      if (total >= threshold && !m.claimedMilestones.includes(threshold)) {
        m.claimedMilestones.push(threshold);
        const r = milestone.reward;
        if (r.type === 'permanentBonus') {
          this.state.permanentBonuses[r.key] = (this.state.permanentBonuses[r.key] || 0) + r.value;
          const names = { combatPower: '전투력', gatherSpeed: '채집속도', workerEfficiency: '일꾼효율', maxHpBonus: '최대HP' };
          this.emit('toast', {
            msg: `📖 숙련 마일스톤! ${names[r.key] || r.key} +${r.value}`,
            type: 'success'
          });
        }
      }
    }
  }

  getMasterySnapshot() {
    const m = this.state.mastery;
    const snapshot = { combat: {}, gathering: {}, crafting: {} };

    // 전투
    snapshot.combat.totalKills = m.combat.totalKills;
    snapshot.combat.tier = this.getMasteryTier(m.combat.totalKills);
    snapshot.combat.label = this.getMasteryLabel(m.combat.totalKills);
    snapshot.combat.monsters = {};
    for (const [id, count] of Object.entries(m.combat.monsters)) {
      snapshot.combat.monsters[id] = { count, tier: this.getMasteryTier(count), label: this.getMasteryLabel(count) };
    }
    snapshot.combat.claimedMilestones = [...m.combat.claimedMilestones];

    // 채집
    snapshot.gathering.totalGathered = m.gathering.totalGathered;
    snapshot.gathering.tier = this.getMasteryTier(m.gathering.totalGathered);
    snapshot.gathering.label = this.getMasteryLabel(m.gathering.totalGathered);
    snapshot.gathering.resources = {};
    for (const [id, count] of Object.entries(m.gathering.resources)) {
      snapshot.gathering.resources[id] = { count, tier: this.getMasteryTier(count), label: this.getMasteryLabel(count) };
    }
    snapshot.gathering.claimedMilestones = [...m.gathering.claimedMilestones];

    // 제작
    snapshot.crafting.totalCrafted = m.crafting.totalCrafted;
    snapshot.crafting.tier = this.getMasteryTier(m.crafting.totalCrafted);
    snapshot.crafting.label = this.getMasteryLabel(m.crafting.totalCrafted);
    snapshot.crafting.recipes = {};
    for (const [id, count] of Object.entries(m.crafting.recipes)) {
      snapshot.crafting.recipes[id] = { count, tier: this.getMasteryTier(count), label: this.getMasteryLabel(count) };
    }
    snapshot.crafting.claimedMilestones = [...m.crafting.claimedMilestones];

    return snapshot;
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

  // ============================================================
  // 접근자 메서드 (Getters)
  // ============================================================
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
