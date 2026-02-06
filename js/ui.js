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
  }

  renderCurrentTab() {
    switch (this.currentTab) {
      case 'zones': this.renderZones(); break;
      case 'inventory': this.renderInventory(); break;
      case 'crafting': this.renderCrafting(); break;
      case 'workers': this.renderWorkers(); break;
      case 'combat': this.renderCombat(); break;
      case 'vehicles': this.renderVehicles(); break;
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
          <button class="btn btn-success gather-btn" id="btn-gather">🔨 채집하기</button>
        </div>`;
      document.getElementById('btn-gather')?.addEventListener('click', () => {
        this.engine.gatherResource();
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
    // 장비
    const eqCount = {};
    for (const eId of s.equipment) {
      eqCount[eId] = (eqCount[eId] || 0) + 1;
    }
    for (const [id, count] of Object.entries(eqCount)) {
      const eq = EQUIPMENT[id];
      if (!eq) continue;
      items.push({ id, count, name: eq.name, icon: eq.icon, tier: eq.tier, type: 'equipment', category: eq.type });
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
      const eq = EQUIPMENT[itemId];
      if (!eq) return;
      const isEquipped = Object.values(s.equippedGear).includes(itemId);
      html = `
        <div class="modal-title">${eq.icon} ${eq.name}</div>
        <div class="text-muted mb-8">${eq.desc}</div>
        <div class="modal-section">
          <div class="modal-section-title">스탯</div>
          ${Object.entries(eq.stats).map(([k,v]) => `
            <div class="modal-stat-row">
              <span class="modal-stat-label">${this.statName(k)}</span>
              <span class="modal-stat-value text-green">+${v}</span>
            </div>`).join('')}
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
    document.getElementById('modal-use-food')?.addEventListener('click', () => {
      this.engine.useFood(itemId);
      this.closeModal();
    });
    document.getElementById('modal-vault')?.addEventListener('click', () => {
      this.engine.addToVault(itemId, 1);
      this.closeModal();
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
          </div>
          <button class="btn btn-primary btn-small" ${!canCraft ? 'disabled' : ''}>제작</button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.recipe-card .btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const recipeId = btn.closest('.recipe-card').dataset.recipe;
        this.engine.craft(recipeId);
      });
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

    // 장착 가능한 장비 목록
    const availableEquip = s.equipment.filter(eId => {
      const eq = EQUIPMENT[eId];
      if (!eq) return false;
      // 플레이어가 끼고있으면 제외
      if (Object.values(s.equippedGear).includes(eId)) return false;
      // 다른 일꾼이 끼고있으면 제외
      for (const ow of s.workers) {
        if (ow.id !== workerId && Object.values(ow.equipment).includes(eId)) return false;
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
            const eqId = w.equipment[slot];
            const eq = eqId ? EQUIPMENT[eqId] : null;
            return `<div class="equip-slot ${eq ? 'filled' : ''}" data-slot="${slot}">
              <span class="slot-icon">${eq ? eq.icon : '➕'}</span>
              <span class="slot-label">${eq ? eq.name : slotNames[slot]}</span>
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

      ${availableEquip.length > 0 ? `
      <div class="modal-section">
        <div class="modal-section-title">장비 장착</div>
        <div style="max-height:150px;overflow-y:auto;">
          ${availableEquip.map(eId => {
            const eq = EQUIPMENT[eId];
            return `<div class="recipe-card" style="margin-bottom:4px;padding:6px;" data-eq="${eId}">
              <span style="font-size:18px;">${eq.icon}</span>
              <div class="recipe-info">
                <div style="font-size:11px;font-weight:600;">${eq.name}</div>
                <div style="font-size:9px;color:#889;">${eq.slot} | Tier ${eq.tier}</div>
              </div>
              <button class="btn btn-primary btn-small worker-equip-btn" data-eq="${eId}">장착</button>
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
  }

  // ---- 전투 탭 ----
  renderCombat() {
    const s = this.engine.getState();
    if (!s) return;
    const zone = ZONES[s.player.currentZone];
    const c = s.combat;

    // 전투 중
    const arenaEl = document.getElementById('combat-arena');
    if (c.inCombat) {
      arenaEl.classList.remove('hidden');
      const pStats = this.engine.getPlayerStats();
      arenaEl.innerHTML = `
        <div class="combat-header">
          <div class="combatant">
            <div class="combatant-name">🧑 플레이어 Lv.${s.player.level}</div>
            <div class="combatant-hp-bar"><div class="combatant-hp-fill" style="width:${(s.player.hp/s.player.maxHp)*100}%"></div></div>
            <div class="combatant-hp-text">${Math.floor(s.player.hp)}/${s.player.maxHp} | ATK:${pStats.attack} DEF:${pStats.defense}</div>
          </div>
          <div style="font-size:24px;padding:0 10px;">⚔️</div>
          <div class="combatant">
            <div class="combatant-name">${c.enemy.icon} ${c.enemy.name}</div>
            <div class="combatant-hp-bar"><div class="combatant-hp-fill" style="width:${(c.enemyHp/c.enemyMaxHp)*100}%"></div></div>
            <div class="combatant-hp-text">${c.enemyHp}/${c.enemyMaxHp} | ATK:${c.enemy.atk} DEF:${c.enemy.def}</div>
          </div>
        </div>
        <div id="combat-log">${c.log.map(l => `<div class="log-entry">${l}</div>`).join('')}</div>
        <div id="combat-actions">
          <button class="btn btn-danger" id="btn-attack">⚔️ 공격</button>
          <button class="btn btn-success" id="btn-potion">🧪 물약</button>
          <button class="btn btn-warning" id="btn-flee">🏃 도주</button>
        </div>`;
      // 로그 스크롤
      const logEl = arenaEl.querySelector('#combat-log');
      logEl.scrollTop = logEl.scrollHeight;

      document.getElementById('btn-attack')?.addEventListener('click', () => this.engine.combatAttack());
      document.getElementById('btn-potion')?.addEventListener('click', () => this.engine.combatUsePotion());
      document.getElementById('btn-flee')?.addEventListener('click', () => this.engine.combatFlee());
    } else {
      arenaEl.classList.add('hidden');
      // 전투 결과 로그 표시
      if (c.log && c.log.length > 0) {
        arenaEl.classList.remove('hidden');
        arenaEl.innerHTML = `
          <div id="combat-log">${c.log.map(l => `<div class="log-entry">${l}</div>`).join('')}</div>
          <button class="btn btn-primary mt-8" id="btn-clear-log">확인</button>`;
        document.getElementById('btn-clear-log')?.addEventListener('click', () => {
          s.combat.log = [];
          this.renderCombat();
        });
      }
    }

    // 지역 선택
    const selectEl = document.getElementById('combat-zone-select');
    selectEl.innerHTML = `<span class="text-muted" style="font-size:12px;">현재: ${zone?.icon} ${zone?.name}</span>`;

    // 몬스터 리스트
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
            <button class="btn btn-danger btn-small" ${c.inCombat ? 'disabled' : ''}>도전</button>
          </div>`;
      }).join('');

      // 레이드 섹션
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
                <div style="font-size:10px;color:#9b59b6;">⚠️ 레이드 보스 - 강력한 장비 필요!</div>
              </div>
              <button class="btn btn-danger btn-small" ${c.inCombat ? 'disabled' : ''}>도전</button>
            </div>`;
        }).join('');
      } else {
        document.getElementById('raid-section').style.display = 'none';
      }

      // 전투 시작 이벤트
      document.querySelectorAll('.monster-card .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mId = btn.closest('.monster-card').dataset.monster;
          this.engine.startCombat(mId);
        });
      });
    }
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

  // ---- 시장 탭 ----
  renderMarket() {
    const s = this.engine.getState();
    if (!s) return;
    const listEl = document.getElementById('market-list');
    const timerEl = document.getElementById('market-timer');
    const nextUpdate = 60 - (s.tickCount % 60);
    timerEl.textContent = `다음 시세 변동: ${nextUpdate}초`;

    // 시장에서 거래 가능한 아이템 (해금된 자원만)
    const tradeable = Object.entries(s.market.prices)
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
      listEl.innerHTML = '<div class="text-muted text-center" style="padding:20px;">거래 가능한 아이템이 없습니다.</div>';
      return;
    }

    listEl.innerHTML = tradeable.map(([id, price]) => {
      const basePrice = MARKET_BASE_PRICES[id] || price;
      const trend = s.market.trends[id] || 0;
      const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
      const priceClass = trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable';
      const owned = s.inventory[id] || 0;
      const qty = this.marketQuantities[id] || 1;
      const buyPrice = Math.ceil(price * 1.1);

      return `
        <div class="market-row">
          <span style="font-size:16px;">${this.engine.getItemIcon(id)}</span>
          <span class="market-item-name">${this.engine.getItemName(id)} <span class="text-muted">(${owned})</span></span>
          <span class="market-trend">${trendIcon}</span>
          <span class="market-price ${priceClass}">${Math.round(price)}G</span>
          <input type="number" class="market-qty" value="${qty}" min="1" max="99" data-id="${id}">
          <div class="market-actions">
            <button class="btn btn-success btn-small market-buy-btn" data-id="${id}">매입</button>
            <button class="btn btn-warning btn-small market-sell-btn" data-id="${id}" ${owned <= 0 ? 'disabled' : ''}>매도</button>
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
