// ============================================================
// systems/market.js - 독립 시장 시스템
// GameEngine과 콜백으로만 통신, 내부 상태 자체 관리
// ============================================================
import { RESOURCES, MARKET_BASE_PRICES } from '../data.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- 시장 시스템 ----
export class MarketSystem {
  /**
   * @param {Object} callbacks - 게임 엔진과의 인터페이스
   *   getPlayerGold()              → number
   *   consumeGold(amt)             → boolean
   *   addGold(amt)                 → void
   *   hasItem(id, amt)             → boolean
   *   removeItem(id, amt)          → boolean
   *   addItem(id, amt)             → void
   *   getItemName(id)              → string
   *   onStateChanged()             → void
   */
  constructor(callbacks) {
    this.cb = callbacks;
    this.listeners = {};

    // 내부 상태
    this.prices = {};
    this.trends = {};
    this.dailyPurchases = {}; // { itemId: count }
    this.lastResetDate = this.getTodayDate();
    this.investments = []; // [{ id, itemId, amount, predictedTrend, startPrice, startTime, duration }]
  }

  // ---- 이벤트 ----
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ---- 초기화 ----
  init() {
    if (Object.keys(this.prices).length === 0) {
      for (const [id, base] of Object.entries(MARKET_BASE_PRICES)) {
        this.prices[id] = base;
        this.trends[id] = 0; // -1, 0, 1
      }
    }
  }

  // ---- 가격 업데이트 ----
  updatePrices() {
    for (const [id, base] of Object.entries(MARKET_BASE_PRICES)) {
      const old = this.prices[id] || base;
      const volatility = 0.08 + (RESOURCES[id]?.tier || 1) * 0.02;
      const change = (Math.random() * 2 - 1) * volatility;
      let newPrice = old * (1 + change);
      // 가격 범위 제한 (기본가의 40% ~ 200%)
      newPrice = clamp(newPrice, base * 0.4, base * 2.0);
      newPrice = Math.round(newPrice * 10) / 10;
      this.trends[id] = newPrice > old ? 1 : newPrice < old ? -1 : 0;
      this.prices[id] = newPrice;
    }
    this.emit('marketUpdate', { prices: this.prices, trends: this.trends });
  }

  // ---- 일일 리셋 체크 ----
  getTodayDate() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  checkDailyReset() {
    const today = this.getTodayDate();
    if (this.lastResetDate !== today) {
      this.dailyPurchases = {};
      this.lastResetDate = today;
      this.emit('toast', { msg: '🌅 시장 일일 제한 초기화!', type: 'info' });
    }
  }

  // ---- 구매 ----
  buy(itemId, quantity) {
    this.checkDailyReset();

    const price = this.prices[itemId];
    if (!price) {
      this.emit('toast', { msg: '거래 불가능한 아이템입니다!', type: 'error' });
      return { success: false };
    }

    // 일일 구매 제한 체크
    const purchased = this.dailyPurchases[itemId] || 0;
    const DAILY_LIMIT = 50;
    let priceMultiplier = 1.1; // 기본 매입 수수료 10%

    if (purchased >= DAILY_LIMIT) {
      // 제한 초과 시 가격 2배
      priceMultiplier = 2.2; // 110% → 220%
      this.emit('toast', {
        msg: `⚠️ 일일 구매 제한 (${DAILY_LIMIT}개) 초과! 가격 2배 적용`,
        type: 'warning'
      });
    }

    const totalCost = Math.ceil(price * quantity * priceMultiplier);
    if (this.cb.getPlayerGold() < totalCost) {
      this.emit('toast', { msg: '골드가 부족합니다!', type: 'error' });
      return { success: false };
    }

    // 구매 실행
    this.cb.consumeGold(totalCost);
    this.cb.addItem(itemId, quantity);
    this.dailyPurchases[itemId] = purchased + quantity;

    // 대량 거래 영향 (100개 이상)
    if (quantity >= 100) {
      this.prices[itemId] *= 1.10; // +10% 가격 상승
      this.emit('toast', {
        msg: `📈 대량 구매로 ${this.cb.getItemName(itemId)} 가격 급등!`,
        type: 'warning'
      });
    } else {
      // 수요 증가 → 가격 약간 상승
      this.prices[itemId] *= 1.02;
    }

    const itemName = this.cb.getItemName(itemId);
    const remaining = Math.max(0, DAILY_LIMIT - this.dailyPurchases[itemId]);
    this.emit('toast', {
      msg: `${itemName} x${quantity} 구매! (-${totalCost}G) [오늘 남은 구매: ${remaining}개]`,
      type: 'success'
    });
    this.cb.onStateChanged();
    return { success: true };
  }

