// ============================================================
// systems/combat.js - 독립 전투 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { MONSTERS, ENV_NAMES } from '../data.js';

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- 전투 시스템 ----
export class CombatSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getPlayerStats()   → { attack, defense, speed, luck, crit }
   *   getPlayerResist()   → { fire, cold, lightning, void, pressure, radiation }
   *   getPlayerHp()       → { hp, maxHp }
   *   getWeaponData()     → equipment object | null
   *   damagePlayer(dmg)   → void
   *   healPlayer(amt)     → void
   *   hasPotion()         → boolean
   *   usePotion()         → { healed, name }
   *   addLoot(items)      → void (items: [{id, amount}])
   *   addExp(amt)         → void
   *   addGold(amt)        → void
   *   onDefeat(cause)     → void
   *   getMonsterMastery(monsterId) → number (tier 0~5)
   *   onStateChanged()    → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 전투 상태
    this.inCombat = false;
    this.enemyId = null;
    this.enemy = null;
    this.enemyHp = 0;
    this.enemyMaxHp = 0;
    this.log = [];
    this.turn = 0;

    // 자동전투 상태
    this.auto = {
      enabled: false,
      targetId: null,       // 반복 사냥 대상
      repeatMode: 0,        // 0=무한, n=n회
      repeatRemaining: 0,
      speed: 1,             // 1x, 2x
      potionThreshold: 30,  // HP% 이하이면 물약 사용
      fleeThreshold: 0,     // HP% 이하이면 도주 (0=비활성)
    };
    this.autoTimer = null;

    // 세션 통계 (자동전투 시작~종료)
    this.session = this.freshSession();
  }

  freshSession() {
    return { kills: 0, exp: 0, gold: 0, loot: {}, startTime: Date.now() };
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 전투 시작 ----
  startCombat(monsterId) {
    const mon = MONSTERS[monsterId];
    if (!mon) return false;
    if (this.inCombat) return false;

    const { hp } = this.cb.getPlayerHp();
    if (hp < 10) {
      this.emit('toast', { msg: 'HP가 너무 낮아 전투할 수 없습니다!', type: 'error' });
      return false;
    }

    this.inCombat = true;
    this.enemyId = monsterId;
    this.enemy = { ...mon };
    this.enemyHp = mon.hp;
    this.enemyMaxHp = mon.hp;
    this.turn = 0;
    this.log = [`⚔️ ${mon.name}과(와) 전투 시작!`];

    this.emit('combatStart', this.getSnapshot());
    return true;
  }

  // ---- 수동 공격 ----
  attack() {
    if (!this.inCombat) return;
    this.executeTurn('attack');
  }

  // ---- 수동 물약 ----
  usePotion() {
    if (!this.inCombat) return;
    this.executeTurn('potion');
  }

  // ---- 수동 도주 ----
  flee() {
    if (!this.inCombat) return;
    this.executeTurn('flee');
  }

  // ---- 턴 실행 (핵심 로직) ----
  executeTurn(action) {
    if (!this.inCombat) return;
    this.turn++;
    const pStats = this.cb.getPlayerStats();
    const pResist = this.cb.getPlayerResist();
    const weapon = this.cb.getWeaponData();
    const mon = this.enemy;

    // ---- 플레이어 행동 ----
    if (action === 'attack') {
      let dmg = Math.max(1, pStats.attack - mon.def * 0.5);

      // 숙련도 보너스
      const masteryTier = this.cb.getMonsterMastery ? this.cb.getMonsterMastery(this.enemyId) : 0;
      if (masteryTier > 0) {
        dmg = Math.floor(dmg * (1 + masteryTier * 0.02));
      }

      // 크리티컬
      const critChance = (pStats.crit || 0) + (pStats.luck || 0) * 0.5;
      let isCrit = false;
      if (Math.random() * 100 < critChance) {
        dmg = Math.floor(dmg * 1.8);
        isCrit = true;
      }

      // 약점 속성 보너스
      if (weapon) {
        if (mon.weakness === 'fire' && weapon.stats?.fireDmg) dmg += weapon.stats.fireDmg;
        if (mon.weakness === 'cold' && weapon.stats?.iceDmg) dmg += weapon.stats.iceDmg;
        if (mon.weakness === 'lightning' && weapon.stats?.lightningDmg) dmg += weapon.stats.lightningDmg;
      }

      // 랜덤 편차 ±10%
      dmg = Math.floor(dmg * (1 + rand(-10, 10) / 100));
      dmg = Math.max(1, dmg);
      this.enemyHp -= dmg;
      this.log.push(`${isCrit ? '💥 크리티컬! ' : ''}${dmg} 데미지를 입혔다!`);

      if (this.enemyHp <= 0) {
        this.enemyHp = 0;
        this.victory();
        return;
      }
    } else if (action === 'potion') {
      if (this.cb.hasPotion()) {
        const result = this.cb.usePotion();
        this.log.push(`🧪 ${result.name} 사용! HP +${result.healed}`);
      } else {
        this.log.push('🧪 사용할 물약이 없다!');
      }
    } else if (action === 'flee') {
      const fleeChance = 50 + ((pStats.speed || 10) - mon.spd) * 2;
      if (Math.random() * 100 < fleeChance) {
        this.log.push('🏃 도주에 성공했습니다!');
        this.endCombat('flee');
        return;
      } else {
        this.log.push('🏃 도주 실패!');
      }
    }

    // ---- 몬스터 반격 ----
    this.enemyAttack(pStats, pResist, mon);
  }

  enemyAttack(pStats, pResist, mon) {
    let mDmg = Math.max(1, mon.atk - (pStats.defense || 0) * 0.5);
    // 속성 감소
    if (mon.element && pResist[mon.element]) {
      mDmg *= (1 - clamp(pResist[mon.element] / 100, 0, 0.8));
    }
    mDmg = Math.floor(mDmg * (1 + rand(-15, 15) / 100));
    mDmg = Math.max(1, mDmg);

    this.cb.damagePlayer(mDmg);
    this.log.push(`${mon.name}의 공격! ${mDmg} 데미지를 받았다!`);

    const { hp } = this.cb.getPlayerHp();
    if (hp <= 0) {
      this.log.push(`💀 ${mon.name}에게 패배했습니다...`);
      this.endCombat('defeat');
      this.cb.onDefeat(`${mon.name}에게 패배했습니다.`);
      return;
    }
    this.emit('turnComplete', this.getSnapshot());
    this.cb.onStateChanged();
  }

  // ---- 승리 ----
  victory() {
    const mon = this.enemy;
    const monData = MONSTERS[this.enemyId];
    this.log.push(`🎉 ${mon.name}을(를) 처치했습니다!`);

    // 경험치
    this.cb.addExp(mon.exp);
    this.session.exp += mon.exp;

    // 골드
    const goldGain = mon.gold + rand(0, Math.floor(mon.gold * 0.3));
    this.cb.addGold(goldGain);
    this.session.gold += goldGain;
    this.log.push(`💰 ${goldGain} 골드 획득!`);

    // 드롭
    const pStats = this.cb.getPlayerStats();
    const masteryTier = this.cb.getMonsterMastery ? this.cb.getMonsterMastery(this.enemyId) : 0;
    const drops = [];
    for (const loot of (monData?.loot || [])) {
      const luckBonus = (pStats.luck || 0) * 0.005;
      const masteryDropBonus = masteryTier * 0.05;
      if (Math.random() < loot.chance + luckBonus + masteryDropBonus) {
        const amt = rand(loot.min, loot.max);
        drops.push({ id: loot.id, amount: amt });
        // 세션 통계
        this.session.loot[loot.id] = (this.session.loot[loot.id] || 0) + amt;
      }
    }
    if (drops.length > 0) {
      this.cb.addLoot(drops);
      const text = drops.map(d => `${d.id} x${d.amount}`).join(', ');
      this.log.push(`📦 드롭: ${text}`);
    }

    this.session.kills++;
    this.endCombat('victory');
  }

  // ---- 전투 종료 ----
  endCombat(reason) {
    this.inCombat = false;
    this.emit('combatEnd', {
      reason,
      monsterId: this.enemyId, // 도감 등록을 위해 추가
      snapshot: this.getSnapshot()
    });
    this.cb.onStateChanged();

    // 자동전투 중이면 다음 전투
    if (this.auto.enabled && reason === 'victory') {
      this.autoNext();
    } else if (this.auto.enabled && (reason === 'defeat' || reason === 'flee')) {
      this.stopAuto('전투 종료로 자동전투가 중단되었습니다.');
    }
  }

  // ======== 자동전투 ========
  /**
   * @param {string} monsterId - 사냥 대상
   * @param {number} repeatCount - 반복 횟수 (0=무한)
   * @param {number} speed - 배속 (1 or 2)
   */
  startAuto(monsterId, repeatCount = 0, speed = 1) {
    if (this.auto.enabled) this.stopAuto();

    this.auto.enabled = true;
    this.auto.targetId = monsterId;
    this.auto.repeatMode = repeatCount;
    this.auto.repeatRemaining = repeatCount;
    this.auto.speed = speed;
    this.session = this.freshSession();

    this.emit('autoStart', { monsterId, repeatCount, speed });

    // 첫 전투 시작
    if (!this.startCombat(monsterId)) {
      this.stopAuto('전투를 시작할 수 없습니다.');
      return;
    }

    // 자동 턴 타이머
    this.startAutoTimer();
  }

  startAutoTimer() {
    this.stopAutoTimer();
    const interval = this.auto.speed === 2 ? 400 : 800;
    this.autoTimer = setInterval(() => this.autoTick(), interval);
  }

  stopAutoTimer() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  setAutoSpeed(speed) {
    this.auto.speed = speed;
    if (this.autoTimer) this.startAutoTimer(); // 재시작
    this.emit('autoUpdate', this.getAutoSnapshot());
  }

  autoTick() {
    if (!this.auto.enabled) { this.stopAutoTimer(); return; }
    if (!this.inCombat) return; // 다음 전투 대기 중

    const { hp, maxHp } = this.cb.getPlayerHp();
    const hpPercent = (hp / maxHp) * 100;

    // 도주 판단
    if (this.auto.fleeThreshold > 0 && hpPercent <= this.auto.fleeThreshold) {
      this.executeTurn('flee');
      return;
    }

    // 물약 판단
    if (hpPercent <= this.auto.potionThreshold && this.cb.hasPotion()) {
      this.executeTurn('potion');
      return;
    }

    // 공격
    this.executeTurn('attack');
  }

  autoNext() {
    // 남은 횟수 체크
    if (this.auto.repeatMode > 0) {
      this.auto.repeatRemaining--;
      if (this.auto.repeatRemaining <= 0) {
        this.stopAuto('설정한 횟수만큼 사냥을 완료했습니다!');
        return;
      }
    }

    // HP 체크 - 너무 낮으면 대기
    const { hp, maxHp } = this.cb.getPlayerHp();
    if (hp < maxHp * 0.2) {
      // 물약 있으면 사용
      if (this.cb.hasPotion()) {
        this.cb.usePotion();
      } else {
        this.stopAuto('HP가 너무 낮아 자동전투가 중단되었습니다.');
        return;
      }
    }

    // 짧은 딜레이 후 다음 전투
    setTimeout(() => {
      if (!this.auto.enabled) return;
      if (!this.startCombat(this.auto.targetId)) {
        this.stopAuto('전투를 시작할 수 없습니다.');
      }
    }, 300);
  }

  stopAuto(reason) {
    this.stopAutoTimer();
    this.auto.enabled = false;
    this.auto.targetId = null;
    if (reason) {
      this.emit('toast', { msg: reason, type: 'info' });
    }
    this.emit('autoStop', { reason, session: { ...this.session } });
    this.cb.onStateChanged();
  }

  // ---- 스냅샷 (UI 렌더링용) ----
  getSnapshot() {
    return {
      inCombat: this.inCombat,
      enemyId: this.enemyId,
      enemy: this.enemy ? { ...this.enemy } : null,
      enemyHp: this.enemyHp,
      enemyMaxHp: this.enemyMaxHp,
      log: [...this.log],
      turn: this.turn,
    };
  }

  getAutoSnapshot() {
    return {
      enabled: this.auto.enabled,
      targetId: this.auto.targetId,
      repeatMode: this.auto.repeatMode,
      repeatRemaining: this.auto.repeatRemaining,
      speed: this.auto.speed,
      potionThreshold: this.auto.potionThreshold,
      session: { ...this.session },
    };
  }

  // ---- 저장/복원 ----
  serialize() {
    return {
      auto: { ...this.auto },
      session: { ...this.session },
    };
  }

  restore(data) {
    if (!data) return;
    if (data.auto) Object.assign(this.auto, data.auto);
    if (data.session) Object.assign(this.session, data.session);
    // 전투 중이었으면 리셋 (자동전투는 재시작 안 함)
    this.inCombat = false;
    this.auto.enabled = false;
  }
}
