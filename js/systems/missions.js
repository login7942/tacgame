// ============================================================
// systems/missions.js - 일일/주간 미션 + 업적 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================

// ---- 일일 미션 풀 (매일 4개 랜덤 선택) ----
const DAILY_MISSION_POOL = [
  { id: 'daily_gather_100', name: '자원 수집가', desc: '자원 100개 채집', type: 'resourcesGathered', target: 100, reward: { gold: 500 } },
  { id: 'daily_kill_20', name: '사냥꾼', desc: '몬스터 20마리 처치', type: 'monstersKilled', target: 20, reward: { gold: 300, exp: 50 } },
  { id: 'daily_craft_5', name: '장인의 손길', desc: '아이템 5개 제작', type: 'itemsCrafted', target: 5, reward: { item: 'enhancement_stone', amount: 3 } },
  { id: 'daily_gold_1000', name: '금화 수집', desc: '골드 1000 획득', type: 'goldEarned', target: 1000, reward: { exp: 100 } },
  { id: 'daily_gather_50', name: '소소한 채집', desc: '자원 50개 채집', type: 'resourcesGathered', target: 50, reward: { gold: 200 } },
  { id: 'daily_kill_10', name: '순찰 임무', desc: '몬스터 10마리 처치', type: 'monstersKilled', target: 10, reward: { gold: 200 } },
  { id: 'daily_craft_3', name: '제작 연습', desc: '아이템 3개 제작', type: 'itemsCrafted', target: 3, reward: { gold: 300 } },
  { id: 'daily_kill_50', name: '토벌 작전', desc: '몬스터 50마리 처치', type: 'monstersKilled', target: 50, reward: { gold: 800, item: 'enhancement_stone', amount: 1 } },
];

// ---- 주간 미션 (고정 4개, 월요일 리셋) ----
const WEEKLY_MISSIONS = [
  { id: 'weekly_gather_500', name: '주간 채집 목표', desc: '자원 500개 채집', type: 'resourcesGathered', target: 500, reward: { gold: 2000, exp: 200 } },
  { id: 'weekly_kill_100', name: '주간 토벌', desc: '몬스터 100마리 처치', type: 'monstersKilled', target: 100, reward: { gold: 2000, exp: 200 } },
  { id: 'weekly_craft_20', name: '주간 제작', desc: '아이템 20개 제작', type: 'itemsCrafted', target: 20, reward: { gold: 1500, item: 'enhancement_stone', amount: 5 } },
  { id: 'weekly_gold_5000', name: '부의 축적', desc: '골드 5000 획득', type: 'goldEarned', target: 5000, reward: { gold: 1000, exp: 300 } },
];

