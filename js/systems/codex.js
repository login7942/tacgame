// ============================================================
// systems/codex.js - 독립 도감 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { RESOURCES, MONSTERS, EQUIPMENT } from '../data.js';

// ---- 완성도 보상 정의 ----
const MILESTONES = [
  { percentage: 10, id: 'ms_10', reward: { type: 'bonus', key: 'goldBonus', amount: 2 }, name: '골드 획득 +2%', claimed: false },
  { percentage: 20, id: 'ms_20', reward: { type: 'bonus', key: 'expBonus', amount: 2 }, name: '경험치 획득 +2%', claimed: false },
  { percentage: 30, id: 'ms_30', reward: { type: 'bonus', key: 'gatherSpeed', amount: 2 }, name: '채집 속도 +2%', claimed: false },
  { percentage: 40, id: 'ms_40', reward: { type: 'bonus', key: 'combatPower', amount: 2 }, name: '전투 피해 +2%', claimed: false },
  { percentage: 50, id: 'ms_50', reward: { type: 'bonus', key: 'combatPower', amount: 5 }, name: '특수 칭호 + 스탯 +5', claimed: false },
  { percentage: 60, id: 'ms_60', reward: { type: 'bonus', key: 'workerEfficiency', amount: 5 }, name: '일꾼 효율 +5%', claimed: false },
  { percentage: 70, id: 'ms_70', reward: { type: 'bonus', key: 'marketFee', amount: -5 }, name: '시장 수수료 -5%', claimed: false },
  { percentage: 80, id: 'ms_80', reward: { type: 'bonus', key: 'legacyBonus', amount: 10 }, name: '레거시 포인트 +10%', claimed: false },
  { percentage: 90, id: 'ms_90', reward: { type: 'item', id: 'legendary_blueprint', amount: 1 }, name: '전설 아이템 도안', claimed: false },
  { percentage: 100, id: 'ms_100', reward: { type: 'bonus', key: 'allStats', amount: 10 }, name: '완전체 칭호 + 모든 스탯 +10%', claimed: false },
];

// ---- 도감 시스템 ----
export class CodexSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   addPermanentBonus(key, amount) → void
   *   grantItem(id, amount)           → void
   *   onStateChanged()                → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 내부 상태
    this.entries = {
      resources: {},  // resourceId → { discovered: true, firstGathered: timestamp, totalGathered: number }
      monsters: {},   // monsterId → { discovered: true, firstDefeated: timestamp, totalDefeated: number }
      equipment: {}   // equipmentId → { discovered: true, firstCrafted: timestamp }
    };
    this.milestones = {}; // milestoneId → { claimed: boolean }

    // 초기화
    MILESTONES.forEach(ms => {
      this.milestones[ms.id] = { claimed: false };
    });
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 등록 메서드 ----
  discoverResource(resourceId, amount = 1) {
    if (!RESOURCES[resourceId]) return;

    if (!this.entries.resources[resourceId]) {
      this.entries.resources[resourceId] = {
        discovered: true,
        firstGathered: Date.now(),
        totalGathered: amount
      };
      this.emit('toast', { msg: `📖 도감 등록: ${RESOURCES[resourceId].name}`, type: 'info' });
      this.checkMilestones();
    } else {
      this.entries.resources[resourceId].totalGathered += amount;
    }
  }

  discoverMonster(monsterId) {
    if (!MONSTERS[monsterId]) return;

    if (!this.entries.monsters[monsterId]) {
      this.entries.monsters[monsterId] = {
        discovered: true,
        firstDefeated: Date.now(),
        totalDefeated: 1
      };
      this.emit('toast', { msg: `📖 도감 등록: ${MONSTERS[monsterId].name}`, type: 'info' });
      this.checkMilestones();
    } else {
      this.entries.monsters[monsterId].totalDefeated++;
    }
  }

  discoverEquipment(equipmentId) {
    if (!EQUIPMENT[equipmentId]) return;

    if (!this.entries.equipment[equipmentId]) {
      this.entries.equipment[equipmentId] = {
        discovered: true,
        firstCrafted: Date.now()
      };
      this.emit('toast', { msg: `📖 도감 등록: ${EQUIPMENT[equipmentId].name}`, type: 'info' });
      this.checkMilestones();
    }
  }

  // ---- 진행도 계산 ----
  getProgress(category) {
    const dataSource = category === 'resources' ? RESOURCES :
                      category === 'monsters' ? MONSTERS :
                      category === 'equipment' ? EQUIPMENT : {};

    const total = Object.keys(dataSource).length;
    const discovered = Object.keys(this.entries[category] || {}).length;

    return { discovered, total, percentage: total > 0 ? Math.floor((discovered / total) * 100) : 0 };
  }

  getTotalProgress() {
    const resourcesProgress = this.getProgress('resources');
    const monstersProgress = this.getProgress('monsters');
    const equipmentProgress = this.getProgress('equipment');

    const totalDiscovered = resourcesProgress.discovered + monstersProgress.discovered + equipmentProgress.discovered;
    const totalCount = resourcesProgress.total + monstersProgress.total + equipmentProgress.total;

    return {
      discovered: totalDiscovered,
      total: totalCount,
      percentage: totalCount > 0 ? Math.floor((totalDiscovered / totalCount) * 100) : 0
    };
  }

  // ---- 보상 관리 ----
  checkMilestones() {
    const totalProgress = this.getTotalProgress();

    for (const ms of MILESTONES) {
      if (totalProgress.percentage >= ms.percentage && !this.milestones[ms.id].claimed) {
        // 자동 클레임
        this.claimMilestone(ms.id);
      }
    }
  }

  claimMilestone(milestoneId) {
    const ms = MILESTONES.find(m => m.id === milestoneId);
    if (!ms) return;

    if (this.milestones[milestoneId].claimed) {
      return; // 이미 받음
    }

    // 보상 지급
    if (ms.reward.type === 'bonus') {
      this.cb.addPermanentBonus(ms.reward.key, ms.reward.amount);
      this.emit('toast', {
        msg: `🏆 도감 완성도 ${ms.percentage}% 달성! ${ms.name}`,
        type: 'success'
      });
    } else if (ms.reward.type === 'item') {
      this.cb.grantItem(ms.reward.id, ms.reward.amount);
      this.emit('toast', {
        msg: `🏆 도감 완성도 ${ms.percentage}% 달성! ${ms.name} 획득!`,
        type: 'success'
      });
    }

    // 클레임 표시
    this.milestones[milestoneId].claimed = true;

    this.emit('milestoneUnlocked', {
      milestoneId,
      percentage: ms.percentage,
      reward: ms.name
    });

    this.cb.onStateChanged();
  }

  // ---- 보상 목록 가져오기 ----
  getMilestones() {
    return MILESTONES.map(ms => ({
      ...ms,
      claimed: this.milestones[ms.id]?.claimed || false
    }));
  }

  // ---- 상태 저장/복원 ----
  getState() {
    return {
      entries: this.entries,
      milestones: this.milestones
    };
  }

  setState(state) {
    if (state.entries) this.entries = state.entries;
    if (state.milestones) this.milestones = state.milestones;
  }
}
