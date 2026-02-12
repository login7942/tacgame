// ============================================================
// systems/crafting.js - 시간 기반 제작 시스템
// ============================================================
import { RECIPES, CRAFT_TIMES, DEFAULT_CRAFT_TIME, MASTERY_CONFIG } from '../data.js';
import { rand } from '../utils.js';

export class CraftingSystem {
  constructor(callbacks) {
    this.cb = callbacks;
  }

  // 제작 시작
  startCraft(recipeId) {
    const state = this.cb.getState();

    // 이미 제작 중이면 불가
    if (state.craftQueue) {
      this.cb.showToast('이미 제작 중입니다.', 'error');
      return false;
    }

    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) {
      this.cb.showToast('레시피가 없습니다.', 'error');
      return false;
    }

    if (!this.cb.canCraft(recipeId)) {
      this.cb.showToast('재료가 부족합니다.', 'error');
      return false;
    }

    // 제작 시간 가져오기 (초 → 밀리초)
    const craftTime = (CRAFT_TIMES[recipe.result] || DEFAULT_CRAFT_TIME) * 1000;

    // 재료 소모
    const maxEnhancement = this.cb.consumeIngredients(recipe);

    // 제작 큐에 추가
    const now = Date.now();
    state.craftQueue = {
      recipeId: recipeId,
      recipeName: recipe.name,
      recipeType: recipe.type,
      recipeResult: recipe.result,
      recipeAmount: recipe.amount,
      maxEnhancement: maxEnhancement,
      startTime: now,
      endTime: now + craftTime,
    };

    const craftTimeSec = CRAFT_TIMES[recipe.result] || DEFAULT_CRAFT_TIME;
    this.cb.showToast(`${recipe.name} 제작 시작! (${craftTimeSec}초)`, 'info');
    this.cb.onStateChanged();
    return true;
  }

  // 제작 취소
  cancelCraft() {
    const state = this.cb.getState();
    if (!state.craftQueue) return;

    const recipe = RECIPES.find(r => r.id === state.craftQueue.recipeId);
    if (recipe) {
      // 재료 환불
      this.cb.refundIngredients(recipe);
    }

    state.craftQueue = null;
    this.cb.showToast('제작이 취소되었습니다.', 'info');
    this.cb.onStateChanged();
  }

  // 제작 완료 확인
  checkCompletion() {
    const state = this.cb.getState();
    if (!state.craftQueue) return;

    const now = Date.now();
    if (now >= state.craftQueue.endTime) {
      this.completeCraft();
    }
  }

  // 제작 완료 처리
  completeCraft() {
    const state = this.cb.getState();
    if (!state.craftQueue) return;

    const q = state.craftQueue;
    const recipe = RECIPES.find(r => r.id === q.recipeId);
    if (!recipe) {
      state.craftQueue = null;
      return;
    }

    // 결과물 생성
    if (q.recipeType === 'equipment') {
      const newUid = this.cb.addEquipment(q.recipeResult);

      // 재료 장비 강화 계승
      if (q.maxEnhancement > 0) {
        const bonusLevel = Math.floor(q.maxEnhancement / 2);
        if (bonusLevel > 0) {
          this.cb.setEquipmentEnhancement(newUid, bonusLevel);
          this.cb.showToast(`재료 장비의 마력으로 +${bonusLevel} 강화 계승!`, 'success');
        }
      }

      // 숙련도 보너스: 대성공
      const craftMastery = this.cb.getCraftMastery(q.recipeId);
      const craftTier = this.cb.getMasteryTier(craftMastery);
      if (craftTier >= 3) {
        const gsChance = MASTERY_CONFIG.crafting.tier3Bonus.greatSuccessPercent / 100;
        if (Math.random() < gsChance) {
          const currentEnh = this.cb.getEquipmentEnhancement(newUid);
          this.cb.setEquipmentEnhancement(newUid, currentEnh + 1);
          this.cb.showToast(`✨ 대성공! +${currentEnh + 1} 강화로 완성!`, 'success');
        }
      }

      this.cb.showToast(`${q.recipeName} 제작 완료!`, 'success');
    } else {
      this.cb.addItem(q.recipeResult, q.recipeAmount);
      this.cb.showToast(`${q.recipeName} x${q.recipeAmount} 제작 완료!`, 'success');
    }

    this.cb.incrementCraftStats(q.recipeId);

    // 제작 큐 초기화
    state.craftQueue = null;
    this.cb.onStateChanged();
  }

  // 제작 진행 상황
  getProgress() {
    const state = this.cb.getState();
    if (!state.craftQueue) return null;

    const now = Date.now();
    const total = state.craftQueue.endTime - state.craftQueue.startTime;
    const elapsed = now - state.craftQueue.startTime;
    const remaining = Math.max(0, state.craftQueue.endTime - now);

    return {
      recipeName: state.craftQueue.recipeName,
      progress: Math.min(100, (elapsed / total) * 100),
      remainingSeconds: Math.ceil(remaining / 1000),
      isComplete: now >= state.craftQueue.endTime,
    };
  }
}