  // ---- 판매 ----
  sell(itemId, quantity) {
    const price = this.prices[itemId];
    if (!price) {
      this.emit('toast', { msg: '거래 불가능한 아이템입니다!', type: 'error' });
      return { success: false };
    }

    if (!this.cb.hasItem(itemId, quantity)) {
      this.emit('toast', { msg: '수량이 부족합니다!', type: 'error' });
      return { success: false };
    }

    const totalGain = Math.floor(price * quantity * 0.9); // 매도 수수료 10%
    this.cb.removeItem(itemId, quantity);
    this.cb.addGold(totalGain);

    // 대량 거래 영향 (100개 이상)
    if (quantity >= 100) {
      this.prices[itemId] *= 0.90; // -10% 가격 하락
      this.emit('toast', {
        msg: `📉 대량 판매로 ${this.cb.getItemName(itemId)} 가격 급락!`,
        type: 'warning'
      });
    } else {
      // 공급 증가 → 가격 약간 하락
      this.prices[itemId] *= 0.98;
    }

    const itemName = this.cb.getItemName(itemId);
    this.emit('toast', {
      msg: `${itemName} x${quantity} 판매! (+${totalGain}G)`,
      type: 'success'
    });
    this.cb.onStateChanged();
    return { success: true };
  }

  // ---- 투자 시스템 ----
  invest(itemId, amount, predictedTrend) {
    // predictedTrend: 'up' or 'down'
    if (this.cb.getPlayerGold() < amount) {
      this.emit('toast', { msg: '골드가 부족합니다!', type: 'error' });
      return { success: false };
    }

    const price = this.prices[itemId];
    if (!price) {
      this.emit('toast', { msg: '투자 불가능한 아이템입니다!', type: 'error' });
      return { success: false };
    }

    // 골드 소모
    this.cb.consumeGold(amount);

    // 투자 등록
    const investment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      itemId,
      amount,
      predictedTrend, // 'up' or 'down'
      startPrice: price,
      startTime: Date.now(),
      duration: 24 * 60 * 60 * 1000, // 24시간 (밀리초)
    };

    this.investments.push(investment);

    const itemName = this.cb.getItemName(itemId);
    const trendText = predictedTrend === 'up' ? '상승' : '하락';
    this.emit('toast', {
      msg: `💰 ${itemName} 가격 ${trendText} 예측! ${amount}G 투자 (24시간 후 결과)`,
      type: 'info'
    });
    this.cb.onStateChanged();
    return { success: true, investment };
  }

  // ---- 투자 결과 체크 (tick마다 호출) ----
  checkInvestments() {
    const now = Date.now();
    const completed = [];

    for (let i = this.investments.length - 1; i >= 0; i--) {
      const inv = this.investments[i];
      const elapsed = now - inv.startTime;

      if (elapsed >= inv.duration) {
        // 투자 완료!
        const currentPrice = this.prices[inv.itemId];
        const actualTrend = currentPrice > inv.startPrice ? 'up' : currentPrice < inv.startPrice ? 'down' : 'flat';

        let result = 'fail';
        let returnAmount = 0;

        if (inv.predictedTrend === actualTrend) {
          // 예측 성공! +50% 수익
          result = 'success';
          returnAmount = Math.floor(inv.amount * 1.5);
        } else if (actualTrend === 'flat') {
          // 변동 없음: 원금 환불
          result = 'neutral';
          returnAmount = inv.amount;
        } else {
          // 예측 실패: -30% 손실
          result = 'fail';
          returnAmount = Math.floor(inv.amount * 0.7);
        }

        this.cb.addGold(returnAmount);

        const itemName = this.cb.getItemName(inv.itemId);
        const profit = returnAmount - inv.amount;
        const profitText = profit > 0 ? `+${profit}G` : profit < 0 ? `${profit}G` : '±0G';

        if (result === 'success') {
          this.emit('toast', {
            msg: `✅ 투자 성공! ${itemName} 가격 예측 적중! (${profitText})`,
            type: 'success'
          });
        } else if (result === 'neutral') {
          this.emit('toast', {
            msg: `➖ 투자 무효! ${itemName} 가격 변동 없음 (원금 환불)`,
            type: 'info'
          });
        } else {
          this.emit('toast', {
            msg: `❌ 투자 실패! ${itemName} 가격 예측 빗나감 (${profitText})`,
            type: 'error'
          });
        }

        completed.push(inv);
        this.investments.splice(i, 1);
      }
    }

    if (completed.length > 0) {
      this.cb.onStateChanged();
    }

    return completed;
  }

  // ---- 접근자 ----
  getPrice(itemId) {
    return this.prices[itemId] || 0;
  }

  getTrend(itemId) {
    return this.trends[itemId] || 0;
  }

  getDailyPurchased(itemId) {
    this.checkDailyReset();
    return this.dailyPurchases[itemId] || 0;
  }

  getDailyRemaining(itemId) {
    return Math.max(0, 50 - this.getDailyPurchased(itemId));
  }

  getActiveInvestments() {
    return this.investments.map(inv => ({
      ...inv,
      itemName: this.cb.getItemName(inv.itemId),
      remaining: Math.max(0, inv.duration - (Date.now() - inv.startTime)),
    }));
  }

  // ---- 상태 저장/복원 ----
  getState() {
    return {
      prices: this.prices,
      trends: this.trends,
      dailyPurchases: this.dailyPurchases,
      lastResetDate: this.lastResetDate,
      investments: this.investments,
    };
  }

  setState(state) {
    if (state.prices) this.prices = state.prices;
    if (state.trends) this.trends = state.trends;
    if (state.dailyPurchases) this.dailyPurchases = state.dailyPurchases;
    if (state.lastResetDate) this.lastResetDate = state.lastResetDate;
    if (state.investments) this.investments = state.investments;
  }
}
