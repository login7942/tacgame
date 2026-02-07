// ============================================================
// ui.js - UI 렌더링 및 이벤트 핸들링
// ============================================================
import { RESOURCES, EQUIPMENT, ZONES, MONSTERS, RECIPES, VEHICLES,
         WORKER_TYPES, HIRE_COSTS, ENV_NAMES, MARKET_BASE_PRICES,
         EXP_TABLE } from './data.js';

export class GameUI {
  constructor(engine) {
    this.engine = engine;
    this.currentTab = 'zones';
    this.inventoryFilter = 'all';
    this.craftingFilter = 'all';
    this.selectedWorker = null;
    this.marketQuantities = {};
    this.init();
  }

  init() {
    this.bindTabs();
    this.bindEvents();
    this.engine.on('tick', () => this.updateTopBar());
    this.engine.on('stateChanged', () => this.renderCurrentTab());
    this.engine.on('toast', (t) => this.showToast(t.msg, t.type));
    this.engine.on('death', (d) => this.showDeathScreen(d));
    this.engine.on('combatStart', () => this.renderCurrentTab());
    this.renderCurrentTab();
    this.updateTopBar();
  }

  // ---- 탭 ----
  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById(`panel-${tab}`).classList.add('active');
        this.currentTab = tab;
        this.renderCurrentTab();
      });
    });

    // 마우스 드래그 스크롤
    const nav = document.getElementById('tab-nav');
    let isDown = false, startX, scrollLeft, hasDragged = false;
    nav.addEventListener('mousedown', (e) => {
      isDown = true; hasDragged = false;
      startX = e.pageX - nav.offsetLeft;
      scrollLeft = nav.scrollLeft;
      nav.style.cursor = 'grabbing';
    });
    nav.addEventListener('mouseleave', () => { isDown = false; nav.style.cursor = ''; });
    nav.addEventListener('mouseup', () => { isDown = false; nav.style.cursor = ''; });
    nav.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - nav.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 3) hasDragged = true;
      nav.scrollLeft = scrollLeft - walk;
    });
    // 드래그 중 클릭 방지
    nav.addEventListener('click', (e) => {
      if (hasDragged) { e.stopPropagation(); hasDragged = false; }
    }, true);
  }

  renderCurrentTab() {
    switch (this.currentTab) {
      case 'zones': this.renderZones(); break;
      case 'inventory': this.renderInventory(); break;
      case 'crafting': this.renderCrafting(); break;
      case 'workers': this.renderWorkers(); break;
      case 'combat': this.renderCombat(); break;
      case 'vehicles': this.renderVehicles(); break;
      case 'codex': this.renderCodex(); break;
      case 'missions': this.renderMissions(); break;
      case 'market': this.renderMarket(); break;
    }
    this.updateTopBar();
  }

  // ---- 상단 바 ----
  updateTopBar() {
    const s = this.engine.getState();
    if (!s) return;
    const p = s.player;
    // HP
    document.querySelector('.hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
    document.querySelector('#hp-meter .meter-text').textContent = `${Math.floor(p.hp)}/${p.maxHp}`;
    // Hunger
    document.querySelector('.hunger-fill').style.width = `${(p.hunger / p.maxHunger) * 100}%`;
    document.querySelector('#hunger-meter .meter-text').textContent = `${Math.floor(p.hunger)}/${p.maxHunger}`;
    // Stamina
    document.querySelector('.stamina-fill').style.width = `${(p.stamina / p.maxStamina) * 100}%`;
    document.querySelector('#stamina-meter .meter-text').textContent = `${Math.floor(p.stamina)}/${p.maxStamina}`;
    // Gold, Level, Legacy
    document.getElementById('gold-display').textContent = `💰 ${p.gold.toLocaleString()}`;
    document.getElementById('level-display').textContent = `Lv.${p.level}`;
    document.getElementById('legacy-display').textContent = `⭐ ${p.legacyPoints}`;
  }

  // ---- 지역 탭 ----
  renderZones() {
    const s = this.engine.getState();
    if (!s) return;
    const visibleZones = this.engine.getVisibleZones();
    const currentZone = ZONES[s.player.currentZone];

    // 현재 지역 정보
    const infoEl = document.getElementById('current-zone-info');
    if (currentZone) {
      const deployedCount = s.workers.filter(w => w.deployedZone === s.player.currentZone).length;
      const gatherSnap = this.engine.getGatherSnapshot();
      const isAutoGathering = gatherSnap.active;

      infoEl.innerHTML = `
        <div class="zone-detail">
          <div class="zone-detail-header">
            <span class="zone-detail-icon">${currentZone.icon}</span>
            <div>
              <div class="zone-detail-title">${currentZone.name} <span class="text-muted">(Tier ${currentZone.tier})</span></div>
              <div class="zone-detail-desc">${currentZone.desc}</div>
            </div>
          </div>
          <div class="zone-resources-preview">
            ${currentZone.resources.map(r => `<span class="zone-res-tag">${this.engine.getItemIcon(r)} ${this.engine.getItemName(r)}</span>`).join('')}
          </div>
          ${currentZone.environment ? `<div style="font-size:11px;color:#e67e22;margin-bottom:6px;">${ENV_NAMES[currentZone.environment] || currentZone.environment} 환경 (피해: ${currentZone.hazardDmg}/초)</div>` : ''}
          <div style="font-size:11px;color:#4fc3f7;margin-bottom:6px;">👷 일꾼 ${deployedCount}/${currentZone.workerSlots} 배치</div>

          ${isAutoGathering ? `
          <div class="auto-session-panel" style="margin-bottom:8px;">
            <div class="auto-session-header">
              <span class="auto-badge">🔄 자동채집 중</span>
              <span class="auto-speed-badge">${(gatherSnap.interval / 1000).toFixed(1)}초</span>
            </div>
            <div class="auto-session-stats">
              <span>📦 ${gatherSnap.session.totalCount}개</span>
              <span>⏱️ ${Math.floor((Date.now() - gatherSnap.session.startTime) / 1000)}초</span>
            </div>
            ${Object.keys(gatherSnap.session.gathered).length > 0 ? `
            <div class="auto-session-loot">
              ${Object.entries(gatherSnap.session.gathered).map(([id,amt]) =>
                `${this.engine.getItemIcon(id)}${amt}`
              ).join(' ')}
            </div>` : ''}
          </div>` : ''}

          <div style="display:flex;gap:6px;">
            <button class="btn btn-success gather-btn" id="btn-gather" ${isAutoGathering ? 'disabled' : ''}>🔨 채집하기</button>
            <button class="btn ${isAutoGathering ? 'btn-danger' : 'btn-primary'}" id="btn-auto-gather">
              ${isAutoGathering ? '⏹️ 중단' : '🔄 자동채집'}
            </button>
            ${!isAutoGathering ? `<button class="btn btn-small btn-warning" id="btn-auto-settings">⚙️</button>` : ''}
          </div>
        </div>`;

      document.getElementById('btn-gather')?.addEventListener('click', () => {
        this.engine.gatherResource();
      });
      document.getElementById('btn-auto-gather')?.addEventListener('click', () => {
        if (isAutoGathering) {
          this.engine.stopAutoGather();
        } else {
          this.engine.startAutoGather();
        }
      });
      document.getElementById('btn-auto-settings')?.addEventListener('click', () => {
        this.showAutoGatherSettings();
      });
    }

    // 지역 리스트
    const listEl = document.getElementById('zone-list');
    let html = '';
    for (const zId of Object.keys(ZONES)) {
      const zone = ZONES[zId];
      const unlocked = s.unlockedZones.includes(zId);
      const canEnter = this.engine.canEnterZone(zId);
      const isCurrent = s.player.currentZone === zId;
      const visible = visibleZones.includes(zId);
      if (!visible) continue;

      const deployedCount = s.workers.filter(w => w.deployedZone === zId).length;

      html += `
        <div class="zone-card ${isCurrent ? 'active' : ''} ${!unlocked && !canEnter.ok ? 'locked' : ''}"
             data-zone="${zId}">
          ${!canEnter.ok && !unlocked ? `<div class="zone-lock-overlay">🔒</div>` : ''}
          <span class="zone-icon">${zone.icon}</span>
          <span class="zone-name">${zone.name}</span>
          <span class="zone-tier">Tier ${zone.tier}</span>
          ${zone.environment ? `<span class="zone-env">${ENV_NAMES[zone.environment] || ''}</span>` : ''}
          ${deployedCount > 0 ? `<div class="zone-workers">👷 ${deployedCount}/${zone.workerSlots}</div>` : ''}
          ${!canEnter.ok && !isCurrent ? `<div style="font-size:9px;color:#e74c3c;margin-top:4px;">${canEnter.reason}</div>` : ''}
        </div>`;
    }
    listEl.innerHTML = html;

    // 클릭 이벤트
    listEl.querySelectorAll('.zone-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const zId = card.dataset.zone;
        if (zId !== s.player.currentZone) {
          this.engine.enterZone(zId);
        }
      });
    });
  }

  // ---- 인벤토리 탭 ----
  renderInventory() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('inventory-list');

    // 필터 버튼
    this.bindFilterButtons('#panel-inventory', (filter) => {
      this.inventoryFilter = filter;
      this.renderInventory();
    }, this.inventoryFilter);

    let items = [];
    // 자원
    for (const [id, count] of Object.entries(s.inventory)) {
      if (count <= 0) continue;
      const res = RESOURCES[id];
      if (!res) continue;
      items.push({ id, count, name: res.name, icon: res.icon, tier: res.tier, type: res.crafted ? 'material' : 'resource', category: res.category });
    }
    // 장비 (개별 인스턴스)
    for (const eq of s.equipment) {
      const base = EQUIPMENT[eq.baseId];
      if (!base) continue;
      const displayName = this.engine.enhancement.formatEquipmentName(eq);
      items.push({
        id: eq.uid, // uid 사용
        uid: eq.uid,
        count: 1,
        name: displayName,
        icon: base.icon,
        tier: base.tier,
        type: 'equipment',
        category: base.type,
        enhancement: eq.enhancement || 0,
      });
    }

    // 필터
    if (this.inventoryFilter !== 'all') {
      items = items.filter(i => i.type === this.inventoryFilter);
    }

    // 정렬: tier desc, name
    items.sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));

    if (items.length === 0) {
      listEl.innerHTML = '<div class="text-center text-muted" style="padding:40px;">인벤토리가 비어있습니다.</div>';
      return;
    }

    listEl.innerHTML = items.map(item => `
      <div class="item-slot tier-${item.tier}" data-id="${item.id}" data-type="${item.type}">
        <span class="item-icon">${item.icon}</span>
        <span class="item-name">${item.name}</span>
        <span class="item-count">x${item.count}</span>
      </div>
    `).join('');

    listEl.querySelectorAll('.item-slot').forEach(el => {
      el.addEventListener('click', () => {
        this.showItemDetail(el.dataset.id, el.dataset.type);
      });
    });
  }

  showItemDetail(itemId, type) {
    const s = this.engine.getState();
    let html = '';

    if (type === 'equipment') {
      const uid = itemId; // itemId는 이제 uid
      const eqInstance = this.engine.getEquipmentByUid(uid);
      if (!eqInstance) return;
      const eq = EQUIPMENT[eqInstance.baseId];
      if (!eq) return;

      const isEquipped = Object.values(s.equippedGear).includes(uid);
      const displayName = this.engine.enhancement.formatEquipmentName(eqInstance);
      const enhanceLevel = eqInstance.enhancement || 0;
      const enhancedStats = this.engine.getEnhancedEquipmentStats(uid);
      const enhanceInfo = this.engine.getEnhanceInfo(uid);

      html = `
        <div class="modal-title">${eq.icon} ${displayName}</div>
        <div class="text-muted mb-8">${eq.desc}</div>

        ${enhanceLevel > 0 ? `
        <div class="modal-section" style="background:rgba(76,175,80,0.1);padding:8px;border-radius:4px;margin-bottom:8px;">
          <div style="color:#4caf50;font-weight:600;font-size:12px;">✨ 강화 보너스: +${Math.round((this.engine.enhancement.getEnhancementBonus(enhanceLevel) - 1) * 100)}%</div>
        </div>` : ''}

        <div class="modal-section">
          <div class="modal-section-title">스탯 ${enhanceLevel > 0 ? `<span class="text-muted" style="font-size:11px;">(강화 적용됨)</span>` : ''}</div>
          ${Object.entries(enhancedStats).map(([k,v]) => {
            const baseValue = eq.stats[k] || 0;
            const bonus = v - baseValue;
            return `
            <div class="modal-stat-row">
              <span class="modal-stat-label">${this.statName(k)}</span>
              <span class="modal-stat-value text-green">
                +${v}${bonus > 0 ? ` <span class="text-purple">(+${bonus})</span>` : ''}
              </span>
            </div>`;
          }).join('')}
        </div>

        ${Object.keys(eq.resistances).length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title">저항</div>
          ${Object.entries(eq.resistances).map(([k,v]) => `
            <div class="resist-bar resist-${k}">
              <span class="resist-label">${ENV_NAMES[k] || k}</span>
              <div class="resist-track"><div class="resist-fill" style="width:${Math.min(v,100)}%"></div></div>
              <span>${v}</span>
            </div>`).join('')}
        </div>` : ''}

        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn ${isEquipped ? 'btn-warning' : 'btn-primary'}" id="modal-equip">${isEquipped ? '해제' : '장착'}</button>
          ${enhanceInfo.canEnhance ? `<button class="btn btn-success" id="modal-enhance">💎 강화 (+${enhanceLevel} → +${enhanceLevel+1})</button>` : ''}
          <button class="btn btn-danger btn-small" id="modal-vault">계승 보관</button>
        </div>`;
    } else {
      const res = RESOURCES[itemId];
      if (!res) return;
      const count = s.inventory[itemId] || 0;
      const isFood = ['cooked_meat','raw_meat','fish','herb_potion','mushroom','herb','cactus','fire_potion','ice_potion'].includes(itemId);
      html = `
        <div class="modal-title">${res.icon} ${res.name}</div>
        <div class="modal-stat-row"><span class="modal-stat-label">보유량</span><span class="modal-stat-value">${count}</span></div>
        <div class="modal-stat-row"><span class="modal-stat-label">등급</span><span class="modal-stat-value">Tier ${res.tier}</span></div>
        <div class="modal-stat-row"><span class="modal-stat-label">분류</span><span class="modal-stat-value">${res.category}</span></div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          ${isFood ? `<button class="btn btn-success" id="modal-use-food">사용하기</button>` : ''}
          <button class="btn btn-danger btn-small" id="modal-vault">계승 보관</button>
        </div>`;
    }

    this.showModal(html);

    document.getElementById('modal-equip')?.addEventListener('click', () => {
      this.engine.equipItem(itemId);
      this.closeModal();
    });
    document.getElementById('modal-enhance')?.addEventListener('click', () => {
      this.showEnhanceModal(itemId);
    });
    document.getElementById('modal-use-food')?.addEventListener('click', () => {
      this.engine.useFood(itemId);
      this.closeModal();
    });
    document.getElementById('modal-vault')?.addEventListener('click', () => {
      this.engine.addToVault(itemId, 1);
      this.closeModal();
    });
  }

  showEnhanceModal(uid) {
    const s = this.engine.getState();
    const eqInstance = this.engine.getEquipmentByUid(uid);
    if (!eqInstance) return;
    const eq = EQUIPMENT[eqInstance.baseId];
    if (!eq) return;

    const enhanceInfo = this.engine.getEnhanceInfo(uid);
    if (!enhanceInfo) return;

    const displayName = this.engine.enhancement.formatEquipmentName(eqInstance);
    const currentLevel = enhanceInfo.currentLevel;
    const nextLevel = currentLevel + 1;
    const successRate = Math.round(enhanceInfo.successRate * 100);
    const material = enhanceInfo.material;
    const cost = enhanceInfo.cost;

    const hasMaterial = this.engine.hasItem(material.id, material.amount);
    const hasGold = s.player.gold >= cost;
    const canEnhance = hasMaterial && hasGold;

    // 실패 시 패널티 설명
    let failurePenalty = '';
    if (currentLevel <= 5) {
      failurePenalty = '강화도 유지';
    } else if (currentLevel <= 7) {
      failurePenalty = '50% 확률로 강화도 -1';
    } else {
      failurePenalty = '<span class="text-red">강화도 -1 또는 30% 파괴</span>';
    }

    const html = `
      <div class="modal-title">💎 장비 강화</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">${eq.icon} ${displayName}</div>

      <div class="modal-section">
        <div class="modal-section-title">강화 정보</div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">현재 강화</span>
          <span class="modal-stat-value">+${currentLevel}</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">목표 강화</span>
          <span class="modal-stat-value text-green">+${nextLevel}</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">성공 확률</span>
          <span class="modal-stat-value ${successRate >= 70 ? 'text-green' : successRate >= 50 ? 'text-yellow' : 'text-red'}">${successRate}%</span>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">필요 재료</div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">${this.engine.getItemIcon(material.id)} ${material.name}</span>
          <span class="modal-stat-value ${hasMaterial ? 'text-green' : 'text-red'}">${this.engine.getItemCount(material.id)} / ${material.amount}</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">💰 골드</span>
          <span class="modal-stat-value ${hasGold ? 'text-green' : 'text-red'}">${s.player.gold.toLocaleString()} / ${cost.toLocaleString()}</span>
        </div>
      </div>

      <div class="modal-section" style="font-size:11px;color:#889;">
        <div><strong>💡 강화 규칙:</strong></div>
        <div>• 성공 시: 스탯 +7% 증가</div>
        <div>• 실패 시: ${failurePenalty}</div>
        ${currentLevel >= 8 ? '<div class="text-red">⚠️ 고강화 구간! 파괴 위험!</div>' : ''}
      </div>

      <button class="btn ${canEnhance ? 'btn-success' : 'btn-disabled'}" id="btn-confirm-enhance" ${!canEnhance ? 'disabled' : ''} style="width:100%;margin-top:12px;">
        ✨ 강화 시도 (${successRate}%)
      </button>
    `;

    this.showModal(html);

    document.getElementById('btn-confirm-enhance')?.addEventListener('click', () => {
      this.closeModal();
      const result = this.engine.enhanceEquipment(uid);
      // 결과는 toast로 표시됨
      if (result.success || result.destroyed) {
        // 성공하거나 파괴되면 인벤토리 갱신
        this.renderCurrentTab();
      } else {
        // 실패 시 다시 강화 모달 표시
        setTimeout(() => {
          // 장비가 파괴되지 않았으면 다시 보여주기
          const stillExists = this.engine.getEquipmentByUid(uid);
          if (stillExists) {
            this.showItemDetail(uid, 'equipment');
          }
        }, 100);
      }
    });
  }

  // ---- 제작 탭 ----
  renderCrafting() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('recipe-list');

    this.bindFilterButtons('#panel-crafting', (filter) => {
      this.craftingFilter = filter;
      this.renderCrafting();
    }, this.craftingFilter);

    let recipes = [...RECIPES];
    if (this.craftingFilter !== 'all') {
      recipes = recipes.filter(r => r.type === this.craftingFilter);
    }

    listEl.innerHTML = recipes.map(recipe => {
      const canCraft = this.engine.canCraft(recipe.id);
      const maxCraftable = this.engine.getMaxCraftableAmount(recipe.id);
      const resultIcon = this.engine.getItemIcon(recipe.result);
      const ingredients = recipe.ingredients.map(ing => {
        const has = this.engine.hasItem(ing.id, ing.amount);
        const current = this.engine.getItemCount(ing.id);
        return `<span class="recipe-ingredient ${has ? 'has' : 'missing'}">${this.engine.getItemIcon(ing.id)} ${this.engine.getItemName(ing.id)} ${current}/${ing.amount}</span>`;
      }).join('');

      return `
        <div class="recipe-card ${canCraft ? 'craftable' : ''}" data-recipe="${recipe.id}">
          <span class="recipe-icon">${resultIcon}</span>
          <div class="recipe-info">
            <div class="recipe-name">${recipe.name}${recipe.amount > 1 ? ` x${recipe.amount}` : ''}</div>
            <div class="recipe-ingredients">${ingredients}</div>
            ${maxCraftable > 1 ? `<div style="font-size:10px;color:#4fc3f7;margin-top:2px;">최대 ${maxCraftable}개 제작 가능</div>` : ''}
          </div>
          <button class="btn btn-primary btn-small craft-btn" ${!canCraft ? 'disabled' : ''} data-recipe="${recipe.id}">제작</button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const recipeId = btn.dataset.recipe;
        this.showCraftModal(recipeId);
      });
    });
  }

  showCraftModal(recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    const s = this.engine.getState();
    const maxCraftable = this.engine.getMaxCraftableAmount(recipeId);
    const resultIcon = this.engine.getItemIcon(recipe.result);

    const ingredients = recipe.ingredients.map(ing => {
      const has = this.engine.hasItem(ing.id, ing.amount);
      const current = this.engine.getItemCount(ing.id);
      const perCraft = ing.amount;
      return `
        <div class="modal-stat-row">
          <span class="modal-stat-label">${this.engine.getItemIcon(ing.id)} ${this.engine.getItemName(ing.id)}</span>
          <span class="modal-stat-value ${has ? 'text-green' : 'text-red'}">${current} / ${perCraft} (개당)</span>
        </div>`;
    }).join('');

    const html = `
      <div class="modal-title">${resultIcon} ${recipe.name} 제작</div>
      <div class="text-muted mb-8">${recipe.type === 'equipment' ? '장비' : '아이템'} | ${recipe.amount > 1 ? `${recipe.amount}개씩 생성` : ''}</div>

      <div class="modal-section">
        <div class="modal-section-title">필요 재료</div>
        ${ingredients}
      </div>

      <div class="modal-section">
        <div class="modal-section-title">제작 수량 <span class="text-muted" style="font-size:11px;">(최대: ${maxCraftable})</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <button class="btn btn-small craft-qty-btn btn-primary" data-qty="1">x1</button>
          ${maxCraftable >= 5 ? `<button class="btn btn-small craft-qty-btn" data-qty="5">x5</button>` : ''}
          ${maxCraftable >= 10 ? `<button class="btn btn-small craft-qty-btn" data-qty="10">x10</button>` : ''}
          ${maxCraftable >= 50 ? `<button class="btn btn-small craft-qty-btn" data-qty="50">x50</button>` : ''}
          ${maxCraftable > 1 ? `<button class="btn btn-small craft-qty-btn" data-qty="${maxCraftable}">✨ 최대 (${maxCraftable})</button>` : ''}
        </div>
      </div>

      <button class="btn btn-success" id="btn-craft-confirm" style="width:100%;margin-top:8px;">🔨 제작하기</button>
    `;

    this.showModal(html);

    let selectedQty = 1;

    document.querySelectorAll('.craft-qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.craft-qty-btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        selectedQty = parseInt(btn.dataset.qty);
      });
    });

    document.getElementById('btn-craft-confirm')?.addEventListener('click', () => {
      this.closeModal();
      if (selectedQty === 1) {
        this.engine.craft(recipeId);
      } else {
        this.engine.craftMultiple(recipeId, selectedQty);
      }
    });
  }

  // ---- 일꾼 탭 ----
  renderWorkers() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('worker-list');
    const deployEl = document.getElementById('deploy-status');

    // 고용 버튼
    document.getElementById('btn-hire-worker').onclick = () => {
      this.showHireModal();
    };

    // 일꾼 리스트
    if (s.workers.length === 0) {
      listEl.innerHTML = '<div class="text-center text-muted" style="padding:20px;">고용된 일꾼이 없습니다.</div>';
    } else {
      listEl.innerHTML = s.workers.map(w => {
        const wType = WORKER_TYPES[w.type];
        const eff = w.deployedZone ? this.engine.getWorkerEfficiency(w).toFixed(2) : '-';
        const zoneName = w.deployedZone ? ZONES[w.deployedZone]?.name : '대기 중';
        return `
          <div class="worker-card" data-worker="${w.id}">
            <div class="worker-header">
              <span class="worker-name">${wType.icon} ${w.name} <span class="text-muted">Lv.${w.level}</span></span>
              <span class="worker-type">${wType.name}</span>
            </div>
            <div class="worker-stats">
              <span><span class="stat-label">힘</span> <span class="stat-value">${w.stats.str}</span></span>
              <span><span class="stat-label">민첩</span> <span class="stat-value">${w.stats.dex}</span></span>
              <span><span class="stat-label">지능</span> <span class="stat-value">${w.stats.int}</span></span>
              <span><span class="stat-label">체력</span> <span class="stat-value">${w.stats.vit}</span></span>
              <span><span class="stat-label">행운</span> <span class="stat-value">${w.stats.luck}</span></span>
            </div>
            <div class="worker-deploy-info">
              📍 ${zoneName} ${w.deployedZone ? `| 효율: x${eff}` : ''}
              ${w.gatherCount > 0 ? `| 수집: ${w.gatherCount}` : ''}
            </div>
            ${w.deployedZone ? `
            <div class="worker-maintenance">
              <div class="worker-maint-row">
                <span>🍖</span>
                <div class="mini-bar"><div class="mini-fill${(w.hunger || 0) < 30 ? ' warning' : ''}" style="width:${w.hunger || 0}%"></div></div>
                <span class="mini-label">${Math.floor(w.hunger || 0)}%</span>
              </div>
              <div class="worker-maint-row">
                <span>🔧</span>
                <div class="mini-bar"><div class="mini-fill${(w.toolDurability || 0) < 50 ? ' warning' : ''}" style="width:${((w.toolDurability || 0) / (w.maxToolDurability || 500)) * 100}%"></div></div>
                <span class="mini-label">${w.toolDurability || 0}/${w.maxToolDurability || 500}</span>
              </div>
            </div>` : ''}
          </div>`;
      }).join('');

      listEl.querySelectorAll('.worker-card').forEach(card => {
        card.addEventListener('click', () => {
          this.showWorkerDetail(card.dataset.worker);
        });
      });
    }

    // 배치 현황
    const zoneGroups = {};
    for (const w of s.workers) {
      if (!w.deployedZone) continue;
      if (!zoneGroups[w.deployedZone]) zoneGroups[w.deployedZone] = [];
      zoneGroups[w.deployedZone].push(w);
    }
    if (Object.keys(zoneGroups).length === 0) {
      deployEl.innerHTML = '<div class="text-muted" style="padding:10px;font-size:12px;">배치된 일꾼이 없습니다.</div>';
    } else {
      deployEl.innerHTML = Object.entries(zoneGroups).map(([zId, workers]) => {
        const zone = ZONES[zId];
        return `
          <div class="deploy-zone">
            <div class="deploy-zone-name">${zone.icon} ${zone.name} (${workers.length}/${zone.workerSlots})</div>
            ${workers.map(w => {
              const eff = this.engine.getWorkerEfficiency(w).toFixed(2);
              return `<div class="deploy-worker-row">
                <span>${WORKER_TYPES[w.type].icon} ${w.name} Lv.${w.level}</span>
                <span class="deploy-efficiency">x${eff}</span>
              </div>`;
            }).join('')}
          </div>`;
      }).join('');
    }
  }

  showHireModal() {
    const s = this.engine.getState();
    const html = `
      <div class="modal-title">일꾼 고용</div>
      <div class="text-muted mb-8">보유 골드: ${s.player.gold.toLocaleString()}G</div>
      ${Object.entries(WORKER_TYPES).map(([type, wt]) => `
        <div class="recipe-card" style="margin-bottom:6px;">
          <span class="recipe-icon">${wt.icon}</span>
          <div class="recipe-info">
            <div class="recipe-name">${wt.name}</div>
            <div style="font-size:10px;color:#889;">${wt.desc}</div>
            <div style="font-size:11px;color:#f9d71c;">💰 ${HIRE_COSTS[type]}G</div>
          </div>
          <button class="btn btn-primary btn-small hire-btn" data-type="${type}"
            ${s.player.gold < HIRE_COSTS[type] ? 'disabled' : ''}>고용</button>
        </div>
      `).join('')}
    `;
    this.showModal(html);
    document.querySelectorAll('.hire-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.engine.hireWorker(btn.dataset.type);
        this.closeModal();
      });
    });
  }

  showWorkerDetail(workerId) {
    const s = this.engine.getState();
    const w = s.workers.find(x => x.id === workerId);
    if (!w) return;
    const wType = WORKER_TYPES[w.type];

    const equipSlots = ['weapon','armor','tool','accessory'];
    const slotNames = { weapon:'무기', armor:'방어구', tool:'도구', accessory:'악세서리' };

    // 장착 가능한 장비 목록 (uid 기반)
    const availableEquip = s.equipment.filter(eqInstance => {
      const uid = eqInstance.uid;
      const eq = EQUIPMENT[eqInstance.baseId];
      if (!eq) return false;
      // 플레이어가 끼고있으면 제외
      if (Object.values(s.equippedGear).includes(uid)) return false;
      // 다른 일꾼이 끼고있으면 제외
      for (const ow of s.workers) {
        if (ow.id !== workerId && Object.values(ow.equipment).includes(uid)) return false;
      }
      return true;
    });

    const html = `
      <div class="modal-title">${wType.icon} ${w.name} <span class="text-muted">Lv.${w.level}</span></div>
      <div class="text-muted mb-8">${wType.name} | EXP: ${w.exp}/${w.level * 20}</div>

      <div class="modal-section">
        <div class="modal-section-title">능력치</div>
        <div class="worker-stats" style="gap:12px;">
          <span><span class="stat-label">힘</span> <span class="stat-value">${w.stats.str}</span></span>
          <span><span class="stat-label">민첩</span> <span class="stat-value">${w.stats.dex}</span></span>
          <span><span class="stat-label">지능</span> <span class="stat-value">${w.stats.int}</span></span>
          <span><span class="stat-label">체력</span> <span class="stat-value">${w.stats.vit}</span></span>
          <span><span class="stat-label">행운</span> <span class="stat-value">${w.stats.luck}</span></span>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">장비</div>
        <div class="equip-slots">
          ${equipSlots.map(slot => {
            const uid = w.equipment[slot];
            const eqInstance = uid ? this.engine.getEquipmentByUid(uid) : null;
            const eq = eqInstance ? EQUIPMENT[eqInstance.baseId] : null;
            const displayName = eqInstance ? this.engine.enhancement.formatEquipmentName(eqInstance) : slotNames[slot];
            return `<div class="equip-slot ${eq ? 'filled' : ''}" data-slot="${slot}">
              <span class="slot-icon">${eq ? eq.icon : '➕'}</span>
              <span class="slot-label">${displayName}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">배치</div>
        ${w.deployedZone ? `
          <div style="font-size:12px;margin-bottom:6px;">현재: ${ZONES[w.deployedZone]?.icon} ${ZONES[w.deployedZone]?.name} (효율: x${this.engine.getWorkerEfficiency(w).toFixed(2)})</div>
          <button class="btn btn-warning btn-small" id="modal-recall">복귀</button>
        ` : `
          <div style="font-size:12px;margin-bottom:6px;">배치되지 않음</div>
        `}
        <div style="margin-top:8px;">
          <select id="modal-deploy-zone" style="background:#0a0e17;border:1px solid #2a3550;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;width:100%;">
            <option value="">-- 지역 선택 --</option>
            ${s.unlockedZones.map(zId => {
              const z = ZONES[zId];
              const count = s.workers.filter(x => x.deployedZone === zId).length;
              return `<option value="${zId}">${z.icon} ${z.name} (${count}/${z.workerSlots})</option>`;
            }).join('')}
          </select>
          <button class="btn btn-primary btn-small mt-8" id="modal-deploy">배치하기</button>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">유지비</div>
        <div class="worker-maint-detail">
          <div class="maint-detail-row">
            <span>🍖 배고픔</span>
            <div class="mini-bar" style="flex:1;margin:0 8px;height:8px;">
              <div class="mini-fill${(w.hunger || 0) < 30 ? ' warning' : ''}" style="width:${w.hunger || 0}%;height:100%;"></div>
            </div>
            <span style="font-size:11px;min-width:40px;text-align:right;">${Math.floor(w.hunger || 0)}%</span>
            <button class="btn btn-primary btn-small" id="modal-feed" style="margin-left:8px;font-size:10px;padding:2px 6px;">급식</button>
          </div>
          <div class="maint-detail-row" style="margin-top:6px;">
            <span>🔧 내구도</span>
            <div class="mini-bar" style="flex:1;margin:0 8px;height:8px;">
              <div class="mini-fill${(w.toolDurability || 0) < 50 ? ' warning' : ''}" style="width:${((w.toolDurability || 0) / (w.maxToolDurability || 500)) * 100}%;height:100%;"></div>
            </div>
            <span style="font-size:11px;min-width:60px;text-align:right;">${w.toolDurability || 0}/${w.maxToolDurability || 500}</span>
            <button class="btn btn-primary btn-small" id="modal-repair" style="margin-left:8px;font-size:10px;padding:2px 6px;">수리</button>
          </div>
          <div style="margin-top:8px;font-size:10px;color:#889;">
            <label><input type="checkbox" id="modal-autofeed" ${s.workerMaintenance?.autoFeed !== false ? 'checked' : ''}> 자동 급식</label>
            <label style="margin-left:12px;"><input type="checkbox" id="modal-autorepair" ${s.workerMaintenance?.autoRepair !== false ? 'checked' : ''}> 자동 수리</label>
          </div>
        </div>
      </div>

      ${availableEquip.length > 0 ? `
      <div class="modal-section">
        <div class="modal-section-title">장비 장착</div>
        <div style="max-height:150px;overflow-y:auto;">
          ${availableEquip.map(eqInstance => {
            const eq = EQUIPMENT[eqInstance.baseId];
            const displayName = this.engine.enhancement.formatEquipmentName(eqInstance);
            return `<div class="recipe-card" style="margin-bottom:4px;padding:6px;" data-eq="${eqInstance.uid}">
              <span style="font-size:18px;">${eq.icon}</span>
              <div class="recipe-info">
                <div style="font-size:11px;font-weight:600;">${displayName}</div>
                <div style="font-size:9px;color:#889;">${eq.slot} | Tier ${eq.tier}</div>
              </div>
              <button class="btn btn-primary btn-small worker-equip-btn" data-eq="${eqInstance.uid}">장착</button>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    `;

    this.showModal(html);

    document.getElementById('modal-recall')?.addEventListener('click', () => {
      this.engine.recallWorker(workerId);
      this.closeModal();
    });
    document.getElementById('modal-deploy')?.addEventListener('click', () => {
      const zoneId = document.getElementById('modal-deploy-zone').value;
      if (zoneId) {
        this.engine.deployWorker(workerId, zoneId);
        this.closeModal();
      }
    });
    document.querySelectorAll('.worker-equip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.equipWorker(workerId, btn.dataset.eq);
        this.showWorkerDetail(workerId); // 새로고침
      });
    });
    // 유지비 버튼
    document.getElementById('modal-feed')?.addEventListener('click', () => {
      const worker = s.workers.find(x => x.id === workerId);
      if (worker) {
        if (this.engine.feedWorker(worker)) {
          this.engine.emit('toast', { msg: `${worker.name}에게 급식 완료!`, type: 'success' });
        } else {
          this.engine.emit('toast', { msg: '음식이 없습니다!', type: 'error' });
        }
        this.showWorkerDetail(workerId);
      }
    });
    document.getElementById('modal-repair')?.addEventListener('click', () => {
      const worker = s.workers.find(x => x.id === workerId);
      if (worker) {
        if (this.engine.repairWorkerTool(worker)) {
          this.engine.emit('toast', { msg: `${worker.name}의 도구 수리 완료!`, type: 'success' });
        } else {
          this.engine.emit('toast', { msg: '수리 도구가 없습니다!', type: 'error' });
        }
        this.showWorkerDetail(workerId);
      }
    });
    document.getElementById('modal-autofeed')?.addEventListener('change', (e) => {
      this.engine.getState().workerMaintenance.autoFeed = e.target.checked;
    });
    document.getElementById('modal-autorepair')?.addEventListener('change', (e) => {
      this.engine.getState().workerMaintenance.autoRepair = e.target.checked;
    });
  }

  // ---- 전투 탭 ----
  renderCombat() {
    const s = this.engine.getState();
    if (!s) return;
    const zone = ZONES[s.player.currentZone];
    const c = this.engine.getCombatSnapshot();
    const auto = this.engine.getAutoSnapshot();
    const busy = c.inCombat || auto.enabled;

    // ---- 자동전투 세션 패널 ----
    const arenaEl = document.getElementById('combat-arena');
    if (auto.enabled || c.inCombat) {
      arenaEl.classList.remove('hidden');
      const pStats = this.engine.getPlayerStats();
      const sess = auto.session || {};
      const elapsed = auto.enabled ? Math.floor((Date.now() - (sess.startTime || Date.now())) / 1000) : 0;
      const elapsedStr = elapsed > 0 ? `${Math.floor(elapsed/60)}분 ${elapsed%60}초` : '';

      arenaEl.innerHTML = `
        ${c.inCombat && c.enemy ? `
        <div class="combat-header">
          <div class="combatant">
            <div class="combatant-name">🧑 Lv.${s.player.level}</div>
            <div class="combatant-hp-bar"><div class="combatant-hp-fill" style="width:${(s.player.hp/s.player.maxHp)*100}%"></div></div>
            <div class="combatant-hp-text">${Math.floor(s.player.hp)}/${s.player.maxHp}</div>
          </div>
          <div style="font-size:20px;padding:0 8px;">⚔️</div>
          <div class="combatant">
            <div class="combatant-name">${c.enemy.icon} ${c.enemy.name}</div>
            <div class="combatant-hp-bar"><div class="combatant-hp-fill" style="width:${(c.enemyHp/c.enemyMaxHp)*100}%"></div></div>
            <div class="combatant-hp-text">${c.enemyHp}/${c.enemyMaxHp}</div>
          </div>
        </div>` : ''}

        ${auto.enabled ? `
        <div class="auto-session-panel">
          <div class="auto-session-header">
            <span class="auto-badge">🔄 자동전투 중</span>
            <span class="auto-speed-badge">${auto.speed}x</span>
            ${auto.repeatMode > 0 ? `<span class="auto-count">${auto.repeatMode - auto.repeatRemaining}/${auto.repeatMode}</span>` : '<span class="auto-count">∞ 무한</span>'}
          </div>
          <div class="auto-session-stats">
            <span>⚔️ ${sess.kills || 0}킬</span>
            <span>✨ ${sess.exp || 0} EXP</span>
            <span>💰 ${sess.gold || 0}G</span>
            ${elapsedStr ? `<span>⏱️ ${elapsedStr}</span>` : ''}
          </div>
          ${Object.keys(sess.loot || {}).length > 0 ? `
          <div class="auto-session-loot">
            📦 ${Object.entries(sess.loot).map(([id,amt]) => `${this.engine.getItemIcon(id)}${this.engine.getItemName(id)} x${amt}`).join(', ')}
          </div>` : ''}
          <div class="auto-controls">
            <button class="btn btn-small ${auto.speed===1?'btn-primary':'btn-warning'}" id="btn-auto-speed">⚡ ${auto.speed===1?'2x':'1x'}</button>
            <button class="btn btn-danger btn-small" id="btn-auto-stop">⏹️ 중단</button>
          </div>
        </div>` : ''}

        <div id="combat-log">${c.log.slice(-15).map(l => `<div class="log-entry">${l}</div>`).join('')}</div>

        ${c.inCombat && !auto.enabled ? `
        <div id="combat-actions">
          <button class="btn btn-danger" id="btn-attack">⚔️ 공격</button>
          <button class="btn btn-success" id="btn-potion">🧪 물약</button>
          <button class="btn btn-warning" id="btn-flee">🏃 도주</button>
        </div>` : ''}
      `;

      // 로그 스크롤
      const logEl = arenaEl.querySelector('#combat-log');
      if (logEl) logEl.scrollTop = logEl.scrollHeight;

      // 수동 전투 버튼
      document.getElementById('btn-attack')?.addEventListener('click', () => this.engine.combatAttack());
      document.getElementById('btn-potion')?.addEventListener('click', () => this.engine.combatUsePotion());
      document.getElementById('btn-flee')?.addEventListener('click', () => this.engine.combatFlee());
      // 자동전투 컨트롤
      document.getElementById('btn-auto-speed')?.addEventListener('click', () => {
        this.engine.setAutoSpeed(auto.speed === 1 ? 2 : 1);
      });
      document.getElementById('btn-auto-stop')?.addEventListener('click', () => {
        this.engine.stopAutoCombat();
      });
    } else {
      // 전투 종료 후 로그
      if (c.log && c.log.length > 0) {
        arenaEl.classList.remove('hidden');
        const sess = this.engine.getAutoSnapshot().session || {};
        const hasSession = (sess.kills || 0) > 0;
        arenaEl.innerHTML = `
          ${hasSession ? `
          <div class="auto-session-panel" style="margin-bottom:8px;">
            <div class="auto-session-header"><span>📊 전투 결과</span></div>
            <div class="auto-session-stats">
              <span>⚔️ ${sess.kills}킬</span>
              <span>✨ ${sess.exp} EXP</span>
              <span>💰 ${sess.gold}G</span>
            </div>
            ${Object.keys(sess.loot || {}).length > 0 ? `
            <div class="auto-session-loot">
              📦 ${Object.entries(sess.loot).map(([id,amt]) => `${this.engine.getItemIcon(id)}${this.engine.getItemName(id)} x${amt}`).join(', ')}
            </div>` : ''}
          </div>` : ''}
          <div id="combat-log">${c.log.slice(-10).map(l => `<div class="log-entry">${l}</div>`).join('')}</div>
          <button class="btn btn-primary mt-8" id="btn-clear-log">확인</button>`;
        document.getElementById('btn-clear-log')?.addEventListener('click', () => {
          this.engine.combat.log = [];
          this.renderCombat();
        });
      } else {
        arenaEl.classList.add('hidden');
      }
    }

    // ---- 지역 표시 ----
    const selectEl = document.getElementById('combat-zone-select');
    selectEl.innerHTML = `<span class="text-muted" style="font-size:12px;">현재: ${zone?.icon} ${zone?.name}</span>`;

    // ---- 몬스터 리스트 ----
    const monListEl = document.getElementById('monster-list');
    if (!zone || !zone.monsters) {
      monListEl.innerHTML = '<div class="text-muted text-center" style="padding:20px;">이 지역에는 몬스터가 없습니다.</div>';
    } else {
      const normalMons = zone.monsters.filter(m => !MONSTERS[m]?.isRaid);
      const raidMons = zone.monsters.filter(m => MONSTERS[m]?.isRaid);

      monListEl.innerHTML = normalMons.map(mId => {
        const mon = MONSTERS[mId];
        if (!mon) return '';
        return `
          <div class="monster-card" data-monster="${mId}">
            <span class="monster-icon">${mon.icon}</span>
            <div class="monster-info">
              <div class="monster-name">${mon.name} <span class="text-muted">Tier ${mon.tier}</span></div>
              <div class="monster-stats-row">❤️${mon.hp} ⚔️${mon.atk} 🛡️${mon.def} 💨${mon.spd}${mon.element ? ` | ${ENV_NAMES[mon.element] || mon.element}` : ''}${mon.weakness ? ` | 약점:${ENV_NAMES[mon.weakness] || mon.weakness}` : ''}</div>
              <div style="font-size:10px;color:#f9d71c;">EXP:${mon.exp} 💰${mon.gold}</div>
            </div>
            <div class="monster-actions">
              <button class="btn btn-danger btn-small combat-single-btn" data-mid="${mId}" ${busy?'disabled':''}>⚔️ 도전</button>
              <button class="btn btn-primary btn-small combat-auto-btn" data-mid="${mId}" ${busy?'disabled':''}>🔄 자동</button>
            </div>
          </div>`;
      }).join('');

      // 레이드
      const raidEl = document.getElementById('raid-list');
      if (raidMons.length > 0) {
        document.getElementById('raid-section').style.display = 'block';
        raidEl.innerHTML = raidMons.map(mId => {
          const mon = MONSTERS[mId];
          return `
            <div class="monster-card raid-boss" data-monster="${mId}">
              <span class="monster-icon">${mon.icon}</span>
              <div class="monster-info">
                <div class="monster-name">👑 ${mon.name} <span class="text-muted">Tier ${mon.tier}</span></div>
                <div class="monster-stats-row">❤️${mon.hp} ⚔️${mon.atk} 🛡️${mon.def} 💨${mon.spd}${mon.element ? ` | ${ENV_NAMES[mon.element] || mon.element}` : ''}</div>
                <div style="font-size:10px;color:#f9d71c;">EXP:${mon.exp} 💰${mon.gold}</div>
                <div style="font-size:10px;color:#9b59b6;">⚠️ 레이드 보스</div>
              </div>
              <div class="monster-actions">
                <button class="btn btn-danger btn-small combat-single-btn" data-mid="${mId}" ${busy?'disabled':''}>⚔️ 도전</button>
                <button class="btn btn-primary btn-small combat-auto-btn" data-mid="${mId}" ${busy?'disabled':''}>🔄 자동</button>
              </div>
            </div>`;
        }).join('');
      } else {
        document.getElementById('raid-section').style.display = 'none';
      }

      // 이벤트: 단일 전투
      document.querySelectorAll('.combat-single-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engine.startCombat(btn.dataset.mid);
        });
      });
      // 이벤트: 자동전투
      document.querySelectorAll('.combat-auto-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showAutoModal(btn.dataset.mid);
        });
      });
    }
  }

  showAutoModal(monsterId) {
    const mon = MONSTERS[monsterId];
    if (!mon) return;
    const html = `
      <div class="modal-title">🔄 자동전투 설정</div>
      <div class="mb-8"><strong>${mon.icon} ${mon.name}</strong> (Tier ${mon.tier})</div>
      <div class="modal-section">
        <div class="modal-section-title">반복 횟수</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-small auto-repeat-btn btn-primary" data-count="0">♾️ 무한</button>
          <button class="btn btn-small auto-repeat-btn" data-count="5">5회</button>
          <button class="btn btn-small auto-repeat-btn" data-count="10">10회</button>
          <button class="btn btn-small auto-repeat-btn" data-count="20">20회</button>
          <button class="btn btn-small auto-repeat-btn" data-count="50">50회</button>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">전투 속도</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-small auto-speed-btn btn-primary" data-speed="1">1x 보통</button>
          <button class="btn btn-small auto-speed-btn" data-speed="2">2x 빠르게</button>
        </div>
      </div>
      <div class="modal-section" style="font-size:11px;color:#889;">
        <div>• HP 30% 이하 시 자동 물약 사용</div>
        <div>• HP 부족 또는 물약 소진 시 자동 중단</div>
      </div>
      <button class="btn btn-danger" id="btn-start-auto" style="width:100%;margin-top:12px;">⚔️ 자동전투 시작</button>
    `;
    this.showModal(html);

    let selectedCount = 0;
    let selectedSpeed = 1;

    document.querySelectorAll('.auto-repeat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.auto-repeat-btn').forEach(b => b.className = 'btn btn-small auto-repeat-btn');
        btn.classList.add('btn-primary');
        selectedCount = parseInt(btn.dataset.count);
      });
    });
    document.querySelectorAll('.auto-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.auto-speed-btn').forEach(b => b.className = 'btn btn-small auto-speed-btn');
        btn.classList.add('btn-primary');
        selectedSpeed = parseInt(btn.dataset.speed);
      });
    });
    document.getElementById('btn-start-auto')?.addEventListener('click', () => {
      this.closeModal();
      this.engine.startAutoCombat(monsterId, selectedCount, selectedSpeed);
    });
  }

  showAutoGatherSettings() {
    const gatherSnap = this.engine.getGatherSnapshot();
    const s = this.engine.getState();

    const html = `
      <div class="modal-title">⚙️ 자동채집 설정</div>
      <div class="text-muted mb-8">현재 스태미나: ${Math.floor(s.player.stamina)}/${s.player.maxStamina}</div>

      <div class="modal-section">
        <div class="modal-section-title">자동 음식 사용</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button class="btn btn-small auto-food-btn ${gatherSnap.settings.autoFood ? 'btn-primary' : ''}" data-enabled="true">ON</button>
          <button class="btn btn-small auto-food-btn ${!gatherSnap.settings.autoFood ? 'btn-primary' : ''}" data-enabled="false">OFF</button>
        </div>
        <div style="font-size:11px;color:#889;margin-bottom:8px;">
          스태미나가 낮으면 자동으로 음식 사용 (저티어 → 고티어 순)
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">음식 사용 임계값 (현재: ${gatherSnap.settings.foodThreshold}%)</div>
        <input type="range" id="food-threshold-slider" min="10" max="80" value="${gatherSnap.settings.foodThreshold}" style="width:100%;">
        <div style="font-size:11px;color:#4fc3f7;">스태미나 <span id="food-threshold-display">${gatherSnap.settings.foodThreshold}</span>% 이하 시 음식 사용</div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">자동 중단 임계값 (현재: ${gatherSnap.settings.stopThreshold}%)</div>
        <input type="range" id="stop-threshold-slider" min="5" max="50" value="${gatherSnap.settings.stopThreshold}" style="width:100%;">
        <div style="font-size:11px;color:#e74c3c;">스태미나 <span id="stop-threshold-display">${gatherSnap.settings.stopThreshold}</span>% 이하 시 자동 중단</div>
      </div>

      <div class="modal-section" style="font-size:11px;color:#889;">
        <div><strong>💡 팁:</strong></div>
        <div>• 레벨이 높을수록 Max 스태미나 증가 (레벨당 +4)</div>
        <div>• 스태미나 음식: 허브 스튜(+30), 영양 수프(+50), 에너지 스테이크(+80), 에너지 드링크(+120)</div>
        <div>• 자동채집 간격: 레벨 50+ → 1.2초, 레벨 20+ → 1.7초, 기본 → 2초</div>
      </div>

      <button class="btn btn-primary" id="btn-save-gather-settings" style="width:100%;margin-top:12px;">💾 설정 저장</button>
    `;

    this.showModal(html);

    let autoFood = gatherSnap.settings.autoFood;
    let foodThreshold = gatherSnap.settings.foodThreshold;
    let stopThreshold = gatherSnap.settings.stopThreshold;

    // 자동 음식 토글
    document.querySelectorAll('.auto-food-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.auto-food-btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        autoFood = btn.dataset.enabled === 'true';
      });
    });

    // 슬라이더
    const foodSlider = document.getElementById('food-threshold-slider');
    const foodDisplay = document.getElementById('food-threshold-display');
    foodSlider?.addEventListener('input', (e) => {
      foodThreshold = parseInt(e.target.value);
      foodDisplay.textContent = foodThreshold;
    });

    const stopSlider = document.getElementById('stop-threshold-slider');
    const stopDisplay = document.getElementById('stop-threshold-display');
    stopSlider?.addEventListener('input', (e) => {
      stopThreshold = parseInt(e.target.value);
      stopDisplay.textContent = stopThreshold;
    });

    // 저장
    document.getElementById('btn-save-gather-settings')?.addEventListener('click', () => {
      this.engine.setAutoFood(autoFood);
      this.engine.setFoodThreshold(foodThreshold);
      this.engine.setStopThreshold(stopThreshold);
      this.closeModal();
      this.showToast('자동채집 설정이 저장되었습니다.', 'success');
    });
  }

  // ---- 탈것 탭 ----
  renderVehicles() {
    const s = this.engine.getState();
    if (!s) return;

    // 보유 탈것
    const ownedEl = document.getElementById('owned-vehicle-list');
    if (s.vehicles.length === 0) {
      ownedEl.innerHTML = '<div class="text-muted" style="padding:10px;font-size:12px;">보유한 탈것이 없습니다.</div>';
    } else {
      ownedEl.innerHTML = s.vehicles.map(vId => {
        const v = VEHICLES[vId];
        const isEquipped = s.player.equippedVehicle === vId;
        return `
          <div class="vehicle-card ${isEquipped ? 'equipped' : ''}" data-vehicle="${vId}">
            <span class="vehicle-icon">${v.icon}</span>
            <div class="vehicle-info">
              <div class="vehicle-name">${v.name} ${isEquipped ? '✅' : ''}</div>
              <div class="vehicle-type">${v.type === 'sea' ? '해상' : v.type === 'air' ? '항공' : '우주'} | Tier ${v.tier}</div>
              <div class="vehicle-stats">속도: ${v.stats.speed} | 적재: ${v.stats.cargo}</div>
            </div>
            <button class="btn ${isEquipped ? 'btn-warning' : 'btn-primary'} btn-small equip-vehicle-btn">${isEquipped ? '해제' : '탑승'}</button>
          </div>`;
      }).join('');

      ownedEl.querySelectorAll('.equip-vehicle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const vId = btn.closest('.vehicle-card').dataset.vehicle;
          this.engine.equipVehicle(vId);
        });
      });
    }

    // 제작 가능 탈것
    const craftEl = document.getElementById('craftable-vehicle-list');
    const craftable = Object.entries(VEHICLES).filter(([vId]) => !s.vehicles.includes(vId));
    if (craftable.length === 0) {
      craftEl.innerHTML = '<div class="text-muted" style="padding:10px;font-size:12px;">모든 탈것을 제작했습니다!</div>';
    } else {
      craftEl.innerHTML = craftable.map(([vId, v]) => {
        const canCraft = this.engine.canCraftVehicle(vId);
        const hasPrereq = !v.prerequisite || s.vehicles.includes(v.prerequisite);
        const ingredients = v.ingredients.map(ing => {
          const has = this.engine.hasItem(ing.id, ing.amount);
          const cur = this.engine.getItemCount(ing.id);
          return `<span class="recipe-ingredient ${has ? 'has' : 'missing'}">${this.engine.getItemIcon(ing.id)} ${this.engine.getItemName(ing.id)} ${cur}/${ing.amount}</span>`;
        }).join(' ');

        return `
          <div class="vehicle-card" data-vehicle="${vId}">
            <span class="vehicle-icon">${v.icon}</span>
            <div class="vehicle-info">
              <div class="vehicle-name">${v.name}</div>
              <div class="vehicle-type">${v.type === 'sea' ? '해상' : v.type === 'air' ? '항공' : '우주'} | Tier ${v.tier}</div>
              <div style="font-size:10px;color:#889;margin-top:2px;">${v.desc}</div>
              <div style="font-size:10px;margin-top:4px;">${ingredients}</div>
              ${!hasPrereq ? `<div style="font-size:10px;color:#e74c3c;margin-top:2px;">선행: ${VEHICLES[v.prerequisite]?.name} 필요</div>` : ''}
              ${v.unlocksZones.length > 0 ? `<div style="font-size:10px;color:#2ecc71;margin-top:2px;">해금: ${v.unlocksZones.map(z => ZONES[z]?.name).join(', ')}</div>` : ''}
            </div>
            <button class="btn btn-primary btn-small craft-vehicle-btn" ${!canCraft ? 'disabled' : ''} data-vid="${vId}">제작</button>
          </div>`;
      }).join('');

      craftEl.querySelectorAll('.craft-vehicle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engine.craftVehicle(btn.dataset.vid);
        });
      });
    }
  }

  // ---- 도감 탭 ----
  renderCodex() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('codex-list');
    if (!listEl) return;

    // 카테고리 필터
    this.bindFilterButtons('#panel-codex', (filter) => {
      this.codexFilter = filter;
      this.renderCodex();
    }, this.codexFilter || 'all');

    // 완성도 계산
    const progress = {
      resources: this.engine.getCodexProgress('resources'),
      monsters: this.engine.getCodexProgress('monsters'),
      equipment: this.engine.getCodexProgress('equipment'),
    };

    const totalDiscovered = progress.resources.discovered +
                            progress.monsters.discovered +
                            progress.equipment.discovered;
    const totalCount = progress.resources.total +
                       progress.monsters.total +
                       progress.equipment.total;
    const totalPercentage = Math.floor((totalDiscovered / totalCount) * 100);

    // 완성도 바 표시
    const progressEl = document.getElementById('codex-progress');
    if (progressEl) {
      progressEl.innerHTML = `
        <div style="padding:12px;background:rgba(33,150,243,0.1);border-radius:8px;margin-bottom:16px;">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px;">📖 도감 완성도</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <div style="flex:1;">
              <div style="font-size:11px;color:#889;">자원</div>
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:12px;font-weight:600;">${progress.resources.discovered}/${progress.resources.total}</span>
                <div style="flex:1;height:8px;background:#222;border-radius:4px;overflow:hidden;">
                  <div style="height:100%;background:#4caf50;width:${Math.floor((progress.resources.discovered/progress.resources.total)*100)}%"></div>
                </div>
              </div>
            </div>
            <div style="flex:1;">
              <div style="font-size:11px;color:#889;">몬스터</div>
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:12px;font-weight:600;">${progress.monsters.discovered}/${progress.monsters.total}</span>
                <div style="flex:1;height:8px;background:#222;border-radius:4px;overflow:hidden;">
                  <div style="height:100%;background:#f44336;width:${Math.floor((progress.monsters.discovered/progress.monsters.total)*100)}%"></div>
                </div>
              </div>
            </div>
            <div style="flex:1;">
              <div style="font-size:11px;color:#889;">장비</div>
              <div style="display:flex;gap:4px;align-items:center;">
                <span style="font-size:12px;font-weight:600;">${progress.equipment.discovered}/${progress.equipment.total}</span>
                <div style="flex:1;height:8px;background:#222;border-radius:4px;overflow:hidden;">
                  <div style="height:100%;background:#ff9800;width:${Math.floor((progress.equipment.discovered/progress.equipment.total)*100)}%"></div>
                </div>
              </div>
            </div>
          </div>
          <div style="font-size:12px;margin-top:4px;">
            전체: ${totalDiscovered}/${totalCount} (${totalPercentage}%)
          </div>
        </div>
      `;
    }

    // 항목 목록 표시
    let items = [];

    if (this.codexFilter === 'all' || this.codexFilter === 'resources') {
      for (const [id, data] of Object.entries(RESOURCES)) {
        const entry = this.engine.getCodexEntry('resources', id);
        items.push({
          id, type: 'resource',
          discovered: !!entry,
          name: data.name, icon: data.icon, tier: data.tier,
          category: data.category
        });
      }
    }

    if (this.codexFilter === 'all' || this.codexFilter === 'monsters') {
      for (const [id, data] of Object.entries(MONSTERS)) {
        const entry = this.engine.getCodexEntry('monsters', id);
        items.push({
          id, type: 'monster',
          discovered: !!entry,
          name: data.name, icon: data.icon, tier: data.tier,
          defeatedCount: entry?.totalDefeated || 0
        });
      }
    }

    if (this.codexFilter === 'all' || this.codexFilter === 'equipment') {
      for (const [id, data] of Object.entries(EQUIPMENT)) {
        const entry = this.engine.getCodexEntry('equipment', id);
        items.push({
          id, type: 'equipment',
          discovered: !!entry,
          name: data.name, icon: data.icon, tier: data.tier,
          slot: data.slot
        });
      }
    }

    // 정렬: 발견 → 미발견 순, tier desc
    items.sort((a, b) => {
      if (a.discovered !== b.discovered) return a.discovered ? -1 : 1;
      return b.tier - a.tier;
    });

    listEl.innerHTML = items.map(item => {
      const locked = !item.discovered;
      const displayName = locked ? '???' : item.name;
      const displayIcon = locked ? '❓' : item.icon;

      return `
        <div class="codex-card ${locked ? 'locked' : ''}" data-id="${item.id}" data-type="${item.type}">
          <span style="font-size:24px;opacity:${locked ? 0.3 : 1};">${displayIcon}</span>
          <div class="codex-info">
            <div style="font-size:12px;font-weight:600;color:${locked ? '#555' : '#fff'};">${displayName}</div>
            <div style="font-size:10px;color:#889;">
              ${locked ? '미발견' : `Tier ${item.tier}`}
              ${item.type === 'monster' && !locked ? ` | 처치: ${item.defeatedCount}회` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    // 클릭 이벤트
    listEl.querySelectorAll('.codex-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const type = card.dataset.type;
        const entry = this.engine.getCodexEntry(type + 's', id);
        if (entry) {
          this.showCodexDetail(id, type);
        }
      });
    });
  }

  showCodexDetail(id, type) {
    let html = '';
    const entry = this.engine.getCodexEntry(type + 's', id);
    if (!entry) return;

    if (type === 'resource') {
      const res = RESOURCES[id];
      html = `
        <div class="modal-title">${res.icon} ${res.name}</div>
        <div class="text-muted mb-8">Tier ${res.tier} | ${res.category}</div>
        <div class="modal-section">
          <div class="modal-stat-row">
            <span>총 수집량</span>
            <span class="text-green">${entry.totalGathered || 0}개</span>
          </div>
          <div class="modal-stat-row">
            <span>최초 획득</span>
            <span>${new Date(entry.firstGathered).toLocaleString()}</span>
          </div>
        </div>`;
    } else if (type === 'monster') {
      const mon = MONSTERS[id];
      html = `
        <div class="modal-title">${mon.icon} ${mon.name}</div>
        <div class="text-muted mb-8">Tier ${mon.tier} | HP: ${mon.hp} | ATK: ${mon.atk}</div>
        <div class="modal-section">
          <div class="modal-stat-row">
            <span>총 처치 횟수</span>
            <span class="text-red">${entry.totalDefeated || 0}회</span>
          </div>
          <div class="modal-stat-row">
            <span>최초 처치</span>
            <span>${new Date(entry.firstDefeated).toLocaleString()}</span>
          </div>
          ${mon.weakness ? `<div class="modal-stat-row"><span>약점</span><span>${mon.weakness}</span></div>` : ''}
        </div>
        ${mon.loot && mon.loot.length > 0 ? `
        <div class="modal-section">
          <div class="modal-section-title">드롭 아이템</div>
          ${mon.loot.map(l => `<div>${this.engine.getItemIcon(l.id)} ${this.engine.getItemName(l.id)} (${Math.floor(l.chance*100)}%)</div>`).join('')}
        </div>` : ''}`;
    } else if (type === 'equipment') {
      const eq = EQUIPMENT[id];
      html = `
        <div class="modal-title">${eq.icon} ${eq.name}</div>
        <div class="text-muted mb-8">${eq.slot} | Tier ${eq.tier}</div>
        <div class="modal-section">
          <div class="modal-stat-row">
            <span>최초 제작</span>
            <span>${new Date(entry.firstCrafted).toLocaleString()}</span>
          </div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">스탯</div>
          ${Object.entries(eq.stats).map(([k,v]) => `
            <div class="modal-stat-row">
              <span>${this.statName(k)}</span>
              <span class="text-green">+${v}</span>
            </div>`).join('')}
        </div>`;
    }

    this.showModal(html);
  }

  // ---- 미션 & 업적 탭 ----
  renderMissions() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('missions-list');
    const timerEl = document.getElementById('missions-timer');
    if (!listEl) return;

    // 필터 바인딩
    this.bindFilterButtons('#panel-missions', (filter) => {
      this.missionsFilter = filter;
      this.renderMissions();
    }, this.missionsFilter || 'daily');

    const filter = this.missionsFilter || 'daily';

    // 리셋 타이머 표시
    const timers = this.engine.getMissionResetTimers();
    if (timerEl) {
      if (filter === 'daily') {
        timerEl.innerHTML = `<div class="mission-reset-timer"><span>일일 미션 초기화까지</span><span>${timers.daily}</span></div>`;
      } else if (filter === 'weekly') {
        timerEl.innerHTML = `<div class="mission-reset-timer"><span>주간 미션 초기화까지</span><span>${timers.weekly}</span></div>`;
      } else {
        const achStats = this.engine.getAchievementStats();
        timerEl.innerHTML = `
          <div class="mission-reset-timer">
            <span>업적 달성</span>
            <span>${achStats.unlocked} / ${achStats.total} (${achStats.percentage}%)</span>
          </div>`;
      }
    }

    if (filter === 'daily') {
      this.renderDailyMissions(listEl);
    } else if (filter === 'weekly') {
      this.renderWeeklyMissions(listEl);
    } else {
      this.renderAchievements(listEl);
    }
  }

  renderDailyMissions(listEl) {
    const missions = this.engine.getDailyMissions();
    if (missions.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:#889;padding:40px;">미션을 불러오는 중...</div>';
      return;
    }

    listEl.innerHTML = missions.map((m, i) => {
      const prog = m.progress;
      const pct = Math.min(100, Math.floor((prog.current / m.target) * 100));
      const isComplete = prog.current >= m.target;
      const isClaimed = prog.claimed;
      const cardClass = isClaimed ? 'claimed' : isComplete ? 'completed' : '';
      const fillClass = isComplete ? 'full' : 'daily';

      return `
        <div class="mission-card ${cardClass}">
          <div class="mission-info">
            <div class="mission-name">${m.name}</div>
            <div class="mission-desc">${m.desc}</div>
            <div class="mission-progress-bar">
              <div class="mission-progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <div class="mission-progress-text">${prog.current} / ${m.target}</div>
          </div>
          <div class="mission-reward">
            <div class="mission-reward-text">${this.formatReward(m.reward)}</div>
            ${isComplete && !isClaimed
              ? `<button class="btn btn-small btn-success" data-claim-daily="${i}">수령</button>`
              : isClaimed
                ? '<span style="font-size:11px;color:#4caf50;">완료</span>'
                : ''}
          </div>
        </div>`;
    }).join('');

    // 수령 버튼 이벤트
    listEl.querySelectorAll('[data-claim-daily]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.claimDaily);
        this.engine.claimDailyMission(idx);
      });
    });
  }

  renderWeeklyMissions(listEl) {
    const missions = this.engine.getWeeklyMissions();
    if (missions.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:#889;padding:40px;">미션을 불러오는 중...</div>';
      return;
    }

    listEl.innerHTML = missions.map((m, i) => {
      const prog = m.progress;
      const pct = Math.min(100, Math.floor((prog.current / m.target) * 100));
      const isComplete = prog.current >= m.target;
      const isClaimed = prog.claimed;
      const cardClass = isClaimed ? 'claimed' : isComplete ? 'completed' : '';
      const fillClass = isComplete ? 'full' : 'weekly';

      return `
        <div class="mission-card ${cardClass}">
          <div class="mission-info">
            <div class="mission-name">${m.name}</div>
            <div class="mission-desc">${m.desc}</div>
            <div class="mission-progress-bar">
              <div class="mission-progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <div class="mission-progress-text">${prog.current} / ${m.target}</div>
          </div>
          <div class="mission-reward">
            <div class="mission-reward-text">${this.formatReward(m.reward)}</div>
            ${isComplete && !isClaimed
              ? `<button class="btn btn-small btn-success" data-claim-weekly="${i}">수령</button>`
              : isClaimed
                ? '<span style="font-size:11px;color:#4caf50;">완료</span>'
                : ''}
          </div>
        </div>`;
    }).join('');

    // 수령 버튼 이벤트
    listEl.querySelectorAll('[data-claim-weekly]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.claimWeekly);
        this.engine.claimWeeklyMission(idx);
      });
    });
  }

  renderAchievements(listEl) {
    const achievements = this.engine.getAchievements();

    // 정렬: 달성한 것 위로, 미달성은 진행도 높은 순
    achievements.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      const aPct = a.currentValue / a.target;
      const bPct = b.currentValue / b.target;
      return bPct - aPct;
    });

    const categoryNames = {
      combat: '전투', gather: '채집', craft: '제작',
      economy: '경제', level: '레벨', worker: '일꾼',
      codex: '도감', misc: '기타', enhance: '강화',
    };
    const categoryIcons = {
      combat: '⚔️', gather: '⛏️', craft: '🔨',
      economy: '💰', level: '📈', worker: '👷',
      codex: '📖', misc: '🎲', enhance: '🔧',
    };

    listEl.innerHTML = achievements.map(ach => {
      const pct = Math.min(100, Math.floor((ach.currentValue / ach.target) * 100));
      const icon = categoryIcons[ach.category] || '🏆';

      return `
        <div class="achievement-card ${ach.unlocked ? 'unlocked' : ''}">
          <div class="achievement-icon">${ach.unlocked ? '🏆' : icon}</div>
          <div class="achievement-info">
            <div class="achievement-name">${ach.name}</div>
            <div class="achievement-desc">${ach.desc}</div>
            ${!ach.unlocked
              ? `<div class="achievement-progress">${ach.currentValue.toLocaleString()} / ${ach.target.toLocaleString()} (${pct}%)</div>`
              : '<div class="achievement-progress" style="color:#ffd700;">달성 완료!</div>'}
          </div>
          <div class="achievement-reward-text">${this.formatReward(ach.reward)}</div>
        </div>`;
    }).join('');
  }

  formatReward(reward) {
    const parts = [];
    if (reward.gold) parts.push(`💰${reward.gold}`);
    if (reward.exp) parts.push(`✨${reward.exp}`);
    if (reward.legacyPoints) parts.push(`⭐${reward.legacyPoints}`);
    if (reward.item) {
      const name = this.engine.getItemName(reward.item);
      parts.push(`${name}x${reward.amount || 1}`);
    }
    if (reward.bonus) {
      for (const [key, val] of Object.entries(reward.bonus)) {
        parts.push(`📊${key}+${val}%`);
      }
    }
    return parts.join('<br>');
  }

  // ---- 시장 탭 ----
  renderMarket() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('market-list');
    const timerEl = document.getElementById('market-timer');
    const nextUpdate = 60 - (s.tickCount % 60);
    timerEl.textContent = `다음 시세 변동: ${nextUpdate}초`;

    // 활성 투자 목록
    const investments = this.engine.getActiveInvestments();
    let investmentHTML = '';
    if (investments.length > 0) {
      investmentHTML = `
        <div style="background:rgba(33,150,243,0.1);padding:12px;border-radius:8px;margin-bottom:16px;">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px;">💰 활성 투자</div>
          ${investments.map(inv => {
            const remainingSec = Math.floor(inv.remaining / 1000);
            const hours = Math.floor(remainingSec / 3600);
            const mins = Math.floor((remainingSec % 3600) / 60);
            const secs = remainingSec % 60;
            const timeText = `${hours}h ${mins}m ${secs}s`;
            const trendText = inv.predictedTrend === 'up' ? '📈 상승' : '📉 하락';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                <div>
                  <span style="font-weight:600;">${inv.itemName}</span>
                  <span class="text-muted" style="font-size:11px;margin-left:8px;">${trendText} 예측 | ${inv.amount}G</span>
                </div>
                <div class="text-blue" style="font-size:11px;">${timeText}</div>
              </div>`;
          }).join('')}
        </div>`;
    }

    // 상인 의뢰
    const quests = this.engine.getMerchantQuests();
    let questHTML = '';
    if (quests.length > 0) {
      questHTML = `
        <div style="background:rgba(255,152,0,0.1);padding:12px;border-radius:8px;margin-bottom:16px;">
          <div style="font-weight:600;font-size:14px;margin-bottom:8px;">📦 상인 의뢰</div>
          ${quests.map(q => {
            const remainSec = Math.floor(q.remaining / 1000);
            const hours = Math.floor(remainSec / 3600);
            const mins = Math.floor((remainSec % 3600) / 60);
            const timeText = `${hours}h ${mins}m`;
            const progressPct = Math.min(100, Math.floor((q.owned / q.quantity) * 100));
            return `
              <div class="merchant-quest">
                <div class="merchant-quest-header">
                  <div>
                    <div class="merchant-name">${q.merchantName}</div>
                    <div style="font-weight:600;font-size:13px;">${q.itemIcon} ${q.itemName} x${q.quantity}
                      <span class="text-muted" style="font-size:11px;">(보유: ${q.owned})</span>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div class="merchant-reward">💰 ${q.rewardGold.toLocaleString()}G</div>
                    <div class="merchant-timer">⏰ ${timeText}</div>
                  </div>
                </div>
                <div class="merchant-progress">
                  <div class="mini-bar" style="height:6px;">
                    <div class="mini-fill" style="width:${progressPct}%;background:${q.canComplete ? '#2ecc71' : '#ff9800'};"></div>
                  </div>
                  <button class="btn btn-success btn-small merchant-complete-btn"
                    data-quest="${q.id}" ${!q.canComplete ? 'disabled' : ''}
                    style="min-width:50px;font-size:11px;">납품</button>
                </div>
              </div>`;
          }).join('')}
        </div>`;
    }

    // 시장에서 거래 가능한 아이템 (해금된 자원만)
    const tradeable = Object.entries(s.market.prices || {})
      .filter(([id]) => {
        // 보유하거나 해금된 지역에서 나오는 자원만
        if (s.inventory[id] && s.inventory[id] > 0) return true;
        for (const zId of s.unlockedZones) {
          if (ZONES[zId]?.resources?.includes(id)) return true;
        }
        // 가공품은 재료가 있으면
        if (RESOURCES[id]?.crafted) return true;
        return false;
      })
      .sort((a, b) => {
        const ta = RESOURCES[a[0]]?.tier || 1;
        const tb = RESOURCES[b[0]]?.tier || 1;
        return ta - tb;
      });

    if (tradeable.length === 0) {
      listEl.innerHTML = investmentHTML + questHTML + '<div class="text-muted text-center" style="padding:20px;">거래 가능한 아이템이 없습니다.</div>';
      this.bindMerchantQuestButtons(listEl);
      return;
    }

    listEl.innerHTML = investmentHTML + questHTML + tradeable.map(([id, price]) => {
      const basePrice = MARKET_BASE_PRICES[id] || price;
      const trend = s.market.trends ? (s.market.trends[id] || 0) : 0;
      const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
      const priceClass = trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable';
      const owned = s.inventory[id] || 0;
      const qty = this.marketQuantities[id] || 1;
      const buyPrice = Math.ceil(price * 1.1);
      const dailyRemaining = this.engine.getDailyRemaining(id);
      const dailyPurchased = this.engine.getDailyPurchased(id);
      const limitWarning = dailyRemaining <= 10 ? `<span class="text-red">⚠️ 제한 임박</span>` : '';

      return `
        <div class="market-row">
          <span style="font-size:16px;">${this.engine.getItemIcon(id)}</span>
          <div style="flex:1;min-width:0;">
            <div class="market-item-name">${this.engine.getItemName(id)} <span class="text-muted">(보유: ${owned})</span></div>
            <div style="font-size:10px;color:#889;margin-top:2px;">
              오늘 구매: ${dailyPurchased}/50 ${limitWarning}
            </div>
          </div>
          <span class="market-trend">${trendIcon}</span>
          <span class="market-price ${priceClass}">${Math.round(price)}G</span>
          <input type="number" class="market-qty" value="${qty}" min="1" max="99" data-id="${id}">
          <div class="market-actions">
            <button class="btn btn-success btn-small market-buy-btn" data-id="${id}">매입</button>
            <button class="btn btn-warning btn-small market-sell-btn" data-id="${id}" ${owned <= 0 ? 'disabled' : ''}>매도</button>
            <button class="btn btn-primary btn-small market-invest-btn" data-id="${id}">💰</button>
          </div>
        </div>`;
    }).join('');

    // 이벤트
    listEl.querySelectorAll('.market-qty').forEach(input => {
      input.addEventListener('change', () => {
        this.marketQuantities[input.dataset.id] = parseInt(input.value) || 1;
      });
    });
    listEl.querySelectorAll('.market-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const qty = this.marketQuantities[id] || 1;
        this.engine.buyFromMarket(id, qty);
      });
    });
    listEl.querySelectorAll('.market-sell-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const qty = this.marketQuantities[id] || 1;
        this.engine.sellToMarket(id, qty);
      });
    });
    listEl.querySelectorAll('.market-invest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.showInvestModal(id);
      });
    });
    this.bindMerchantQuestButtons(listEl);
  }

  bindMerchantQuestButtons(container) {
    container.querySelectorAll('.merchant-complete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.engine.completeMerchantQuest(btn.dataset.quest);
      });
    });
  }

  showInvestModal(itemId) {
    const s = this.engine.getState();
    const price = this.engine.getMarketPrice(itemId);
    const trend = this.engine.getMarketTrend(itemId);
    const itemName = this.engine.getItemName(itemId);
    const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';

    const html = `
      <div class="modal-title">💰 가격 예측 투자</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">${this.engine.getItemIcon(itemId)} ${itemName}</div>

      <div class="modal-section">
        <div class="modal-section-title">현재 시장 정보</div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">현재 가격</span>
          <span class="modal-stat-value">${Math.round(price)}G</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">현재 추세</span>
          <span class="modal-stat-value">${trendIcon}</span>
        </div>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">투자 설정</div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;color:#889;display:block;margin-bottom:4px;">투자 금액 (G)</label>
          <input type="number" id="invest-amount" class="market-qty" style="width:100%;" value="1000" min="100" step="100">
        </div>
        <div>
          <label style="font-size:12px;color:#889;display:block;margin-bottom:8px;">가격 예측 (24시간 후)</label>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-success" id="invest-up" style="flex:1;">📈 상승 (+50%)</button>
            <button class="btn btn-danger" id="invest-down" style="flex:1;">📉 하락 (+50%)</button>
          </div>
        </div>
      </div>

      <div class="modal-section" style="font-size:11px;color:#889;">
        <div><strong>💡 투자 규칙:</strong></div>
        <div>• 예측 성공 시: +50% 수익</div>
        <div>• 예측 실패 시: -30% 손실</div>
        <div>• 변동 없음: 원금 환불</div>
        <div>• 결과 확인: 24시간 후</div>
      </div>
    `;

    this.showModal(html);

    document.getElementById('invest-up')?.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('invest-amount').value) || 1000;
      this.engine.investInMarket(itemId, amount, 'up');
      this.closeModal();
    });

    document.getElementById('invest-down')?.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('invest-amount').value) || 1000;
      this.engine.investInMarket(itemId, amount, 'down');
      this.closeModal();
    });
  }

  // ---- 사망 화면 ----
  showDeathScreen(data) {
    const deathEl = document.getElementById('death-screen');
    deathEl.classList.remove('hidden');
    document.getElementById('death-cause').textContent = data.cause;
    document.getElementById('death-summary').innerHTML = `
      <div class="summary-row"><span>도달 레벨</span><span>Lv.${data.level}</span></div>
      <div class="summary-row"><span>획득 레거시</span><span class="text-purple">+${data.legacyGain} ⭐</span></div>
      <div class="summary-row"><span>총 레거시</span><span class="text-purple">${data.totalLegacy} ⭐</span></div>
      <div class="summary-row"><span>영구 보너스</span><span class="text-green">채집+2% 전투+1 일꾼+1%</span></div>
    `;
    document.getElementById('btn-revive').onclick = () => {
      this.engine.revive();
      deathEl.classList.add('hidden');
    };
  }

  // ---- 유틸 ----
  bindFilterButtons(panelSelector, callback, current) {
    document.querySelectorAll(`${panelSelector} .filter-btn`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === current);
      // 이벤트 중복 방지
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => callback(newBtn.dataset.filter));
    });
  }

  bindEvents() {
    // 모달 닫기
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
  }

  showModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }
  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  statName(key) {
    const names = {
      attack: '공격력', defense: '방어력', speed: '속도', luck: '행운',
      hp: 'HP', crit: '크리티컬', mining: '채굴', logging: '벌목',
      fishing: '낚시', gathering: '채집', research: '연구',
      fireDmg: '화염 데미지', iceDmg: '냉기 데미지', lightningDmg: '번개 데미지',
    };
    return names[key] || key;
  }
}
