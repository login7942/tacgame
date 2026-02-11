// ============================================================
// systems/expedition.js - 독립 원정 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { MERCENARY_TYPES, EXPEDITION_CONFIG, ZONES, MONSTERS } from '../data.js';
import { rand, clamp, uid } from '../utils.js';

// ---- 원정 시스템 ----
export class ExpeditionSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getMercenary(id)           → mercenary object
   *   updateMercenary(id, data)  → void
   *   getMercCombatPower(merc)   → number
   *   addLoot(items)             → void
   *   addGold(amount)            → void
   *   addMercExp(mercId, amount) → void
   *   getItemName(id)            → string
   *   onStateChanged()           → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 내부 상태
    this.activeExpeditions = [];
    this.expeditionHistory = [];   // 최근 10개
    this.staminaTickCounter = 0;   // 스태미나 회복 카운터
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 원정 파견 ----
  dispatch(mercenaryId, zoneId) {
    const merc = this.cb.getMercenary(mercenaryId);
    if (!merc) {
      this.emit('toast', { msg: '용병을 찾을 수 없습니다.', type: 'error' });
      return { success: false };
    }
    if (merc.status !== 'idle') {
      this.emit('toast', { msg: `${merc.name}은(는) 현재 사용할 수 없습니다.`, type: 'error' });
      return { success: false };
    }

    const zone = ZONES[zoneId];
    if (!zone) {
      this.emit('toast', { msg: '존재하지 않는 구역입니다.', type: 'error' });
      return { success: false };
    }

    const tier = zone.tier || 1;
    const staminaCost = EXPEDITION_CONFIG.staminaCost[tier] || 20;

    if (merc.stamina < staminaCost) {
      this.emit('toast', { msg: `스태미나 부족! (필요: ${staminaCost}, 현재: ${Math.floor(merc.stamina)})`, type: 'error' });
      return { success: false };
    }

    // 스태미나 차감
    merc.stamina -= staminaCost;

    // 원정 시간 (도적 speedBonus 적용)
    const mType = MERCENARY_TYPES[merc.type];
    const speedBonus = mType?.classBonus?.speedBonus || 0;
    const baseDuration = EXPEDITION_CONFIG.duration[tier] || 300000;
    const duration = Math.floor(baseDuration * (1 - speedBonus));

    const encounters = EXPEDITION_CONFIG.encounters[tier] || 5;

    // 용병 상태 변경
    merc.status = 'expedition';
    this.cb.updateMercenary(merc.id, merc);

    // 활성 원정 등록
    const expedition = {
      id: uid(),
      mercenaryId: merc.id,
      mercenaryName: merc.name,
      mercenaryIcon: mType?.icon || '⚔️',
      zoneId,
      zoneName: zone.name,
      startTime: Date.now(),
      duration,
      staminaCost,
      encounters,
    };
    this.activeExpeditions.push(expedition);

    this.emit('toast', {
      msg: `${merc.name}을(를) ${zone.name}으로 원정 파견! (${Math.floor(duration / 60000)}분)`,
      type: 'success'
    });
    this.cb.onStateChanged();
    return { success: true, expedition };
  }

  // ---- tick에서 호출 ----
  update() {
    const now = Date.now();

    // 완료된 원정 체크
    for (const exp of this.activeExpeditions) {
      if (now - exp.startTime >= exp.duration) {
        this.completeExpedition(exp);
      }
    }

    // 완료된 원정 제거
    this.activeExpeditions = this.activeExpeditions.filter(
      e => now - e.startTime < e.duration
    );

    // 스태미나 회복 (30초마다)
    this.staminaTickCounter++;
    if (this.staminaTickCounter >= EXPEDITION_CONFIG.staminaRecoveryInterval) {
      this.staminaTickCounter = 0;
      this.recoverStamina();
    }

    // 회복중 용병 체크
    this.checkRecovery();
  }

  // ---- 원정 결과 계산 ----
  completeExpedition(expedition) {
    const merc = this.cb.getMercenary(expedition.mercenaryId);
    if (!merc) return;

    const zone = ZONES[expedition.zoneId];
    if (!zone) return;

    const mType = MERCENARY_TYPES[merc.type];
    const classBonus = mType?.classBonus || {};
    const mercPower = this.cb.getMercCombatPower(merc);

    // 비-레이드 몬스터만
    const eligibleMonsters = (zone.monsters || []).filter(mId => {
      const mon = MONSTERS[mId];
      return mon && !mon.isRaid;
    });

    if (eligibleMonsters.length === 0) {
      merc.status = 'idle';
      this.cb.updateMercenary(merc.id, merc);
      this.emit('toast', { msg: `${merc.name} 원정 완료 - 몬스터가 없었습니다.`, type: 'info' });
      return;
    }

    // 평균 몬스터 파워
    const avgMonsterPower = eligibleMonsters.reduce((sum, mId) => {
      const mon = MONSTERS[mId];
      return sum + (mon.hp * 0.3 + mon.atk * 2 + mon.def);
    }, 0) / eligibleMonsters.length;

    // 기본 성공률
    let baseSuccessRate = mercPower / (avgMonsterPower * 1.5);
    baseSuccessRate = clamp(baseSuccessRate, 0.3, 0.95);
    baseSuccessRate += classBonus.survivalBonus || 0;
    baseSuccessRate += merc.level * 0.01;
    baseSuccessRate = Math.min(0.98, baseSuccessRate);

    // 전투 시뮬레이션
    const encounterResults = [];
    let totalLoot = {};
    let totalExp = 0;
    let totalGold = 0;
    let wins = 0;

    for (let i = 0; i < expedition.encounters; i++) {
      const monsterId = eligibleMonsters[Math.floor(Math.random() * eligibleMonsters.length)];
      const monster = MONSTERS[monsterId];

      // 개별 전투 성공률
      let encounterRate = baseSuccessRate;

      // 마법사 속성 보너스
      if (classBonus.elementalDmgBonus && monster.weakness) {
        encounterRate += classBonus.elementalDmgBonus * 0.2;
      }

      const won = Math.random() < encounterRate;
      const encounter = { monsterId, monsterName: monster.name, won, loot: [], exp: 0, gold: 0 };

      if (won) {
        wins++;
        // 드롭 계산
        for (const drop of (monster.loot || [])) {
          let dropChance = drop.chance;
          dropChance += (classBonus.lootBonus || 0) * drop.chance;
          dropChance += merc.stats.luck * 0.003;

          if (Math.random() < dropChance) {
            const amt = rand(drop.min, drop.max);
            encounter.loot.push({ id: drop.id, amount: amt });
            totalLoot[drop.id] = (totalLoot[drop.id] || 0) + amt;
          }
        }
        // 경험치/골드
        encounter.exp = monster.exp;
        encounter.gold = monster.gold + rand(0, Math.floor(monster.gold * 0.2));
        totalExp += encounter.exp;
        totalGold += encounter.gold;
      }

      encounterResults.push(encounter);
    }

    // 전체 성공 판정 (50% 이상 승리)
    const overallSuccess = wins > expedition.encounters * 0.5;

    let finalLoot, finalExp, finalGold, mercExp;

    if (overallSuccess) {
      finalLoot = totalLoot;
      finalExp = totalExp;
      finalGold = totalGold;
      mercExp = Math.floor(totalExp * 0.5);
    } else {
      // 실패: 보상 감소
      finalLoot = {};
      for (const [id, amt] of Object.entries(totalLoot)) {
        finalLoot[id] = Math.max(1, Math.floor(amt * 0.3));
      }
      finalExp = Math.floor(totalExp * 0.5);
      finalGold = Math.floor(totalGold * 0.5);
      mercExp = Math.floor(totalExp * 0.25);
    }

    // 보상 지급
    const lootItems = Object.entries(finalLoot).map(([id, amount]) => ({ id, amount }));
    if (lootItems.length > 0) this.cb.addLoot(lootItems);
    if (finalGold > 0) this.cb.addGold(finalGold);

    // 용병 업데이트
    merc.expeditionCount = (merc.expeditionCount || 0) + 1;
    merc.totalKills = (merc.totalKills || 0) + wins;

    if (overallSuccess) {
      merc.status = 'idle';
    } else {
      merc.status = 'recovering';
      merc.recoverUntil = Date.now() + 5 * 60 * 1000; // 5분 회복
    }

    this.cb.updateMercenary(merc.id, merc);

    // 용병 경험치
    if (mercExp > 0) {
      this.cb.addMercExp(merc.id, mercExp);
    }

    // 결과 기록
    const result = {
      expeditionId: expedition.id,
      mercenaryId: merc.id,
      mercenaryName: merc.name,
      mercenaryIcon: expedition.mercenaryIcon,
      zoneId: expedition.zoneId,
      zoneName: expedition.zoneName,
      success: overallSuccess,
      wins,
      totalEncounters: expedition.encounters,
      totalLoot: finalLoot,
      totalExp: finalExp,
      totalGold: finalGold,
      mercExpGained: mercExp,
      timestamp: Date.now(),
    };

    this.expeditionHistory.unshift(result);
    if (this.expeditionHistory.length > 10) this.expeditionHistory.pop();

    this.emit('expeditionComplete', result);
    this.emit('toast', {
      msg: overallSuccess
        ? `원정 성공! ${merc.name} - ${zone.name} (${wins}/${expedition.encounters} 승리) +${finalGold}G`
        : `원정 실패... ${merc.name} - ${zone.name} (${wins}/${expedition.encounters} 승리)`,
      type: overallSuccess ? 'success' : 'warning',
    });
    this.cb.onStateChanged();
  }

  // ---- 스태미나 회복 (대기중 용병) ----
  recoverStamina() {
    const mercenaries = this.cb.getAllMercenaries ? this.cb.getAllMercenaries() : [];
    for (const merc of mercenaries) {
      if (merc.status === 'idle' && merc.stamina < (merc.maxStamina || EXPEDITION_CONFIG.maxStamina)) {
        merc.stamina = Math.min(
          merc.maxStamina || EXPEDITION_CONFIG.maxStamina,
          merc.stamina + EXPEDITION_CONFIG.staminaRecoveryAmount
        );
        this.cb.updateMercenary(merc.id, merc);
      }
    }
  }

  // ---- 회복중 용병 체크 ----
  checkRecovery() {
    const now = Date.now();
    const mercenaries = this.cb.getAllMercenaries ? this.cb.getAllMercenaries() : [];
    for (const merc of mercenaries) {
      if (merc.status === 'recovering' && now >= (merc.recoverUntil || 0)) {
        merc.status = 'idle';
        this.cb.updateMercenary(merc.id, merc);
        this.emit('toast', { msg: `${merc.name}이(가) 회복 완료!`, type: 'info' });
      }
    }
  }

  // ---- UI용 스냅샷 ----
  getSnapshot() {
    const now = Date.now();
    return {
      activeExpeditions: this.activeExpeditions.map(e => ({
        ...e,
        progress: Math.min(1, (now - e.startTime) / e.duration),
        remainingMs: Math.max(0, e.duration - (now - e.startTime)),
      })),
      history: [...this.expeditionHistory],
    };
  }

  // ---- 상태 저장/복원 ----
  getState() {
    return {
      activeExpeditions: this.activeExpeditions,
      expeditionHistory: this.expeditionHistory,
      staminaTickCounter: this.staminaTickCounter,
    };
  }

  setState(state) {
    if (state.activeExpeditions) this.activeExpeditions = state.activeExpeditions;
    if (state.expeditionHistory) this.expeditionHistory = state.expeditionHistory;
    if (state.staminaTickCounter !== undefined) this.staminaTickCounter = state.staminaTickCounter;
  }
}