// ---- 업적 (영구) ----
const ACHIEVEMENTS = [
  // 전투
  { id: 'ach_kill_100', name: '초보 사냥꾼', desc: '몬스터 100마리 처치', category: 'combat', type: 'totalMonstersKilled', target: 100, reward: { gold: 500 } },
  { id: 'ach_kill_1000', name: '숙련 사냥꾼', desc: '몬스터 1,000마리 처치', category: 'combat', type: 'totalMonstersKilled', target: 1000, reward: { gold: 2000, bonus: { combatPower: 2 } } },
  { id: 'ach_kill_5000', name: '전설의 사냥꾼', desc: '몬스터 5,000마리 처치', category: 'combat', type: 'totalMonstersKilled', target: 5000, reward: { gold: 5000, bonus: { combatPower: 5 } } },
  // 채집
  { id: 'ach_gather_1000', name: '부지런한 채집가', desc: '자원 1,000개 채집', category: 'gather', type: 'totalResourcesGathered', target: 1000, reward: { gold: 500 } },
  { id: 'ach_gather_10000', name: '자원왕', desc: '자원 10,000개 채집', category: 'gather', type: 'totalResourcesGathered', target: 10000, reward: { gold: 3000, bonus: { gatherSpeed: 3 } } },
  { id: 'ach_gather_50000', name: '대지의 수호자', desc: '자원 50,000개 채집', category: 'gather', type: 'totalResourcesGathered', target: 50000, reward: { gold: 10000, bonus: { gatherSpeed: 5 } } },
  // 제작
  { id: 'ach_craft_50', name: '견습 장인', desc: '아이템 50개 제작', category: 'craft', type: 'totalItemsCrafted', target: 50, reward: { gold: 500 } },
  { id: 'ach_craft_500', name: '숙련 장인', desc: '아이템 500개 제작', category: 'craft', type: 'totalItemsCrafted', target: 500, reward: { gold: 2000 } },
  { id: 'ach_craft_2000', name: '전설의 장인', desc: '아이템 2,000개 제작', category: 'craft', type: 'totalItemsCrafted', target: 2000, reward: { gold: 5000 } },
  // 경제
  { id: 'ach_gold_10000', name: '소금 장사', desc: '총 골드 10,000 획득', category: 'economy', type: 'totalGoldEarned', target: 10000, reward: { gold: 1000 } },
  { id: 'ach_gold_100000', name: '부유한 상인', desc: '총 골드 100,000 획득', category: 'economy', type: 'totalGoldEarned', target: 100000, reward: { gold: 5000, bonus: { goldBonus: 3 } } },
  { id: 'ach_gold_1000000', name: '백만장자', desc: '총 골드 1,000,000 획득', category: 'economy', type: 'totalGoldEarned', target: 1000000, reward: { gold: 10000, bonus: { goldBonus: 5 } } },
  // 레벨
  { id: 'ach_level_10', name: '성장의 첫걸음', desc: '레벨 10 달성', category: 'level', type: 'level', target: 10, reward: { gold: 500 } },
  { id: 'ach_level_25', name: '중급 모험가', desc: '레벨 25 달성', category: 'level', type: 'level', target: 25, reward: { gold: 2000 } },
  { id: 'ach_level_50', name: '최강의 생존자', desc: '레벨 50 달성', category: 'level', type: 'level', target: 50, reward: { gold: 5000, bonus: { maxHpBonus: 10 } } },
  // 일꾼
  { id: 'ach_worker_3', name: '고용주', desc: '일꾼 3명 고용', category: 'worker', type: 'workerCount', target: 3, reward: { gold: 500 } },
  { id: 'ach_worker_8', name: '기업가', desc: '일꾼 8명 고용', category: 'worker', type: 'workerCount', target: 8, reward: { gold: 2000, bonus: { workerEfficiency: 3 } } },
  // 도감
  { id: 'ach_codex_25', name: '수집가', desc: '도감 25% 완성', category: 'codex', type: 'codexPercentage', target: 25, reward: { gold: 1000 } },
  { id: 'ach_codex_50', name: '박물학자', desc: '도감 50% 완성', category: 'codex', type: 'codexPercentage', target: 50, reward: { gold: 3000 } },
  { id: 'ach_codex_100', name: '백과사전', desc: '도감 100% 완성', category: 'codex', type: 'codexPercentage', target: 100, reward: { gold: 10000, bonus: { allStats: 5 } } },
  // 숙련도
  { id: 'ach_mastery_combat_3', name: '전투 숙련자', desc: '전투 숙련 Lv.3 달성', category: 'mastery', type: 'combatMasteryTier', target: 3, reward: { gold: 1000, bonus: { combatPower: 3 } } },
  { id: 'ach_mastery_gather_3', name: '채집 숙련자', desc: '채집 숙련 Lv.3 달성', category: 'mastery', type: 'gatherMasteryTier', target: 3, reward: { gold: 1000, bonus: { gatherSpeed: 3 } } },
  { id: 'ach_mastery_craft_3', name: '제작 숙련자', desc: '제작 숙련 Lv.3 달성', category: 'mastery', type: 'craftMasteryTier', target: 3, reward: { gold: 1000, bonus: { workerEfficiency: 3 } } },
  // 강화
  { id: 'ach_enhance_5', name: '강화의 맛', desc: '+5 강화 성공', category: 'enhance', type: 'maxEnhancement', target: 5, reward: { gold: 1000, item: 'enhancement_stone', amount: 5 } },
  { id: 'ach_enhance_10', name: '강화 마스터', desc: '+10 강화 성공', category: 'enhance', type: 'maxEnhancement', target: 10, reward: { gold: 5000, bonus: { combatPower: 5 } } },
];

