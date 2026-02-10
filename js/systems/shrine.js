// ============================================================
// systems/shrine.js - 독립 봉헌 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { EQUIPMENT, SHRINE_CONFIG } from '../data.js';

export class ShrineSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getEquipmentInstance(uid)     → equipment object
   *   isEquipmentEquipped(uid)      → boolean
   *   removeEquipment(uid)          → void
   *   addPermanentBonus(key, amount)→ void
   *   onStateChanged()              → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 내부 상태
    this.totalOfferings = 0;
    this.totalPoints = 0;
    this.statPoints = { attack: 0, defense: 0, hp: 0, speed: 0, luck: 0 };
    this.milestones = {};
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 봉헌 포인트 계산 ----
  calculateOfferingPoints(equipmentUid) {
    const eq = this.cb.getEquipmentInstance(equipmentUid);
    if (!eq) return 0;
    const base = EQUIPMENT[eq.baseId];
    if (!base) return 0;
    const tier = base.tier || 1;
    const tierPts = SHRINE_CONFIG.tierPoints[tier] || 1;
    const enhancePts = (eq.enhancement || 0) * SHRINE_CONFIG.enhancementPointsPerLevel;
    return tierPts + enhancePts;
  }

  // ---- 봉헌 실행 ----
  offer(equipmentUid, targetStat) {
    // 유효한 스탯인지 확인
    if (!SHRINE_CONFIG.stats.includes(targetStat)) {
      this.emit('toast', { msg: '유효하지 않은 스탯입니다.', type: 'error' });
      return { success: false };
    }

    const eq = this.cb.getEquipmentInstance(equipmentUid);
    if (!eq) {
      this.emit('toast', { msg: '장비를 찾을 수 없습니다.', type: 'error' });
      return { success: false };
    }

    // 장착 중인 장비는 봉헌 불가
    if (this.cb.isEquipmentEquipped(equipmentUid)) {
      this.emit('toast', { msg: '장착 중인 장비는 봉헌할 수 없습니다.', type: 'error' });
      return { success: false };
    }

    const base = EQUIPMENT[eq.baseId];
    const points = this.calculateOfferingPoints(equipmentUid);
    const displayName = base ? base.name : eq.baseId;
    const enhText = (eq.enhancement || 0) > 0 ? `+${eq.enhancement} ` : '';

    // 장비 소멸
    this.cb.removeEquipment(equipmentUid);

    // 스탯 포인트 배분
    this.statPoints[targetStat] += points;
    this.totalPoints += points;
    this.totalOfferings++;

    const statName = SHRINE_CONFIG.statNames[targetStat];
    this.emit('toast', {
      msg: `🏛️ ${enhText}${displayName} 봉헌! ${statName} +${points}`,
      type: 'success'
    });

    // 마일스톤 체크
    this.checkMilestones();

    this.cb.onStateChanged();
    this.emit('offeringComplete', { points, targetStat, totalOfferings: this.totalOfferings });
    return { success: true, points };
  }

  // ---- 마일스톤 체크 ----
  checkMilestones() {
    for (const [countStr, milestone] of Object.entries(SHRINE_CONFIG.milestones)) {
      const count = parseInt(countStr);
      if (this.totalOfferings >= count && !this.milestones[countStr]) {
        this.milestones[countStr] = true;
        this.applyMilestoneReward(milestone);
        this.emit('toast', {
          msg: `🏛️ 마일스톤 달성! ${milestone.name}: ${milestone.desc}`,
          type: 'success'
        });
        this.emit('milestoneUnlocked', { count, milestone });
      }
    }
  }

  // ---- 마일스톤 보상 적용 ----
  applyMilestoneReward(milestone) {
    const r = milestone.reward;
    switch (r.type) {
      case 'permanentBonus':
        this.cb.addPermanentBonus(r.key, r.value);
        break;
      case 'allStats':
        for (const stat of SHRINE_CONFIG.stats) {
          this.statPoints[stat] += r.value;
          this.totalPoints += r.value;
        }
        break;
      // percentBonus, percentBonusAll, unlockRecipe는
      // milestones 플래그를 통해 getPlayerStats()에서 적용
      case 'percentBonus':
      case 'percentBonusAll':
      case 'unlockRecipe':
        break;
    }
  }

  // ---- 다음 마일스톤 ----
  getNextMilestone() {
    const counts = Object.keys(SHRINE_CONFIG.milestones).map(Number).sort((a, b) => a - b);
    for (const count of counts) {
      if (this.totalOfferings < count) {
        return { count, ...SHRINE_CONFIG.milestones[count] };
      }
    }
    return null;
  }

  // ---- 상태 저장/복원 ----
  getState() {
    return {
      totalOfferings: this.totalOfferings,
      totalPoints: this.totalPoints,
      statPoints: { ...this.statPoints },
      milestones: { ...this.milestones },
    };
  }

  setState(state) {
    if (state.totalOfferings !== undefined) this.totalOfferings = state.totalOfferings;
    if (state.totalPoints !== undefined) this.totalPoints = state.totalPoints;
    if (state.statPoints) this.statPoints = { ...state.statPoints };
    if (state.milestones) this.milestones = { ...state.milestones };
  }

  // ---- UI용 스냅샷 ----
  getSnapshot() {
    return {
      totalOfferings: this.totalOfferings,
      totalPoints: this.totalPoints,
      statPoints: { ...this.statPoints },
      milestones: { ...this.milestones },
      nextMilestone: this.getNextMilestone(),
    };
  }
}
