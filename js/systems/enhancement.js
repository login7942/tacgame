// ============================================================
// systems/enhancement.js - 독립 장비 강화 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { RESOURCES } from '../data.js';
import { rand } from '../utils.js';

// ---- 장비 강화 시스템 ----
export class EnhancementSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getPlayerGold()              → number
   *   consumeGold(amt)             → boolean
   *   hasItem(id, amt)             → boolean
   *   removeItem(id, amt)          → boolean
   *   getEquipmentInstance(uid)    → equipment object
   *   updateEquipmentInstance(uid, data) → void
   *   destroyEquipmentInstance(uid)→ void
   *   onStateChanged()             → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 장비 강화 시도 ----
  enhance(equipmentUid) {
    const equipment = this.cb.getEquipmentInstance(equipmentUid);
    if (!equipment) {
      return { success: false, reason: '장비를 찾을 수 없습니다.' };
    }

    const currentLevel = equipment.enhancement || 0;
    if (currentLevel >= 10) {
      return { success: false, reason: '이미 최대 강화 레벨입니다! (+10)' };
    }

    // 재료 확인
    const material = this.getRequiredMaterial(currentLevel);
    if (!this.cb.hasItem(material.id, material.amount)) {
      return { success: false, reason: `${material.name}이(가) 부족합니다!` };
    }

    // 골드 확인
    const cost = this.getEnhanceCost(currentLevel);
    if (this.cb.getPlayerGold() < cost) {
      return { success: false, reason: `골드가 부족합니다! (${cost}G 필요)` };
    }

    // 재료 & 골드 소모
    this.cb.removeItem(material.id, material.amount);
    this.cb.consumeGold(cost);

    // 성공률 체크
    const successRate = this.getSuccessRate(currentLevel);
    const roll = Math.random();
    const success = roll < successRate;

    if (success) {
      // 강화 성공!
      equipment.enhancement = currentLevel + 1;
      this.cb.updateEquipmentInstance(equipmentUid, equipment);

      this.emit('enhanceSuccess', {
        equipment,
        newLevel: equipment.enhancement,
        successRate: Math.round(successRate * 100),
      });

      this.emit('toast', {
        msg: `✨ 강화 성공! ${equipment.name} +${equipment.enhancement}`,
        type: 'success'
      });

      this.cb.onStateChanged();
      return { success: true, newLevel: equipment.enhancement };
    } else {
      // 강화 실패
      const failureResult = this.handleFailure(equipment, currentLevel);

      if (failureResult.destroyed) {
        this.cb.destroyEquipmentInstance(equipmentUid);
      } else {
        this.cb.updateEquipmentInstance(equipmentUid, equipment);
      }

      this.emit('enhanceFail', {
        equipment,
        result: failureResult,
      });

      this.emit('toast', {
        msg: failureResult.reason,
        type: failureResult.destroyed ? 'error' : 'warning'
      });

      this.cb.onStateChanged();
      return failureResult;
    }
  }

  // ---- 성공률 계산 ----
  getSuccessRate(level) {
    const rates = [
      0.95, // +0 → +1: 95%
      0.90, // +1 → +2: 90%
      0.85, // +2 → +3: 85%
      0.80, // +3 → +4: 80%
      0.75, // +4 → +5: 75%
      0.65, // +5 → +6: 65%
      0.50, // +6 → +7: 50%
      0.40, // +7 → +8: 40%
      0.30, // +8 → +9: 30%
      0.20, // +9 → +10: 20%
    ];
    return rates[level] || 0;
  }

  // ---- 강화 비용 계산 ----
  getEnhanceCost(level) {
    return 100 * (level + 1); // +1강화: 100G, +2강화: 200G, ...
  }

  // ---- 필요 재료 계산 ----
  getRequiredMaterial(level) {
    if (level < 3) {
      return { id: 'enhancement_stone', amount: 1, name: '강화석' };
    } else if (level < 7) {
      return { id: 'advanced_enhancement', amount: 1, name: '고급 강화석' };
    } else {
      return { id: 'superior_enhancement', amount: 1, name: '최상급 강화석' };
    }
  }

  // ---- 강화 실패 처리 ----
  handleFailure(equipment, currentLevel) {
    if (currentLevel <= 5) {
      // +0~+5: 강화도 유지
      return {
        success: false,
        reason: `💔 강화 실패! 강화도가 유지되었습니다. (${equipment.name} +${currentLevel})`,
        levelChange: 0,
        destroyed: false,
      };
    } else if (currentLevel <= 7) {
      // +6~+7: 50% 확률로 강화도 -1
      if (Math.random() < 0.5) {
        equipment.enhancement = currentLevel - 1;
        return {
          success: false,
          reason: `💔 강화 실패! 강화도가 하락했습니다. (${equipment.name} +${currentLevel} → +${equipment.enhancement})`,
          levelChange: -1,
          destroyed: false,
        };
      } else {
        return {
          success: false,
          reason: `💔 강화 실패! 강화도가 유지되었습니다. (${equipment.name} +${currentLevel})`,
          levelChange: 0,
          destroyed: false,
        };
      }
    } else {
      // +8~+10: 강화도 -1 또는 30% 확률로 파괴
      if (Math.random() < 0.3) {
        equipment.destroyed = true;
        return {
          success: false,
          reason: `💀 강화 실패! 장비가 파괴되었습니다... (${equipment.name} +${currentLevel})`,
          destroyed: true,
        };
      } else {
        equipment.enhancement = currentLevel - 1;
        return {
          success: false,
          reason: `💔 강화 실패! 강화도가 하락했습니다. (${equipment.name} +${currentLevel} → +${equipment.enhancement})`,
          levelChange: -1,
          destroyed: false,
        };
      }
    }
  }

  // ---- 강화 보너스 배율 계산 ----
  getEnhancementBonus(level) {
    if (!level || level <= 0) return 1.0;
    // 레벨당 7% 증가 (5~10% 범위의 중간값)
    return 1 + (level * 0.07);
  }

  // ---- 장비 이름 포맷 (강화도 표시) ----
  formatEquipmentName(equipment) {
    if (!equipment) return '';
    const level = equipment.enhancement || 0;
    if (level > 0) {
      return `${equipment.name} +${level}`;
    }
    return equipment.name;
  }
}