// ---- 유틸리티 ----
function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function getWeekId() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum}`;
}

function shuffleAndPick(arr, count) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// ---- 미션 시스템 ----
export class MissionSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getStats()           → { monstersKilled, resourcesGathered, itemsCrafted, totalGoldEarned }
   *   getLevel()           → number
   *   getWorkerCount()     → number
   *   getCodexPercentage() → number
   *   getMaxEnhancement()  → number
   *   getDefeats()         → number
   *   getMasterySnapshot() → object
   *   addGold(amount)      → void
   *   addExp(amount)       → void
   *   grantItem(id, amount)   → void
   *   addPermanentBonus(key, amount) → void
   *   onStateChanged()     → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 내부 상태
    this.dailyMissions = [];      // 선택된 일일 미션 정의 배열
    this.weeklyMissions = [];     // 주간 미션 정의 배열
    this.dailyProgress = {};      // missionId → { current, claimed }
    this.weeklyProgress = {};     // missionId → { current, claimed }
    this.achievements = {};       // achievementId → { unlocked }
    this.lastDailyReset = '';
    this.lastWeeklyReset = '';
    this.prevStats = null;        // 이전 tick의 stats 스냅샷

    // 업적 초기화
    for (const ach of ACHIEVEMENTS) {
      this.achievements[ach.id] = { unlocked: false };
    }
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 리셋 체크 ----
  checkDailyReset() {
    const today = getTodayDate();
    if (this.lastDailyReset !== today) {
      this.lastDailyReset = today;
      this.dailyMissions = shuffleAndPick(DAILY_MISSION_POOL, 4);
      this.dailyProgress = {};
      for (const m of this.dailyMissions) {
        this.dailyProgress[m.id] = { current: 0, claimed: false };
      }
      this.emit('toast', { msg: '🌅 일일 미션이 갱신되었습니다!', type: 'info' });
      return true;
    }
    return false;
  }

  checkWeeklyReset() {
    const weekId = getWeekId();
    if (this.lastWeeklyReset !== weekId) {
      this.lastWeeklyReset = weekId;
      this.weeklyMissions = [...WEEKLY_MISSIONS];
      this.weeklyProgress = {};
      for (const m of this.weeklyMissions) {
        this.weeklyProgress[m.id] = { current: 0, claimed: false };
      }
      if (this.lastWeeklyReset) {
        this.emit('toast', { msg: '📅 주간 미션이 갱신되었습니다!', type: 'info' });
      }
      return true;
    }
    return false;
  }

  // ---- 메인 업데이트 (매 tick 호출) ----
  update(state) {
    this.checkDailyReset();
    this.checkWeeklyReset();

    const stats = this.cb.getStats();

    // 스냅샷 기반 delta 계산
    if (this.prevStats) {
      const delta = {
        resourcesGathered: stats.resourcesGathered - this.prevStats.resourcesGathered,
        monstersKilled: stats.monstersKilled - this.prevStats.monstersKilled,
        itemsCrafted: stats.itemsCrafted - this.prevStats.itemsCrafted,
        goldEarned: stats.totalGoldEarned - this.prevStats.totalGoldEarned,
      };

      // 일일 미션 진행도 업데이트
      for (const m of this.dailyMissions) {
        const prog = this.dailyProgress[m.id];
        if (!prog || prog.claimed) continue;
        const d = delta[m.type] || 0;
        if (d > 0) {
          prog.current = Math.min(prog.current + d, m.target);
        }
      }

      // 주간 미션 진행도 업데이트
      for (const m of this.weeklyMissions) {
        const prog = this.weeklyProgress[m.id];
        if (!prog || prog.claimed) continue;
        const d = delta[m.type] || 0;
        if (d > 0) {
          prog.current = Math.min(prog.current + d, m.target);
        }
      }
    }

    // 스냅샷 갱신
    this.prevStats = {
      resourcesGathered: stats.resourcesGathered,
      monstersKilled: stats.monstersKilled,
      itemsCrafted: stats.itemsCrafted,
      totalGoldEarned: stats.totalGoldEarned,
    };

    // 업적 체크
    this.checkAchievements();
  }

  // ---- 업적 체크 ----
  checkAchievements() {
    const stats = this.cb.getStats();
    const level = this.cb.getLevel();
    const workerCount = this.cb.getWorkerCount();
    const codexPct = this.cb.getCodexPercentage();
    const maxEnhance = this.cb.getMaxEnhancement();
    const mastery = this.cb.getMasterySnapshot ? this.cb.getMasterySnapshot() : null;

    for (const ach of ACHIEVEMENTS) {
      if (this.achievements[ach.id]?.unlocked) continue;

      let currentValue = 0;
      switch (ach.type) {
        case 'totalMonstersKilled': currentValue = stats.monstersKilled; break;
        case 'totalResourcesGathered': currentValue = stats.resourcesGathered; break;
        case 'totalItemsCrafted': currentValue = stats.itemsCrafted; break;
        case 'totalGoldEarned': currentValue = stats.totalGoldEarned; break;
        case 'level': currentValue = level; break;
        case 'workerCount': currentValue = workerCount; break;
        case 'codexPercentage': currentValue = codexPct; break;
        case 'maxEnhancement': currentValue = maxEnhance; break;
        case 'combatMasteryTier': currentValue = mastery ? mastery.combat.tier : 0; break;
        case 'gatherMasteryTier': currentValue = mastery ? mastery.gathering.tier : 0; break;
        case 'craftMasteryTier': currentValue = mastery ? mastery.crafting.tier : 0; break;
      }

      if (currentValue >= ach.target) {
        this.unlockAchievement(ach);
      }
    }
  }

  unlockAchievement(ach) {
    this.achievements[ach.id] = { unlocked: true };
    this.grantReward(ach.reward);
    this.emit('toast', {
      msg: `🏆 업적 달성: ${ach.name}!`,
      type: 'success'
    });
    this.emit('achievementUnlocked', { id: ach.id, name: ach.name });
    this.cb.onStateChanged();
  }

  // ---- 보상 지급 ----
  grantReward(reward) {
    if (reward.gold) this.cb.addGold(reward.gold);
    if (reward.exp) this.cb.addExp(reward.exp);
    if (reward.item) this.cb.grantItem(reward.item, reward.amount || 1);
    if (reward.bonus) {
      for (const [key, amount] of Object.entries(reward.bonus)) {
        this.cb.addPermanentBonus(key, amount);
      }
    }
  }

  // ---- 보상 수령 ----
  claimDaily(index) {
    const mission = this.dailyMissions[index];
    if (!mission) return false;
    const prog = this.dailyProgress[mission.id];
    if (!prog || prog.claimed) return false;
    if (prog.current < mission.target) return false;

    prog.claimed = true;
    this.grantReward(mission.reward);
    this.emit('toast', {
      msg: `📜 일일 미션 완료: ${mission.name}`,
      type: 'success'
    });
    this.cb.onStateChanged();
    return true;
  }

  claimWeekly(index) {
    const mission = this.weeklyMissions[index];
    if (!mission) return false;
    const prog = this.weeklyProgress[mission.id];
    if (!prog || prog.claimed) return false;
    if (prog.current < mission.target) return false;

    prog.claimed = true;
    this.grantReward(mission.reward);
    this.emit('toast', {
      msg: `📜 주간 미션 완료: ${mission.name}`,
      type: 'success'
    });
    this.cb.onStateChanged();
    return true;
  }

  // ---- 조회 메서드 ----
  getDailyMissions() {
    return this.dailyMissions.map((m, i) => ({
      ...m,
      progress: this.dailyProgress[m.id] || { current: 0, claimed: false },
    }));
  }

  getWeeklyMissions() {
    return this.weeklyMissions.map((m, i) => ({
      ...m,
      progress: this.weeklyProgress[m.id] || { current: 0, claimed: false },
    }));
  }

  getAchievements() {
    const stats = this.cb.getStats();
    const level = this.cb.getLevel();
    const workerCount = this.cb.getWorkerCount();
    const codexPct = this.cb.getCodexPercentage();
    const maxEnhance = this.cb.getMaxEnhancement();
    const mastery = this.cb.getMasterySnapshot ? this.cb.getMasterySnapshot() : null;

    return ACHIEVEMENTS.map(ach => {
      let currentValue = 0;
      switch (ach.type) {
        case 'totalMonstersKilled': currentValue = stats.monstersKilled; break;
        case 'totalResourcesGathered': currentValue = stats.resourcesGathered; break;
        case 'totalItemsCrafted': currentValue = stats.itemsCrafted; break;
        case 'totalGoldEarned': currentValue = stats.totalGoldEarned; break;
        case 'level': currentValue = level; break;
        case 'workerCount': currentValue = workerCount; break;
        case 'codexPercentage': currentValue = codexPct; break;
        case 'maxEnhancement': currentValue = maxEnhance; break;
        case 'combatMasteryTier': currentValue = mastery ? mastery.combat.tier : 0; break;
        case 'gatherMasteryTier': currentValue = mastery ? mastery.gathering.tier : 0; break;
        case 'craftMasteryTier': currentValue = mastery ? mastery.crafting.tier : 0; break;
      }

      return {
        ...ach,
        currentValue,
        unlocked: this.achievements[ach.id]?.unlocked || false,
      };
    });
  }

  getAchievementStats() {
    const total = ACHIEVEMENTS.length;
    const unlocked = Object.values(this.achievements).filter(a => a.unlocked).length;
    return { total, unlocked, percentage: total > 0 ? Math.floor((unlocked / total) * 100) : 0 };
  }

  getResetTimers() {
    const now = new Date();
    // 다음 자정까지
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dailyRemaining = nextMidnight - now;

    // 다음 월요일 자정까지
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
    const weeklyRemaining = nextMonday - now;

    return {
      daily: this.formatTime(dailyRemaining),
      weekly: this.formatTime(weeklyRemaining),
    };
  }

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}시간 ${m}분 ${s}초`;
  }

  // ---- 상태 저장/복원 ----
  getState() {
    return {
      dailyMissions: this.dailyMissions,
      weeklyMissions: this.weeklyMissions,
      dailyProgress: this.dailyProgress,
      weeklyProgress: this.weeklyProgress,
      achievements: this.achievements,
      lastDailyReset: this.lastDailyReset,
      lastWeeklyReset: this.lastWeeklyReset,
    };
  }

  setState(state) {
    if (state.dailyMissions) this.dailyMissions = state.dailyMissions;
    if (state.weeklyMissions) this.weeklyMissions = state.weeklyMissions;
    if (state.dailyProgress) this.dailyProgress = state.dailyProgress;
    if (state.weeklyProgress) this.weeklyProgress = state.weeklyProgress;
    if (state.lastDailyReset) this.lastDailyReset = state.lastDailyReset;
    if (state.lastWeeklyReset) this.lastWeeklyReset = state.lastWeeklyReset;
    if (state.achievements) {
      // 새로 추가된 업적 처리
      for (const ach of ACHIEVEMENTS) {
        if (!this.achievements[ach.id]) {
          this.achievements[ach.id] = { unlocked: false };
        }
      }
      // 기존 상태 복원
      for (const [id, val] of Object.entries(state.achievements)) {
        this.achievements[id] = val;
      }
    }
  }
}
