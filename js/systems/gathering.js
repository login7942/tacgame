// ============================================================
// systems/gathering.js - 독립 자동채집 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { ZONES, RESOURCES } from '../data.js';

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- 자동채집 시스템 ----
export class GatheringSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getCurrentZone()    → zoneId string
   *   getPlayerStamina()  → { stamina, maxStamina }
   *   getPlayerLevel()    → number
   *   getToolBonus()      → { efficiency, cooldownReduce }
   *   consumeStamina(amt) → boolean (성공/실패)
   *   gatherResource()    → void (실제 채집 실행)
   *   hasStaminaFood()    → boolean
   *   useStaminaFood()    → { recovered, name }
   *   onStateChanged()    → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 자동채집 상태
    this.active = false;
    this.timer = null;
    this.baseInterval = 2000; // 기본 2초 (수동 1초보다 느림)

    // 자동채집 설정
    this.settings = {
      autoFood: false,        // 자동 음식 사용
      foodThreshold: 30,      // 스태미나 % 이하시 음식 사용
      stopThreshold: 20,      // 스태미나 % 이하시 자동 중단
    };

    // 세션 통계
    this.session = this.freshSession();
  }

  freshSession() {
    return {
      gathered: {},           // { itemId: amount }
      totalCount: 0,
      startTime: Date.now(),
      duration: 0,
    };
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 자동채집 시작 ----
  start() {
    if (this.active) return false;

    const { stamina, maxStamina } = this.cb.getPlayerStamina();
    const stopThreshold = (this.settings.stopThreshold / 100) * maxStamina;

    if (stamina < stopThreshold) {
      this.emit('toast', { msg: '스태미나가 너무 낮아 자동채집을 시작할 수 없습니다!', type: 'error' });
      return false;
    }

    this.active = true;
    this.session = this.freshSession();
    this.emit('gatherStart', this.getSnapshot());

    this.startTimer();
    this.emit('toast', { msg: '🔄 자동채집을 시작합니다!', type: 'info' });
    return true;
  }

  // ---- 자동채집 중단 ----
  stop(reason) {
    if (!this.active) return;
    this.stopTimer();
    this.active = false;
    this.session.duration = Math.floor((Date.now() - this.session.startTime) / 1000);

    if (reason) {
      this.emit('toast', { msg: reason, type: 'info' });
    }
    this.emit('gatherStop', { reason, session: { ...this.session } });
    this.cb.onStateChanged();
  }

  // ---- 타이머 관리 ----
  startTimer() {
    this.stopTimer();
    const interval = this.getGatherInterval();
    this.timer = setInterval(() => this.tick(), interval);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ---- 채집 간격 계산 (레벨/장비 보너스 적용) ----
  getGatherInterval() {
    const level = this.cb.getPlayerLevel();
    const toolBonus = this.cb.getToolBonus();

    let interval = this.baseInterval;

    // 레벨 보너스: 레벨 20부터 쿨다운 감소
    if (level >= 50) {
      interval = 1200; // 1.2초
    } else if (level >= 20) {
      interval = 1700; // 1.7초
    }

    // 장비 보너스
    if (toolBonus.cooldownReduce > 0) {
      interval *= (1 - toolBonus.cooldownReduce / 100);
    }

    return Math.max(500, interval); // 최소 0.5초
  }

  // ---- 자동채집 틱 ----
  tick() {
    if (!this.active) {
      this.stopTimer();
      return;
    }

    const { stamina, maxStamina } = this.cb.getPlayerStamina();
    const staminaPercent = (stamina / maxStamina) * 100;
    const stopThreshold = this.settings.stopThreshold;
    const foodThreshold = this.settings.foodThreshold;

    // 스태미나 체크: 중단 임계값
    if (staminaPercent <= stopThreshold) {
      this.stop('스태미나가 부족하여 자동채집이 중단되었습니다.');
      return;
    }

    // 자동 음식 사용
    if (this.settings.autoFood && staminaPercent <= foodThreshold && this.cb.hasStaminaFood()) {
      const result = this.cb.useStaminaFood();
      if (result.recovered > 0) {
        this.emit('toast', { msg: `🍲 ${result.name} 사용! 스태미나 +${result.recovered}`, type: 'success' });
      }
    }

    // 스태미나 소모 및 채집 실행
    if (!this.cb.consumeStamina(5)) {
      this.stop('스태미나가 부족합니다.');
      return;
    }

    // 실제 채집 실행 (GameEngine의 gatherResource 호출)
    const gathered = this.cb.gatherResource();

    // 세션 통계 업데이트
    if (gathered && gathered.length > 0) {
      for (const item of gathered) {
        if (!this.session.gathered[item.id]) {
          this.session.gathered[item.id] = 0;
        }
        this.session.gathered[item.id] += item.amount;
        this.session.totalCount += item.amount;
      }
    }

    this.emit('gatherTick', this.getSnapshot());
    this.cb.onStateChanged();
  }

  // ---- 설정 변경 ----
  setAutoFood(enabled) {
    this.settings.autoFood = enabled;
    this.emit('settingsChanged', this.settings);
  }

  setFoodThreshold(percent) {
    this.settings.foodThreshold = clamp(percent, 10, 90);
    this.emit('settingsChanged', this.settings);
  }

  setStopThreshold(percent) {
    this.settings.stopThreshold = clamp(percent, 5, 50);
    this.emit('settingsChanged', this.settings);
  }

  // ---- 스냅샷 (UI 렌더링용) ----
  getSnapshot() {
    return {
      active: this.active,
      settings: { ...this.settings },
      session: { ...this.session },
      interval: this.getGatherInterval(),
    };
  }

  // ---- 저장/복원 ----
  serialize() {
    return {
      settings: { ...this.settings },
    };
  }

  restore(data) {
    if (!data) return;
    if (data.settings) Object.assign(this.settings, data.settings);
    // 자동채집 중이었으면 중단
    this.active = false;
    this.stopTimer();
  }
}
