// ============================================================
// data.js - 게임 데이터 정의 (자원, 장비, 지역, 몬스터, 레시피, 탈것, 일꾼)
// ============================================================

// ---- 자원 정의 ----
export const RESOURCES = {
  // === 평원 (Tier 1) ===
  wood:           { name: '목재',         tier: 1, category: 'wood',    icon: '🪵' },
  stone:          { name: '돌',           tier: 1, category: 'stone',   icon: '🪨' },
  herb:           { name: '약초',         tier: 1, category: 'herb',    icon: '🌿' },
  fiber:          { name: '식물 섬유',    tier: 1, category: 'fabric',  icon: '🧵' },
  raw_meat:       { name: '생고기',       tier: 1, category: 'food',    icon: '🥩' },

  // === 숲 (Tier 2) ===
  hardwood:       { name: '경목',         tier: 2, category: 'wood',    icon: '🌳' },
  mushroom:       { name: '버섯',         tier: 2, category: 'herb',    icon: '🍄' },
  beast_hide:     { name: '야수 가죽',    tier: 2, category: 'fabric',  icon: '🐾' },
  enchanted_sap:  { name: '마력 수액',    tier: 2, category: 'essence', icon: '💧' },

  // === 동굴 (Tier 2) ===
  iron_ore:       { name: '철광석',       tier: 2, category: 'ore',     icon: '⛏️' },
  coal:           { name: '석탄',         tier: 2, category: 'ore',     icon: '◼️' },
  copper_ore:     { name: '구리광석',     tier: 2, category: 'ore',     icon: '🟠' },
  crystal:        { name: '수정',         tier: 2, category: 'gem',     icon: '💎' },

  // === 사막 (Tier 2) ===
  sand_crystal:   { name: '사막 수정',    tier: 2, category: 'gem',     icon: '🏜️' },
  cactus:         { name: '선인장',       tier: 2, category: 'herb',    icon: '🌵' },
  sun_stone:      { name: '태양석',       tier: 3, category: 'gem',     icon: '☀️' },
  scorpion_shell: { name: '전갈 껍질',    tier: 2, category: 'rare',    icon: '🦂' },

  // === 해안 (Tier 2) ===
  fish:           { name: '물고기',       tier: 1, category: 'food',    icon: '🐟' },
  shell:          { name: '조개껍데기',   tier: 1, category: 'misc',    icon: '🐚' },
  coral:          { name: '산호',         tier: 2, category: 'gem',     icon: '🪸' },
  salt:           { name: '소금',         tier: 1, category: 'misc',    icon: '🧂' },

  // === 산악 (Tier 3) ===
  mithril_ore:    { name: '미스릴 광석',  tier: 3, category: 'ore',     icon: '🔷' },
  frost_fur:      { name: '서리 모피',    tier: 3, category: 'fabric',  icon: '🧊' },
  mountain_herb:  { name: '산삼',         tier: 3, category: 'herb',    icon: '🌱' },
  gold_ore:       { name: '금광석',       tier: 3, category: 'ore',     icon: '🥇' },

  // === 동결지대 (Tier 3) ===
  ice_crystal:    { name: '빙결정',       tier: 3, category: 'gem',     icon: '❄️' },
  ice_essence:    { name: '빙결 정수',    tier: 3, category: 'essence', icon: '🧊' },
  frozen_core:    { name: '동결 핵',      tier: 4, category: 'rare',    icon: '💠' },
  permafrost:     { name: '영구 동토',    tier: 3, category: 'stone',   icon: '🏔️' },

  // === 화산 (Tier 3) ===
  obsidian:       { name: '흑요석',       tier: 3, category: 'stone',   icon: '🖤' },
  fire_essence:   { name: '화염 정수',    tier: 3, category: 'essence', icon: '🔥' },
  magma_core:     { name: '마그마 핵',    tier: 4, category: 'rare',    icon: '🌋' },
  drake_scale:    { name: '드레이크 비늘', tier: 3, category: 'rare',   icon: '🐉' },

  // === 심해 (Tier 3) ===
  deep_pearl:     { name: '심해 진주',    tier: 3, category: 'gem',     icon: '🫧' },
  sea_essence:    { name: '바다 정수',    tier: 3, category: 'essence', icon: '🌊' },
  kraken_ink:     { name: '크라켄 먹물',  tier: 4, category: 'rare',    icon: '🦑' },
  deep_coral:     { name: '심해 산호',    tier: 3, category: 'gem',     icon: '🪸' },

  // === 하늘섬 (Tier 4) ===
  cloud_ore:      { name: '구름 광석',    tier: 4, category: 'ore',     icon: '☁️' },
  wind_crystal:   { name: '바람 수정',    tier: 4, category: 'gem',     icon: '🌬️' },
  phoenix_feather:{ name: '불사조 깃털',  tier: 5, category: 'rare',    icon: '🪶' },
  sky_bloom:      { name: '하늘꽃',       tier: 4, category: 'herb',    icon: '🌸' },

  // === 폭풍 봉우리 (Tier 4) ===
  lightning_essence:{ name: '번개 정수',  tier: 4, category: 'essence', icon: '⚡' },
  storm_steel:    { name: '폭풍강철',     tier: 5, category: 'ore',     icon: '🌩️' },
  storm_pearl:    { name: '폭풍 진주',    tier: 4, category: 'gem',     icon: '💜' },

  // === 고대 던전 (Tier 3) ===
  relic_fragment: { name: '유물 조각',    tier: 3, category: 'rare',    icon: '🏛️' },
  ancient_core:   { name: '고대 핵',      tier: 4, category: 'rare',    icon: '🏺' },
  enchanted_dust: { name: '마력 가루',    tier: 3, category: 'essence', icon: '✨' },

  // === 심연 던전 (Tier 5) ===
  dark_crystal:   { name: '암흑 수정',    tier: 5, category: 'gem',     icon: '🔮' },
  demon_essence:  { name: '마족 정수',    tier: 5, category: 'essence', icon: '👿' },
  void_shard:     { name: '공허 파편',    tier: 5, category: 'cosmic',  icon: '🕳️' },

  // === 소행성대 (Tier 5) ===
  star_dust:      { name: '별의 먼지',    tier: 5, category: 'cosmic',  icon: '✨' },
  star_fragment:  { name: '별 조각',      tier: 5, category: 'cosmic',  icon: '⭐' },
  cosmic_ore:     { name: '우주 광석',    tier: 5, category: 'ore',     icon: '🪐' },
  alien_alloy:    { name: '외계 합금',    tier: 6, category: 'ore',     icon: '🛸' },

  // === 어둠 성운 (Tier 6) ===
  void_essence:   { name: '공허 정수',    tier: 6, category: 'cosmic',  icon: '🌑' },
  nebula_crystal: { name: '성운 수정',    tier: 6, category: 'cosmic',  icon: '🌌' },
  eternity_shard: { name: '영원의 파편',  tier: 7, category: 'cosmic',  icon: '💫' },

  // === 가공 재료 ===
  rope:             { name: '밧줄',         tier: 1, category: 'craft', icon: '🪢', crafted: true },
  cloth:            { name: '천',           tier: 1, category: 'craft', icon: '🧶', crafted: true },
  leather:          { name: '가죽',         tier: 1, category: 'craft', icon: '🟫', crafted: true },
  iron_ingot:       { name: '철괴',         tier: 2, category: 'craft', icon: '🔩', crafted: true },
  copper_ingot:     { name: '구리괴',       tier: 1, category: 'craft', icon: '🟤', crafted: true },
  steel:            { name: '강철',         tier: 3, category: 'craft', icon: '⚙️', crafted: true },
  gold_ingot:       { name: '금괴',         tier: 3, category: 'craft', icon: '🥇', crafted: true },
  enchanted_wood:   { name: '마법 목재',    tier: 3, category: 'craft', icon: '🪄', crafted: true },
  enchanted_crystal:{ name: '마법 수정',    tier: 3, category: 'craft', icon: '💎', crafted: true },
  mithril_ingot:    { name: '미스릴 주괴',  tier: 4, category: 'craft', icon: '🔷', crafted: true },
  reinforced_steel: { name: '강화강철',     tier: 5, category: 'craft', icon: '🛡️', crafted: true },
  void_alloy:       { name: '공허 합금',    tier: 6, category: 'craft', icon: '🌀', crafted: true },
  cooked_meat:      { name: '구운 고기',    tier: 1, category: 'food',  icon: '🍖', crafted: true },
  herb_potion:      { name: '약초 물약',    tier: 1, category: 'food',  icon: '🧪', crafted: true },
  fire_potion:      { name: '화염 물약',    tier: 3, category: 'food',  icon: '🔥', crafted: true },
  ice_potion:       { name: '빙결 물약',    tier: 3, category: 'food',  icon: '❄️', crafted: true },

  // === 스태미나 음식 ===
  herb_stew:        { name: '허브 스튜',    tier: 1, category: 'food',  icon: '🍲', crafted: true },
  nutrient_soup:    { name: '영양 수프',    tier: 2, category: 'food',  icon: '🥣', crafted: true },
  energy_steak:     { name: '에너지 스테이크', tier: 3, category: 'food', icon: '🥩', crafted: true },
  energy_drink:     { name: '정제된 에너지 드링크', tier: 4, category: 'food', icon: '🧃', crafted: true },

  // === 강화 재료 ===
  enhancement_stone:      { name: '강화석', tier: 1, category: 'craft', icon: '💎', crafted: true },
  advanced_enhancement:   { name: '고급 강화석', tier: 2, category: 'craft', icon: '💠', crafted: true },
  superior_enhancement:   { name: '최상급 강화석', tier: 3, category: 'craft', icon: '✨', crafted: true },

  // === 부산물 ===
  mineral_residue:  { name: '광물 찌꺼기', tier: 1, category: 'byproduct', icon: 'ite' },
  metal_dust:       { name: '금속 가루',   tier: 1, category: 'byproduct', icon: '✧' },
  empty_bottle:     { name: '빈 병',       tier: 1, category: 'byproduct', icon: '🫙' },
  food_scraps:      { name: '남은 재료',   tier: 1, category: 'byproduct', icon: '🥡' },

  // === 일꾼 소모품 ===
  repair_kit:       { name: '수리 도구',   tier: 1, category: 'craft',     icon: '🔧', crafted: true },
};

// ---- 장비 정의 ----
export const EQUIPMENT = {
  // === 무기 ===
  wooden_sword:     { name: '목검',         type: 'weapon', slot: 'weapon', tier: 1, icon: '🗡️',
    stats: { attack: 5 }, resistances: {}, desc: '기본적인 나무 검' },
  iron_sword:       { name: '철검',         type: 'weapon', slot: 'weapon', tier: 2, icon: '⚔️',
    stats: { attack: 15 }, resistances: {}, desc: '단단한 철제 검' },
  steel_sword:      { name: '강철 대검',    type: 'weapon', slot: 'weapon', tier: 3, icon: '⚔️',
    stats: { attack: 30, crit: 5 }, resistances: {}, desc: '날카로운 강철 대검' },
  mithril_blade:    { name: '미스릴 검',    type: 'weapon', slot: 'weapon', tier: 4, icon: '🗡️',
    stats: { attack: 55, speed: 10, crit: 8 }, resistances: {}, desc: '가볍고 치명적인 미스릴 검' },
  void_reaper:      { name: '공허의 낫',    type: 'weapon', slot: 'weapon', tier: 6, icon: '⚔️',
    stats: { attack: 120, crit: 15 }, resistances: { void: 20 }, desc: '공허의 힘이 깃든 낫' },
  flame_brand:      { name: '화염검',       type: 'weapon', slot: 'weapon', tier: 3, icon: '🔥',
    stats: { attack: 25, fireDmg: 15 }, resistances: { fire: 10 }, desc: '화염이 타오르는 검' },
  frost_edge:       { name: '서리날',       type: 'weapon', slot: 'weapon', tier: 3, icon: '❄️',
    stats: { attack: 25, iceDmg: 15 }, resistances: { cold: 10 }, desc: '한기가 서린 검' },
  storm_glaive:     { name: '폭풍 글레이브', type: 'weapon', slot: 'weapon', tier: 5, icon: '⚡',
    stats: { attack: 80, lightningDmg: 30, speed: 15 }, resistances: { lightning: 15 }, desc: '번개가 감싸는 무기' },
  cosmic_blade:     { name: '우주의 검',    type: 'weapon', slot: 'weapon', tier: 6, icon: '🌌',
    stats: { attack: 150, crit: 20, speed: 20 }, resistances: {}, desc: '별의 힘이 깃든 최강의 검' },

  // === 방어구 ===
  leather_armor:    { name: '가죽 갑옷',    type: 'armor', slot: 'armor', tier: 1, icon: '🦺',
    stats: { defense: 5, hp: 10 }, resistances: {}, desc: '기본 가죽 갑옷' },
  iron_armor:       { name: '철갑옷',       type: 'armor', slot: 'armor', tier: 2, icon: '🛡️',
    stats: { defense: 15, hp: 20 }, resistances: {}, desc: '견고한 철제 갑옷' },
  steel_plate:      { name: '강철판금',     type: 'armor', slot: 'armor', tier: 3, icon: '🛡️',
    stats: { defense: 30, hp: 40 }, resistances: {}, desc: '무거운 강철 전신갑옷' },
  fire_resist_armor:{ name: '화염 방어구',  type: 'armor', slot: 'armor', tier: 3, icon: '🔥',
    stats: { defense: 20, hp: 30 }, resistances: { fire: 60 }, desc: '화산 탐험을 위한 내열 갑옷' },
  cold_resist_armor:{ name: '방한 갑옷',    type: 'armor', slot: 'armor', tier: 3, icon: '❄️',
    stats: { defense: 20, hp: 30 }, resistances: { cold: 60 }, desc: '동결지대 탐험을 위한 방한 장비' },
  deep_sea_suit:    { name: '심해 잠수복',  type: 'armor', slot: 'armor', tier: 3, icon: '🤿',
    stats: { defense: 15, hp: 25 }, resistances: { pressure: 60 }, desc: '심해 탐사를 위한 내압 잠수복' },
  mithril_mail:     { name: '미스릴 갑옷',  type: 'armor', slot: 'armor', tier: 4, icon: '🛡️',
    stats: { defense: 50, hp: 60, speed: 5 }, resistances: {}, desc: '가볍고 강력한 미스릴 갑옷' },
  lightning_guard:  { name: '번개 방어구',  type: 'armor', slot: 'armor', tier: 4, icon: '⚡',
    stats: { defense: 35, hp: 40 }, resistances: { lightning: 60 }, desc: '폭풍 속에서도 안전한 절연 갑옷' },
  void_shroud:      { name: '공허 장막',    type: 'armor', slot: 'armor', tier: 5, icon: '🌑',
    stats: { defense: 45, hp: 50 }, resistances: { void: 60 }, desc: '심연의 힘을 막아주는 장막' },
  space_suit:       { name: '우주복',       type: 'armor', slot: 'armor', tier: 5, icon: '🧑‍🚀',
    stats: { defense: 40, hp: 45 }, resistances: { radiation: 60, pressure: 30 }, desc: '우주 탐사를 위한 보호복' },
  cosmic_armor:     { name: '성간 갑주',    type: 'armor', slot: 'armor', tier: 6, icon: '🌌',
    stats: { defense: 100, hp: 120, speed: 10 }, resistances: { radiation: 40, void: 40 }, desc: '우주의 힘으로 단조된 최강 갑주' },

  // === 도구 (일꾼 효율) ===
  basic_pickaxe:    { name: '곡괭이',       type: 'tool', slot: 'tool', tier: 1, icon: '⛏️',
    stats: { mining: 20 }, resistances: {}, desc: '광석 채굴 효율 증가' },
  basic_axe:        { name: '도끼',         type: 'tool', slot: 'tool', tier: 1, icon: '🪓',
    stats: { logging: 20 }, resistances: {}, desc: '벌목 효율 증가' },
  fishing_rod:      { name: '낚싯대',       type: 'tool', slot: 'tool', tier: 1, icon: '🎣',
    stats: { fishing: 20 }, resistances: {}, desc: '낚시 효율 증가' },
  iron_pickaxe:     { name: '철 곡괭이',    type: 'tool', slot: 'tool', tier: 2, icon: '⛏️',
    stats: { mining: 50 }, resistances: {}, desc: '강화된 채굴 효율' },
  steel_pickaxe:    { name: '강철 곡괭이',  type: 'tool', slot: 'tool', tier: 3, icon: '⛏️',
    stats: { mining: 100 }, resistances: {}, desc: '최고급 채굴 도구' },
  heat_drill:       { name: '내열 드릴',    type: 'tool', slot: 'tool', tier: 3, icon: '🔥',
    stats: { mining: 60 }, resistances: { fire: 30 }, desc: '화산에서 사용 가능한 드릴' },
  deep_harpoon:     { name: '심해 작살',    type: 'tool', slot: 'tool', tier: 3, icon: '🔱',
    stats: { fishing: 80 }, resistances: { pressure: 30 }, desc: '심해 채집에 특화된 작살' },
  sky_net:          { name: '하늘 채집망',  type: 'tool', slot: 'tool', tier: 4, icon: '🕸️',
    stats: { gathering: 80 }, resistances: {}, desc: '하늘섬 자원 채집용' },
  void_extractor:   { name: '공허 추출기',  type: 'tool', slot: 'tool', tier: 5, icon: '🌀',
    stats: { mining: 120, gathering: 80 }, resistances: { void: 20 }, desc: '공허 자원 채집 특화 도구' },

  // === 악세서리 ===
  lucky_charm:      { name: '행운의 부적',  type: 'accessory', slot: 'accessory', tier: 1, icon: '🍀',
    stats: { luck: 10 }, resistances: {}, desc: '드롭률 소폭 증가' },
  fire_amulet:      { name: '화염 부적',    type: 'accessory', slot: 'accessory', tier: 2, icon: '🔥',
    stats: { luck: 5 }, resistances: { fire: 30 }, desc: '화염 저항 증가' },
  frost_ring:       { name: '서리 반지',    type: 'accessory', slot: 'accessory', tier: 2, icon: '💍',
    stats: { luck: 5 }, resistances: { cold: 30 }, desc: '냉기 저항 증가' },
  pressure_charm:   { name: '수압 부적',    type: 'accessory', slot: 'accessory', tier: 3, icon: '🫧',
    stats: {}, resistances: { pressure: 30 }, desc: '수압 저항 증가' },
  lightning_ring:   { name: '번개 반지',    type: 'accessory', slot: 'accessory', tier: 4, icon: '⚡',
    stats: { speed: 10 }, resistances: { lightning: 30 }, desc: '번개 저항과 속도 증가' },
  radiation_badge:  { name: '방사선 배지',  type: 'accessory', slot: 'accessory', tier: 5, icon: '☢️',
    stats: {}, resistances: { radiation: 40 }, desc: '우주 방사선 차단' },
  void_pendant:     { name: '공허 펜던트',  type: 'accessory', slot: 'accessory', tier: 5, icon: '🌑',
    stats: { luck: 15 }, resistances: { void: 40 }, desc: '공허 저항과 행운 증가' },
  eternity_ring:    { name: '영원의 반지',  type: 'accessory', slot: 'accessory', tier: 7, icon: '💫',
    stats: { attack: 30, defense: 30, luck: 30, speed: 20 }, resistances: { fire: 20, cold: 20, lightning: 20, void: 20, pressure: 20, radiation: 20 }, desc: '모든 것을 초월한 궁극의 장신구' },
};

// ---- 지역 정의 ----
export const ZONES = {
  plains: {
    name: '평원', icon: '🌾', tier: 1,
    desc: '탐험의 시작점. 기본 자원을 수집할 수 있다.',
    environment: null, requiredResist: {},
    requiredVehicle: null, requiredZone: null,
    resources: ['wood','stone','herb','fiber','raw_meat'],
    resourceRates: { wood: 1.0, stone: 0.8, herb: 0.6, fiber: 0.7, raw_meat: 0.4 },
    monsters: ['slime','wild_boar'],
    workerSlots: 3, hazardDmg: 0,
  },
  forest: {
    name: '숲', icon: '🌲', tier: 2,
    desc: '울창한 숲. 경목과 마력 수액을 얻을 수 있다.',
    environment: null, requiredResist: {},
    requiredVehicle: null, requiredZone: 'plains',
    resources: ['hardwood','mushroom','beast_hide','enchanted_sap','herb'],
    resourceRates: { hardwood: 0.8, mushroom: 0.6, beast_hide: 0.5, enchanted_sap: 0.2, herb: 0.4 },
    monsters: ['forest_wolf','treant'],
    workerSlots: 3, hazardDmg: 0,
  },
  cave: {
    name: '동굴', icon: '🕳️', tier: 2,
    desc: '어두운 동굴. 광석과 수정이 매장되어 있다.',
    environment: 'dark', requiredResist: {},
    requiredVehicle: null, requiredZone: 'plains',
    resources: ['iron_ore','coal','copper_ore','crystal'],
    resourceRates: { iron_ore: 0.7, coal: 0.8, copper_ore: 0.6, crystal: 0.2 },
    monsters: ['cave_bat','rock_golem'],
    workerSlots: 3, hazardDmg: 0,
  },
  desert: {
    name: '사막', icon: '🏜️', tier: 2,
    desc: '뜨거운 사막. 특수한 수정과 재료가 있다.',
    environment: 'heat', requiredResist: { fire: 20 },
    requiredVehicle: null, requiredZone: 'plains',
    resources: ['sand_crystal','cactus','sun_stone','scorpion_shell'],
    resourceRates: { sand_crystal: 0.6, cactus: 0.8, sun_stone: 0.15, scorpion_shell: 0.3 },
    monsters: ['sand_scorpion','desert_worm'],
    workerSlots: 3, hazardDmg: 2,
  },
  coast: {
    name: '해안', icon: '🏖️', tier: 2,
    desc: '잔잔한 해변. 어류와 해양 자원을 채집한다.',
    environment: null, requiredResist: {},
    requiredVehicle: null, requiredZone: 'plains',
    resources: ['fish','shell','coral','salt'],
    resourceRates: { fish: 1.0, shell: 0.7, coral: 0.3, salt: 0.8 },
    monsters: ['crab_guardian'],
    workerSlots: 3, hazardDmg: 0,
  },
  mountain: {
    name: '산악', icon: '⛰️', tier: 3,
    desc: '험준한 산맥. 희귀 광석과 약초가 자란다.',
    environment: 'cold', requiredResist: { cold: 30 },
    requiredVehicle: null, requiredZone: 'cave',
    resources: ['mithril_ore','frost_fur','mountain_herb','gold_ore','iron_ore'],
    resourceRates: { mithril_ore: 0.3, frost_fur: 0.4, mountain_herb: 0.3, gold_ore: 0.2, iron_ore: 0.5 },
    monsters: ['mountain_troll','frost_bear','mountain_drake'],
    workerSlots: 4, hazardDmg: 3,
  },
  frozen_waste: {
    name: '동결지대', icon: '🧊', tier: 3,
    desc: '얼어붙은 땅. 빙결 자원과 동결 핵이 있다.',
    environment: 'cold', requiredResist: { cold: 50 },
    requiredVehicle: null, requiredZone: 'mountain',
    resources: ['ice_crystal','ice_essence','frozen_core','permafrost'],
    resourceRates: { ice_crystal: 0.5, ice_essence: 0.3, frozen_core: 0.08, permafrost: 0.6 },
    monsters: ['ice_elemental','frost_wyrm'],
    workerSlots: 4, hazardDmg: 5,
  },
  volcano: {
    name: '화산', icon: '🌋', tier: 3,
    desc: '용암이 흐르는 화산. 화염 자원과 흑요석의 산지.',
    environment: 'fire', requiredResist: { fire: 50 },
    requiredVehicle: null, requiredZone: 'mountain',
    resources: ['obsidian','fire_essence','magma_core','drake_scale'],
    resourceRates: { obsidian: 0.6, fire_essence: 0.4, magma_core: 0.06, drake_scale: 0.1 },
    monsters: ['fire_imp','lava_golem','fire_drake'],
    workerSlots: 4, hazardDmg: 5,
  },
  deep_sea: {
    name: '심해', icon: '🌊', tier: 3,
    desc: '바다 깊은 곳. 진주와 바다 정수를 채집한다.',
    environment: 'pressure', requiredResist: { pressure: 40 },
    requiredVehicle: 'boat', requiredZone: 'coast',
    resources: ['deep_pearl','sea_essence','kraken_ink','deep_coral'],
    resourceRates: { deep_pearl: 0.3, sea_essence: 0.4, kraken_ink: 0.05, deep_coral: 0.5 },
    monsters: ['deep_angler','kraken_spawn'],
    workerSlots: 4, hazardDmg: 4,
  },
  ancient_dungeon: {
    name: '고대 던전', icon: '🏛️', tier: 3,
    desc: '고대 문명의 유적. 유물과 마력 가루가 잠들어 있다.',
    environment: 'dark', requiredResist: {},
    requiredVehicle: null, requiredZone: 'cave',
    resources: ['relic_fragment','ancient_core','enchanted_dust'],
    resourceRates: { relic_fragment: 0.4, ancient_core: 0.08, enchanted_dust: 0.5 },
    monsters: ['undead_knight','ancient_golem','dungeon_boss_phantom'],
    workerSlots: 3, hazardDmg: 3,
  },
  sky_island: {
    name: '하늘섬', icon: '🏝️', tier: 4,
    desc: '구름 위의 떠있는 섬. 하늘의 자원이 가득하다.',
    environment: null, requiredResist: {},
    requiredVehicle: 'airship', requiredZone: 'mountain',
    resources: ['cloud_ore','wind_crystal','phoenix_feather','sky_bloom'],
    resourceRates: { cloud_ore: 0.5, wind_crystal: 0.4, phoenix_feather: 0.04, sky_bloom: 0.6 },
    monsters: ['sky_serpent','thunder_hawk','phoenix_juvenile'],
    workerSlots: 4, hazardDmg: 0,
  },
  storm_peaks: {
    name: '폭풍 봉우리', icon: '🌩️', tier: 4,
    desc: '번개가 끊이지 않는 봉우리. 폭풍강철의 산지.',
    environment: 'lightning', requiredResist: { lightning: 50 },
    requiredVehicle: 'airship', requiredZone: 'sky_island',
    resources: ['lightning_essence','storm_steel','storm_pearl'],
    resourceRates: { lightning_essence: 0.4, storm_steel: 0.15, storm_pearl: 0.1 },
    monsters: ['storm_elemental','thunder_dragon'],
    workerSlots: 4, hazardDmg: 6,
  },
  abyssal_dungeon: {
    name: '심연 던전', icon: '🕳️', tier: 5,
    desc: '세계의 가장 깊은 곳. 공허의 힘이 지배하는 곳.',
    environment: 'void', requiredResist: { void: 50 },
    requiredVehicle: null, requiredZone: 'ancient_dungeon',
    resources: ['dark_crystal','demon_essence','void_shard'],
    resourceRates: { dark_crystal: 0.3, demon_essence: 0.2, void_shard: 0.08 },
    monsters: ['shadow_demon','void_horror','abyss_lord'],
    workerSlots: 3, hazardDmg: 8,
  },
  asteroid_belt: {
    name: '소행성대', icon: '☄️', tier: 5,
    desc: '우주의 소행성 지대. 우주 광석과 별 조각이 떠다닌다.',
    environment: 'radiation', requiredResist: { radiation: 50 },
    requiredVehicle: 'spaceship', requiredZone: 'sky_island',
    resources: ['star_dust','star_fragment','cosmic_ore','alien_alloy'],
    resourceRates: { star_dust: 0.5, star_fragment: 0.15, cosmic_ore: 0.3, alien_alloy: 0.05 },
    monsters: ['space_drone','asteroid_worm','cosmic_guardian'],
    workerSlots: 5, hazardDmg: 7,
  },
  dark_nebula: {
    name: '어둠 성운', icon: '🌌', tier: 6,
    desc: '우주 끝의 암흑 지대. 궁극의 자원이 잠들어 있다.',
    environment: 'void', requiredResist: { void: 70, radiation: 40 },
    requiredVehicle: 'dreadnought', requiredZone: 'asteroid_belt',
    resources: ['void_essence','nebula_crystal','eternity_shard'],
    resourceRates: { void_essence: 0.3, nebula_crystal: 0.15, eternity_shard: 0.02 },
    monsters: ['nebula_wraith','void_titan','eldritch_god'],
    workerSlots: 5, hazardDmg: 10,
  },
};

// ---- 몬스터 정의 ----
export const MONSTERS = {
  // 평원
  slime:          { name: '슬라임',      icon: '🟢', tier: 1, hp: 30,  atk: 5,   def: 2,  spd: 5,  element: null,    weakness: null,
    loot: [{ id:'herb', chance:0.5, min:1, max:2 },{ id:'fiber', chance:0.3, min:1, max:1 }], exp: 10, gold: 5 },
  wild_boar:      { name: '멧돼지',      icon: '🐗', tier: 1, hp: 50,  atk: 10,  def: 5,  spd: 8,  element: null,    weakness: null,
    loot: [{ id:'raw_meat', chance:0.8, min:1, max:3 },{ id:'beast_hide', chance:0.3, min:1, max:1 }], exp: 20, gold: 10 },

  // 숲
  forest_wolf:    { name: '숲 늑대',     icon: '🐺', tier: 2, hp: 80,  atk: 18,  def: 8,  spd: 15, element: null,    weakness: 'fire',
    loot: [{ id:'beast_hide', chance:0.7, min:1, max:2 },{ id:'raw_meat', chance:0.5, min:1, max:2 }], exp: 35, gold: 18 },
  treant:         { name: '트렌트',      icon: '🌳', tier: 2, hp: 120, atk: 15,  def: 20, spd: 3,  element: null,    weakness: 'fire',
    loot: [{ id:'hardwood', chance:0.9, min:2, max:4 },{ id:'enchanted_sap', chance:0.3, min:1, max:1 }], exp: 45, gold: 22 },

  // 동굴
  cave_bat:       { name: '동굴 박쥐',   icon: '🦇', tier: 2, hp: 40,  atk: 12,  def: 4,  spd: 20, element: 'dark',  weakness: 'fire',
    loot: [{ id:'coal', chance:0.4, min:1, max:2 }], exp: 25, gold: 12 },
  rock_golem:     { name: '바위 골렘',   icon: '🗿', tier: 2, hp: 180, atk: 22,  def: 30, spd: 2,  element: null,    weakness: null,
    loot: [{ id:'iron_ore', chance:0.8, min:2, max:4 },{ id:'crystal', chance:0.2, min:1, max:1 },{ id:'copper_ore', chance:0.5, min:1, max:3 }], exp: 55, gold: 30 },

  // 사막
  sand_scorpion:  { name: '사막 전갈',   icon: '🦂', tier: 2, hp: 70,  atk: 20,  def: 15, spd: 12, element: null,    weakness: 'cold',
    loot: [{ id:'scorpion_shell', chance:0.6, min:1, max:2 },{ id:'sand_crystal', chance:0.3, min:1, max:1 }], exp: 35, gold: 20 },
  desert_worm:    { name: '사막 지렁이', icon: '🪱', tier: 2, hp: 150, atk: 25,  def: 10, spd: 5,  element: 'fire',  weakness: 'cold',
    loot: [{ id:'sand_crystal', chance:0.5, min:1, max:3 },{ id:'sun_stone', chance:0.1, min:1, max:1 }], exp: 50, gold: 28 },

  // 해안
  crab_guardian:  { name: '게 수호자',   icon: '🦀', tier: 2, hp: 100, atk: 15,  def: 25, spd: 6,  element: null,    weakness: null,
    loot: [{ id:'shell', chance:0.8, min:1, max:3 },{ id:'coral', chance:0.3, min:1, max:1 },{ id:'fish', chance:0.6, min:1, max:2 }], exp: 40, gold: 20 },

  // 산악
  mountain_troll: { name: '산 트롤',     icon: '👹', tier: 3, hp: 250, atk: 35,  def: 25, spd: 6,  element: null,    weakness: 'fire',
    loot: [{ id:'frost_fur', chance:0.5, min:1, max:2 },{ id:'mountain_herb', chance:0.3, min:1, max:1 }], exp: 80, gold: 45 },
  frost_bear:     { name: '서리 곰',     icon: '🐻‍❄️', tier: 3, hp: 300, atk: 40,  def: 20, spd: 10, element: 'cold',  weakness: 'fire',
    loot: [{ id:'frost_fur', chance:0.8, min:2, max:3 },{ id:'ice_crystal', chance:0.2, min:1, max:1 }], exp: 95, gold: 50 },
  mountain_drake: { name: '산악 드레이크', icon: '🐲', tier: 3, hp: 400, atk: 50,  def: 35, spd: 12, element: 'cold',  weakness: 'fire',
    loot: [{ id:'drake_scale', chance:0.4, min:1, max:2 },{ id:'mithril_ore', chance:0.2, min:1, max:2 }], exp: 130, gold: 70 },

  // 동결지대
  ice_elemental:  { name: '빙결 정령',   icon: '❄️', tier: 3, hp: 280, atk: 38,  def: 18, spd: 14, element: 'cold',  weakness: 'fire',
    loot: [{ id:'ice_essence', chance:0.7, min:1, max:3 },{ id:'ice_crystal', chance:0.5, min:1, max:2 }], exp: 90, gold: 48 },
  frost_wyrm:     { name: '서리 웜',     icon: '🐛', tier: 4, hp: 500, atk: 55,  def: 30, spd: 8,  element: 'cold',  weakness: 'fire',
    loot: [{ id:'frozen_core', chance:0.15, min:1, max:1 },{ id:'ice_essence', chance:0.6, min:2, max:4 }], exp: 160, gold: 85 },

  // 화산
  fire_imp:       { name: '화염 임프',   icon: '👹', tier: 3, hp: 150, atk: 30,  def: 10, spd: 18, element: 'fire',  weakness: 'cold',
    loot: [{ id:'fire_essence', chance:0.6, min:1, max:2 },{ id:'obsidian', chance:0.4, min:1, max:2 }], exp: 70, gold: 38 },
  lava_golem:     { name: '용암 골렘',   icon: '🔥', tier: 3, hp: 450, atk: 45,  def: 40, spd: 3,  element: 'fire',  weakness: 'cold',
    loot: [{ id:'obsidian', chance:0.8, min:2, max:5 },{ id:'magma_core', chance:0.1, min:1, max:1 }], exp: 120, gold: 65 },
  fire_drake:     { name: '화염 드레이크', icon: '🐉', tier: 4, hp: 600, atk: 60,  def: 35, spd: 15, element: 'fire',  weakness: 'cold',
    loot: [{ id:'drake_scale', chance:0.5, min:2, max:3 },{ id:'magma_core', chance:0.2, min:1, max:1 },{ id:'fire_essence', chance:0.8, min:2, max:5 }], exp: 180, gold: 95 },

  // 심해
  deep_angler:    { name: '심해 아귀',   icon: '🐡', tier: 3, hp: 200, atk: 35,  def: 15, spd: 10, element: null,    weakness: 'lightning',
    loot: [{ id:'deep_pearl', chance:0.5, min:1, max:2 },{ id:'deep_coral', chance:0.6, min:1, max:3 }], exp: 85, gold: 45 },
  kraken_spawn:   { name: '크라켄 새끼', icon: '🦑', tier: 4, hp: 550, atk: 55,  def: 25, spd: 12, element: null,    weakness: 'lightning',
    loot: [{ id:'kraken_ink', chance:0.15, min:1, max:1 },{ id:'sea_essence', chance:0.6, min:2, max:4 },{ id:'deep_pearl', chance:0.4, min:1, max:2 }], exp: 165, gold: 88 },

  // 고대 던전
  undead_knight:  { name: '언데드 기사', icon: '💀', tier: 3, hp: 300, atk: 40,  def: 30, spd: 8,  element: 'dark',  weakness: 'fire',
    loot: [{ id:'relic_fragment', chance:0.6, min:1, max:2 },{ id:'enchanted_dust', chance:0.4, min:1, max:2 }], exp: 95, gold: 50 },
  ancient_golem:  { name: '고대 골렘',   icon: '🗿', tier: 3, hp: 500, atk: 45,  def: 45, spd: 3,  element: null,    weakness: null,
    loot: [{ id:'ancient_core', chance:0.12, min:1, max:1 },{ id:'relic_fragment', chance:0.7, min:2, max:3 }], exp: 140, gold: 75 },
  dungeon_boss_phantom: { name: '유령 군주', icon: '👻', tier: 4, hp: 800, atk: 60, def: 20, spd: 20, element: 'dark', weakness: 'fire',
    loot: [{ id:'ancient_core', chance:0.3, min:1, max:2 },{ id:'enchanted_dust', chance:0.8, min:3, max:6 }], exp: 250, gold: 130, isRaid: true },

  // 하늘섬
  sky_serpent:     { name: '하늘 뱀',     icon: '🐍', tier: 4, hp: 350, atk: 50,  def: 20, spd: 22, element: null,    weakness: 'lightning',
    loot: [{ id:'wind_crystal', chance:0.5, min:1, max:2 },{ id:'sky_bloom', chance:0.4, min:1, max:2 }], exp: 130, gold: 70 },
  thunder_hawk:   { name: '천둥 매',     icon: '🦅', tier: 4, hp: 280, atk: 55,  def: 15, spd: 30, element: 'lightning', weakness: null,
    loot: [{ id:'wind_crystal', chance:0.6, min:1, max:3 },{ id:'cloud_ore', chance:0.3, min:1, max:2 }], exp: 140, gold: 75 },
  phoenix_juvenile:{ name: '어린 불사조', icon: '🔥', tier: 4, hp: 700, atk: 65,  def: 30, spd: 18, element: 'fire',  weakness: 'cold',
    loot: [{ id:'phoenix_feather', chance:0.2, min:1, max:1 },{ id:'fire_essence', chance:0.7, min:2, max:4 }], exp: 220, gold: 115, isRaid: true },

  // 폭풍 봉우리
  storm_elemental:{ name: '폭풍 정령',   icon: '🌪️', tier: 4, hp: 450, atk: 60,  def: 25, spd: 25, element: 'lightning', weakness: null,
    loot: [{ id:'lightning_essence', chance:0.6, min:1, max:3 },{ id:'storm_pearl', chance:0.15, min:1, max:1 }], exp: 170, gold: 90 },
  thunder_dragon: { name: '뇌룡',       icon: '🐲', tier: 5, hp: 1200, atk: 85, def: 45, spd: 20, element: 'lightning', weakness: null,
    loot: [{ id:'storm_steel', chance:0.25, min:1, max:2 },{ id:'lightning_essence', chance:0.8, min:3, max:6 },{ id:'storm_pearl', chance:0.3, min:1, max:2 }], exp: 350, gold: 180, isRaid: true },

  // 심연 던전
  shadow_demon:   { name: '그림자 악마', icon: '👿', tier: 5, hp: 600, atk: 70,  def: 30, spd: 22, element: 'dark',  weakness: null,
    loot: [{ id:'demon_essence', chance:0.5, min:1, max:2 },{ id:'dark_crystal', chance:0.4, min:1, max:2 }], exp: 200, gold: 105 },
  void_horror:    { name: '공허 괴물',   icon: '🕳️', tier: 5, hp: 800, atk: 80,  def: 35, spd: 15, element: 'void',  weakness: null,
    loot: [{ id:'void_shard', chance:0.15, min:1, max:1 },{ id:'dark_crystal', chance:0.6, min:1, max:3 }], exp: 260, gold: 135 },
  abyss_lord:     { name: '심연의 군주', icon: '😈', tier: 5, hp: 2000, atk: 100, def: 50, spd: 18, element: 'void', weakness: null,
    loot: [{ id:'void_shard', chance:0.4, min:2, max:3 },{ id:'demon_essence', chance:0.8, min:3, max:6 },{ id:'dark_crystal', chance:0.7, min:2, max:4 }], exp: 500, gold: 260, isRaid: true },

  // 소행성대
  space_drone:    { name: '우주 드론',   icon: '🤖', tier: 5, hp: 400, atk: 65,  def: 40, spd: 25, element: null,    weakness: 'lightning',
    loot: [{ id:'cosmic_ore', chance:0.5, min:1, max:2 },{ id:'star_dust', chance:0.6, min:1, max:3 }], exp: 190, gold: 100 },
  asteroid_worm:  { name: '소행성 웜',   icon: '🪱', tier: 5, hp: 700, atk: 75,  def: 30, spd: 10, element: null,    weakness: null,
    loot: [{ id:'cosmic_ore', chance:0.7, min:2, max:4 },{ id:'star_fragment', chance:0.15, min:1, max:1 }], exp: 230, gold: 120 },
  cosmic_guardian: { name: '우주 수호자', icon: '🛸', tier: 5, hp: 1500, atk: 90, def: 55, spd: 20, element: null, weakness: null,
    loot: [{ id:'alien_alloy', chance:0.2, min:1, max:1 },{ id:'star_fragment', chance:0.4, min:1, max:2 },{ id:'cosmic_ore', chance:0.8, min:3, max:6 }], exp: 420, gold: 220, isRaid: true },

  // 어둠 성운
  nebula_wraith:  { name: '성운 망령',   icon: '👻', tier: 6, hp: 900, atk: 95,  def: 35, spd: 28, element: 'void',  weakness: null,
    loot: [{ id:'void_essence', chance:0.5, min:1, max:2 },{ id:'nebula_crystal', chance:0.3, min:1, max:1 }], exp: 320, gold: 170 },
  void_titan:     { name: '공허 타이탄', icon: '🌑', tier: 6, hp: 1800, atk: 110, def: 60, spd: 12, element: 'void', weakness: null,
    loot: [{ id:'nebula_crystal', chance:0.4, min:1, max:2 },{ id:'void_essence', chance:0.7, min:2, max:4 }], exp: 450, gold: 240 },
  eldritch_god:   { name: '엘드리치 신', icon: '🌀', tier: 7, hp: 5000, atk: 150, def: 80, spd: 25, element: 'void', weakness: null,
    loot: [{ id:'eternity_shard', chance:0.3, min:1, max:1 },{ id:'nebula_crystal', chance:0.8, min:3, max:5 },{ id:'void_essence', chance:0.9, min:4, max:8 }], exp: 1000, gold: 500, isRaid: true },
};

// ---- 제작 레시피 ----
export const RECIPES = [
  // === 기본 가공 ===
  { id: 'rope',       name: '밧줄',        result: 'rope',       type: 'material', amount: 2,
    ingredients: [{ id:'fiber', amount:3 }] },
  { id: 'cloth',      name: '천',          result: 'cloth',      type: 'material', amount: 2,
    ingredients: [{ id:'fiber', amount:5 }] },
  { id: 'leather',    name: '가죽',        result: 'leather',    type: 'material', amount: 1,
    ingredients: [{ id:'beast_hide', amount:2 },{ id:'salt', amount:1 }] },
  { id: 'cooked_meat',name: '구운 고기',   result: 'cooked_meat',type: 'food',     amount: 1,
    ingredients: [{ id:'raw_meat', amount:1 },{ id:'coal', amount:1 }] },
  { id: 'herb_potion',name: '약초 물약',   result: 'herb_potion',type: 'food',     amount: 1,
    ingredients: [{ id:'herb', amount:3 },{ id:'mushroom', amount:1 }] },

  // === 금속 가공 ===
  { id: 'copper_ingot', name: '구리괴',    result: 'copper_ingot', type: 'material', amount: 1,
    ingredients: [{ id:'copper_ore', amount:3 },{ id:'coal', amount:1 }] },
  { id: 'iron_ingot', name: '철괴',        result: 'iron_ingot', type: 'material', amount: 1,
    ingredients: [{ id:'iron_ore', amount:3 },{ id:'coal', amount:2 }] },
  { id: 'steel',      name: '강철',        result: 'steel',      type: 'material', amount: 1,
    ingredients: [{ id:'iron_ingot', amount:2 },{ id:'coal', amount:3 }] },
  { id: 'gold_ingot', name: '금괴',        result: 'gold_ingot', type: 'material', amount: 1,
    ingredients: [{ id:'gold_ore', amount:3 },{ id:'coal', amount:2 }] },
  { id: 'enchanted_wood', name: '마법 목재', result: 'enchanted_wood', type: 'material', amount: 1,
    ingredients: [{ id:'hardwood', amount:3 },{ id:'enchanted_sap', amount:2 }] },
  { id: 'enchanted_crystal', name: '마법 수정', result: 'enchanted_crystal', type: 'material', amount: 1,
    ingredients: [{ id:'crystal', amount:3 },{ id:'enchanted_dust', amount:2 }] },
  { id: 'mithril_ingot', name: '미스릴 주괴', result: 'mithril_ingot', type: 'material', amount: 1,
    ingredients: [{ id:'mithril_ore', amount:3 },{ id:'coal', amount:3 },{ id:'crystal', amount:1 }] },
  { id: 'reinforced_steel', name: '강화강철', result: 'reinforced_steel', type: 'material', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'mithril_ingot', amount:1 },{ id:'fire_essence', amount:2 }] },
  { id: 'void_alloy', name: '공허 합금',   result: 'void_alloy', type: 'material', amount: 1,
    ingredients: [{ id:'reinforced_steel', amount:2 },{ id:'void_shard', amount:3 },{ id:'dark_crystal', amount:2 }] },

  // === 물약 ===
  { id: 'fire_potion', name: '화염 물약',  result: 'fire_potion', type: 'food', amount: 1,
    ingredients: [{ id:'fire_essence', amount:2 },{ id:'herb', amount:2 },{ id:'cactus', amount:1 }] },
  { id: 'ice_potion',  name: '빙결 물약',  result: 'ice_potion',  type: 'food', amount: 1,
    ingredients: [{ id:'ice_essence', amount:2 },{ id:'mountain_herb', amount:1 },{ id:'herb', amount:2 }] },

  // === 스태미나 음식 ===
  { id: 'herb_stew', name: '허브 스튜', result: 'herb_stew', type: 'food', amount: 1,
    ingredients: [{ id:'herb', amount:10 },{ id:'raw_meat', amount:5 },{ id:'mushroom', amount:3 }] },
  { id: 'nutrient_soup', name: '영양 수프', result: 'nutrient_soup', type: 'food', amount: 1,
    ingredients: [{ id:'mushroom', amount:15 },{ id:'fish', amount:8 },{ id:'herb', amount:5 }] },
  { id: 'energy_steak', name: '에너지 스테이크', result: 'energy_steak', type: 'food', amount: 1,
    ingredients: [{ id:'cooked_meat', amount:8 },{ id:'mountain_herb', amount:10 },{ id:'salt', amount:5 }] },
  { id: 'energy_drink', name: '정제된 에너지 드링크', result: 'energy_drink', type: 'food', amount: 1,
    ingredients: [{ id:'sky_bloom', amount:20 },{ id:'crystal', amount:10 },{ id:'deep_pearl', amount:15 }] },

  // === 강화석 제작 ===
  { id: 'enhancement_stone', name: '강화석', result: 'enhancement_stone', type: 'material', amount: 1,
    ingredients: [{ id:'stone', amount:3 },{ id:'coal', amount:1 }] },
  { id: 'advanced_enhancement', name: '고급 강화석', result: 'advanced_enhancement', type: 'material', amount: 1,
    ingredients: [{ id:'iron_ore', amount:3 },{ id:'coal', amount:2 }] },
  { id: 'superior_enhancement', name: '최상급 강화석', result: 'superior_enhancement', type: 'material', amount: 1,
    ingredients: [{ id:'mithril_ore', amount:3 },{ id:'crystal', amount:1 }] },

  // === 무기 제작 ===
  { id: 'wooden_sword', name: '목검',      result: 'wooden_sword', type: 'equipment', amount: 1,
    ingredients: [{ id:'wood', amount:5 },{ id:'fiber', amount:2 }] },
  { id: 'iron_sword',   name: '철검',      result: 'iron_sword', type: 'equipment', amount: 1,
    ingredients: [{ id:'iron_ingot', amount:3 },{ id:'wood', amount:2 },{ id:'leather', amount:1 }] },
  { id: 'steel_sword',  name: '강철 대검', result: 'steel_sword', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:4 },{ id:'leather', amount:2 },{ id:'iron_ingot', amount:1 }] },
  { id: 'flame_brand',  name: '화염검',    result: 'flame_brand', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'fire_essence', amount:5 },{ id:'magma_core', amount:1 }] },
  { id: 'frost_edge',   name: '서리날',    result: 'frost_edge', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'ice_essence', amount:5 },{ id:'frozen_core', amount:1 }] },
  { id: 'mithril_blade',name: '미스릴 검', result: 'mithril_blade', type: 'equipment', amount: 1,
    ingredients: [{ id:'mithril_ingot', amount:5 },{ id:'enchanted_crystal', amount:2 },{ id:'gold_ingot', amount:1 }] },
  { id: 'storm_glaive', name: '폭풍 글레이브', result: 'storm_glaive', type: 'equipment', amount: 1,
    ingredients: [{ id:'storm_steel', amount:4 },{ id:'lightning_essence', amount:5 },{ id:'mithril_ingot', amount:2 }] },
  { id: 'void_reaper',  name: '공허의 낫', result: 'void_reaper', type: 'equipment', amount: 1,
    ingredients: [{ id:'void_alloy', amount:4 },{ id:'demon_essence', amount:5 },{ id:'dark_crystal', amount:3 }] },
  { id: 'cosmic_blade', name: '우주의 검', result: 'cosmic_blade', type: 'equipment', amount: 1,
    ingredients: [{ id:'alien_alloy', amount:5 },{ id:'star_fragment', amount:3 },{ id:'eternity_shard', amount:1 },{ id:'void_alloy', amount:2 }] },

  // === 방어구 제작 ===
  { id: 'leather_armor', name: '가죽 갑옷', result: 'leather_armor', type: 'equipment', amount: 1,
    ingredients: [{ id:'leather', amount:5 },{ id:'fiber', amount:3 }] },
  { id: 'iron_armor',   name: '철갑옷',    result: 'iron_armor', type: 'equipment', amount: 1,
    ingredients: [{ id:'iron_ingot', amount:5 },{ id:'leather', amount:3 }] },
  { id: 'steel_plate',  name: '강철판금',  result: 'steel_plate', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:6 },{ id:'iron_ingot', amount:3 },{ id:'leather', amount:2 }] },
  { id: 'fire_resist_armor', name: '화염 방어구', result: 'fire_resist_armor', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:4 },{ id:'obsidian', amount:8 },{ id:'ice_crystal', amount:3 },{ id:'drake_scale', amount:2 }] },
  { id: 'cold_resist_armor', name: '방한 갑옷', result: 'cold_resist_armor', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'frost_fur', amount:6 },{ id:'fire_essence', amount:2 },{ id:'leather', amount:3 }] },
  { id: 'deep_sea_suit',name: '심해 잠수복', result: 'deep_sea_suit', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'coral', amount:5 },{ id:'leather', amount:4 },{ id:'copper_ingot', amount:3 }] },
  { id: 'mithril_mail', name: '미스릴 갑옷', result: 'mithril_mail', type: 'equipment', amount: 1,
    ingredients: [{ id:'mithril_ingot', amount:6 },{ id:'enchanted_crystal', amount:3 },{ id:'leather', amount:4 }] },
  { id: 'lightning_guard', name: '번개 방어구', result: 'lightning_guard', type: 'equipment', amount: 1,
    ingredients: [{ id:'mithril_ingot', amount:3 },{ id:'storm_pearl', amount:3 },{ id:'cloud_ore', amount:5 },{ id:'rubber', amount:3 }].filter(i => i.id !== 'rubber').concat([{ id:'coral', amount:4 }]) },
  { id: 'void_shroud',  name: '공허 장막', result: 'void_shroud', type: 'equipment', amount: 1,
    ingredients: [{ id:'void_shard', amount:5 },{ id:'dark_crystal', amount:4 },{ id:'demon_essence', amount:3 },{ id:'reinforced_steel', amount:3 }] },
  { id: 'space_suit',   name: '우주복',    result: 'space_suit', type: 'equipment', amount: 1,
    ingredients: [{ id:'reinforced_steel', amount:5 },{ id:'enchanted_crystal', amount:3 },{ id:'star_dust', amount:5 },{ id:'mithril_ingot', amount:2 }] },
  { id: 'cosmic_armor', name: '성간 갑주', result: 'cosmic_armor', type: 'equipment', amount: 1,
    ingredients: [{ id:'alien_alloy', amount:6 },{ id:'nebula_crystal', amount:3 },{ id:'void_alloy', amount:3 },{ id:'eternity_shard', amount:1 }] },

  // === 도구 제작 ===
  { id: 'basic_pickaxe', name: '곡괭이',   result: 'basic_pickaxe', type: 'equipment', amount: 1,
    ingredients: [{ id:'wood', amount:3 },{ id:'stone', amount:5 }] },
  { id: 'basic_axe',    name: '도끼',      result: 'basic_axe', type: 'equipment', amount: 1,
    ingredients: [{ id:'wood', amount:3 },{ id:'stone', amount:4 }] },
  { id: 'fishing_rod',  name: '낚싯대',    result: 'fishing_rod', type: 'equipment', amount: 1,
    ingredients: [{ id:'wood', amount:4 },{ id:'fiber', amount:3 }] },
  { id: 'iron_pickaxe', name: '철 곡괭이', result: 'iron_pickaxe', type: 'equipment', amount: 1,
    ingredients: [{ id:'iron_ingot', amount:3 },{ id:'wood', amount:2 }] },
  { id: 'steel_pickaxe',name: '강철 곡괭이', result: 'steel_pickaxe', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'hardwood', amount:2 }] },
  { id: 'heat_drill',   name: '내열 드릴', result: 'heat_drill', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:4 },{ id:'obsidian', amount:5 },{ id:'fire_essence', amount:3 }] },
  { id: 'deep_harpoon', name: '심해 작살', result: 'deep_harpoon', type: 'equipment', amount: 1,
    ingredients: [{ id:'steel', amount:3 },{ id:'deep_coral', amount:3 },{ id:'sea_essence', amount:2 }] },
  { id: 'sky_net',      name: '하늘 채집망', result: 'sky_net', type: 'equipment', amount: 1,
    ingredients: [{ id:'cloud_ore', amount:4 },{ id:'wind_crystal', amount:3 },{ id:'rope', amount:5 }] },
  { id: 'void_extractor',name: '공허 추출기', result: 'void_extractor', type: 'equipment', amount: 1,
    ingredients: [{ id:'void_alloy', amount:3 },{ id:'dark_crystal', amount:3 },{ id:'ancient_core', amount:2 }] },

  // === 악세서리 제작 ===
  { id: 'lucky_charm',  name: '행운의 부적', result: 'lucky_charm', type: 'equipment', amount: 1,
    ingredients: [{ id:'shell', amount:5 },{ id:'herb', amount:3 },{ id:'crystal', amount:1 }] },
  { id: 'fire_amulet',  name: '화염 부적', result: 'fire_amulet', type: 'equipment', amount: 1,
    ingredients: [{ id:'fire_essence', amount:3 },{ id:'gold_ingot', amount:1 },{ id:'obsidian', amount:3 }] },
  { id: 'frost_ring',   name: '서리 반지', result: 'frost_ring', type: 'equipment', amount: 1,
    ingredients: [{ id:'ice_crystal', amount:3 },{ id:'gold_ingot', amount:1 },{ id:'frost_fur', amount:2 }] },
  { id: 'pressure_charm', name: '수압 부적', result: 'pressure_charm', type: 'equipment', amount: 1,
    ingredients: [{ id:'deep_pearl', amount:3 },{ id:'coral', amount:5 },{ id:'gold_ingot', amount:1 }] },
  { id: 'lightning_ring', name: '번개 반지', result: 'lightning_ring', type: 'equipment', amount: 1,
    ingredients: [{ id:'lightning_essence', amount:4 },{ id:'storm_pearl', amount:2 },{ id:'gold_ingot', amount:2 }] },
  { id: 'radiation_badge', name: '방사선 배지', result: 'radiation_badge', type: 'equipment', amount: 1,
    ingredients: [{ id:'cosmic_ore', amount:4 },{ id:'star_dust', amount:5 },{ id:'mithril_ingot', amount:2 }] },
  { id: 'void_pendant', name: '공허 펜던트', result: 'void_pendant', type: 'equipment', amount: 1,
    ingredients: [{ id:'void_shard', amount:4 },{ id:'dark_crystal', amount:3 },{ id:'gold_ingot', amount:2 }] },
  { id: 'eternity_ring', name: '영원의 반지', result: 'eternity_ring', type: 'equipment', amount: 1,
    ingredients: [{ id:'eternity_shard', amount:3 },{ id:'nebula_crystal', amount:5 },{ id:'void_alloy', amount:3 },{ id:'gold_ingot', amount:5 }] },

  // === 부산물 활용 레시피 ===
  { id: 'repair_kit', name: '수리 도구', result: 'repair_kit', type: 'material', amount: 1,
    ingredients: [{ id:'iron_ingot', amount:1 },{ id:'wood', amount:2 }] },
  { id: 'residue_enhancement', name: '찌꺼기 강화석', result: 'enhancement_stone', type: 'material', amount: 1,
    ingredients: [{ id:'mineral_residue', amount:5 },{ id:'stone', amount:2 }] },
  { id: 'dust_advanced_enhancement', name: '가루 고급 강화석', result: 'advanced_enhancement', type: 'material', amount: 1,
    ingredients: [{ id:'metal_dust', amount:5 },{ id:'crystal', amount:1 }] },
  { id: 'bottled_herb_potion', name: '재활용 약초 물약', result: 'herb_potion', type: 'food', amount: 1,
    ingredients: [{ id:'empty_bottle', amount:1 },{ id:'herb', amount:2 }] },
  { id: 'scraps_stew', name: '잔반 스튜', result: 'food_scraps', type: 'food', amount: 3,
    ingredients: [{ id:'food_scraps', amount:2 },{ id:'herb', amount:1 },{ id:'salt', amount:1 }] },
];

// ---- 탈것 정의 ----
export const VEHICLES = {
  // === 해상 ===
  raft:       { name: '뗏목',       type: 'sea',   tier: 1, icon: '🛟',
    stats: { speed: 1, cargo: 10 },
    ingredients: [{ id:'wood', amount:15 },{ id:'rope', amount:5 }],
    unlocksZones: [], prerequisite: null,
    desc: '기본적인 뗏목. 해안 근처를 항해할 수 있다.' },
  boat:       { name: '범선',       type: 'sea',   tier: 2, icon: '⛵',
    stats: { speed: 3, cargo: 30 },
    ingredients: [{ id:'hardwood', amount:15 },{ id:'iron_ingot', amount:5 },{ id:'cloth', amount:8 },{ id:'rope', amount:5 }],
    unlocksZones: ['deep_sea'], prerequisite: 'raft',
    desc: '심해 탐험이 가능한 범선.' },
  galleon:    { name: '갈레온',     type: 'sea',   tier: 3, icon: '🚢',
    stats: { speed: 5, cargo: 80 },
    ingredients: [{ id:'enchanted_wood', amount:20 },{ id:'steel', amount:10 },{ id:'cloth', amount:15 },{ id:'mithril_ingot', amount:3 }],
    unlocksZones: [], prerequisite: 'boat',
    desc: '대형 전함. 해상 전투와 대규모 운송에 적합.' },

  // === 항공 ===
  glider:     { name: '글라이더',   type: 'air',   tier: 1, icon: '🪂',
    stats: { speed: 2, cargo: 5 },
    ingredients: [{ id:'wood', amount:10 },{ id:'cloth', amount:10 },{ id:'rope', amount:5 }],
    unlocksZones: [], prerequisite: null,
    desc: '간단한 활공기. 높은 곳에서 활공 가능.' },
  airship:    { name: '비행선',     type: 'air',   tier: 2, icon: '🎈',
    stats: { speed: 4, cargo: 40 },
    ingredients: [{ id:'enchanted_wood', amount:15 },{ id:'steel', amount:8 },{ id:'wind_crystal', amount:5 },{ id:'cloth', amount:12 },{ id:'crystal', amount:5 }],
    unlocksZones: ['sky_island'], prerequisite: 'glider',
    desc: '하늘섬에 도달할 수 있는 비행선.' },
  sky_fortress:{ name: '하늘 요새', type: 'air',   tier: 3, icon: '🏰',
    stats: { speed: 6, cargo: 100 },
    ingredients: [{ id:'cloud_ore', amount:20 },{ id:'mithril_ingot', amount:10 },{ id:'enchanted_crystal', amount:8 },{ id:'storm_steel', amount:5 },{ id:'wind_crystal', amount:10 }],
    unlocksZones: [], prerequisite: 'airship',
    desc: '움직이는 하늘의 요새. 공중 지배력의 상징.' },

  // === 우주 ===
  shuttle:    { name: '셔틀',       type: 'space', tier: 1, icon: '🚀',
    stats: { speed: 3, cargo: 20 },
    ingredients: [{ id:'reinforced_steel', amount:10 },{ id:'enchanted_crystal', amount:5 },{ id:'fire_essence', amount:8 },{ id:'copper_ingot', amount:10 }],
    unlocksZones: [], prerequisite: null,
    desc: '대기권 탈출이 가능한 소형 우주선.' },
  spaceship:  { name: '우주선',     type: 'space', tier: 2, icon: '🛸',
    stats: { speed: 6, cargo: 60 },
    ingredients: [{ id:'reinforced_steel', amount:15 },{ id:'storm_steel', amount:5 },{ id:'star_fragment', amount:3 },{ id:'void_shard', amount:2 },{ id:'enchanted_crystal', amount:8 }],
    unlocksZones: ['asteroid_belt'], prerequisite: 'shuttle',
    desc: '소행성대 탐사가 가능한 우주선.' },
  dreadnought:{ name: '드레드노트', type: 'space', tier: 3, icon: '🌌',
    stats: { speed: 10, cargo: 150 },
    ingredients: [{ id:'alien_alloy', amount:10 },{ id:'void_alloy', amount:8 },{ id:'nebula_crystal', amount:5 },{ id:'star_fragment', amount:5 },{ id:'cosmic_ore', amount:15 }],
    unlocksZones: ['dark_nebula'], prerequisite: 'spaceship',
    desc: '어둠 성운을 탐사할 수 있는 최강의 우주 전함.' },
};

// ---- 일꾼 타입 정의 ----
export const WORKER_TYPES = {
  miner:    { name: '광부',     icon: '⛏️', baseStats: { str: 12, dex: 6,  int: 4,  vit: 10, luck: 3 },
    bonus: 'mining', desc: '광석 채굴에 특화' },
  gatherer: { name: '채집꾼',   icon: '🌿', baseStats: { str: 6,  dex: 10, int: 6,  vit: 8,  luck: 5 },
    bonus: 'gathering', desc: '식물/자원 채집에 특화' },
  hunter:   { name: '사냥꾼',   icon: '🏹', baseStats: { str: 10, dex: 12, int: 4,  vit: 8,  luck: 4 },
    bonus: 'hunting', desc: '몬스터 사냥/드롭에 특화' },
  fisher:   { name: '어부',     icon: '🎣', baseStats: { str: 8,  dex: 8,  int: 4,  vit: 10, luck: 6 },
    bonus: 'fishing', desc: '어류/해양 채집에 특화' },
  scholar:  { name: '학자',     icon: '📚', baseStats: { str: 4,  dex: 4,  int: 14, vit: 6,  luck: 8 },
    bonus: 'research', desc: '마법/정수 채집에 특화, 높은 행운' },
};

// ---- 일꾼 이름 풀 ----
export const WORKER_NAMES = {
  miner:    ['광부 김씨','광부 이씨','광부 박씨','광부 최씨','난쟁이 광부','드워프 광부','강철 주먹','바위 파쇄자','깊은땅 탐험가','광맥 발견자'],
  gatherer: ['채집꾼 안씨','채집꾼 유씨','풀잎 수집가','약초 전문가','숲의 채집가','자연의 손','바람 채집꾼','이슬 모으미','엘프 채집가','꽃향기 수집가'],
  hunter:   ['사냥꾼 정씨','사냥꾼 한씨','매의 눈','늑대 추적자','그림자 사냥꾼','야수 사냥꾼','독수리 사수','밤의 사냥꾼','전장의 사냥꾼','몬스터 전문가'],
  fisher:   ['어부 송씨','어부 강씨','바다 노인','심해 어부','낚시왕','파도타기꾼','그물 장인','바다의 손','조개잡이 달인','해녀 김씨'],
  scholar:  ['학자 오씨','학자 서씨','마법 연구가','고대어 해독가','수정 전문가','정수 추출가','룬 학자','마력 감지사','별빛 학자','차원 연구가'],
};

// ---- 고용 비용 ----
export const HIRE_COSTS = {
  miner: 100, gatherer: 80, hunter: 150, fisher: 90, scholar: 200,
};

// ---- 시장 기본가 ----
// ---- 제작 부산물 규칙 ----
export const BYPRODUCT_RULES = [
  { recipeIds: ['iron_ingot','copper_ingot','steel','gold_ingot','mithril_ingot','reinforced_steel','void_alloy'],
    byproduct: 'mineral_residue', chance: 0.10, amount: 1 },
  { recipeType: 'equipment',
    byproduct: 'metal_dust', chance: 0.10, amount: 1 },
  { recipeIds: ['herb_potion','fire_potion','ice_potion','bottled_herb_potion'],
    byproduct: 'empty_bottle', chance: 0.15, amount: 1 },
  { recipeIds: ['cooked_meat','herb_stew','nutrient_soup','energy_steak','scraps_stew'],
    byproduct: 'food_scraps', chance: 0.15, amount: 1 },
];

// ---- 일꾼 음식 테이블 ----
export const WORKER_FOOD_TABLE = [
  { id: 'food_scraps',  hunger: 30, name: '남은 재료' },
  { id: 'cooked_meat',  hunger: 50, name: '구운 고기' },
  { id: 'raw_meat',     hunger: 25, name: '생고기' },
  { id: 'fish',         hunger: 30, name: '물고기' },
  { id: 'mushroom',     hunger: 20, name: '버섯' },
  { id: 'herb',         hunger: 10, name: '약초' },
];

// ---- 상인 의뢰 풀 ----
export const MERCHANT_QUEST_POOL = [
  { tier: 1, items: [
    { id: 'wood', minQty: 20, maxQty: 50 }, { id: 'stone', minQty: 20, maxQty: 50 },
    { id: 'fiber', minQty: 15, maxQty: 40 }, { id: 'raw_meat', minQty: 10, maxQty: 30 },
    { id: 'rope', minQty: 5, maxQty: 15 }, { id: 'cooked_meat', minQty: 5, maxQty: 15 },
  ]},
  { tier: 2, items: [
    { id: 'iron_ore', minQty: 15, maxQty: 40 }, { id: 'coal', minQty: 20, maxQty: 50 },
    { id: 'iron_ingot', minQty: 5, maxQty: 20 }, { id: 'leather', minQty: 5, maxQty: 15 },
    { id: 'enhancement_stone', minQty: 3, maxQty: 10 },
  ]},
  { tier: 3, items: [
    { id: 'steel', minQty: 5, maxQty: 15 }, { id: 'mithril_ore', minQty: 5, maxQty: 15 },
    { id: 'gold_ingot', minQty: 3, maxQty: 10 }, { id: 'fire_essence', minQty: 5, maxQty: 15 },
  ]},
  { tier: 4, items: [
    { id: 'mithril_ingot', minQty: 3, maxQty: 8 }, { id: 'reinforced_steel', minQty: 2, maxQty: 5 },
  ]},
];

export const MERCHANT_NAMES = [
  '떠돌이 상인', '동방의 무역상', '대륙 상단 대표', '해적 밀매상',
  '광산 거래인', '마법 물품상', '군수물자 조달관', '지하시장 상인',
  '왕립 조달관', '별의 무역상',
];

// ---- 시장 기준 가격 ----
export const MARKET_BASE_PRICES = {
  wood: 2, stone: 2, herb: 3, fiber: 1, raw_meat: 4,
  hardwood: 5, mushroom: 4, beast_hide: 6, enchanted_sap: 15,
  iron_ore: 8, coal: 3, copper_ore: 5, crystal: 20,
  sand_crystal: 12, cactus: 4, sun_stone: 30, scorpion_shell: 10,
  fish: 3, shell: 2, coral: 12, salt: 2,
  mithril_ore: 35, frost_fur: 25, mountain_herb: 20, gold_ore: 40,
  ice_crystal: 28, ice_essence: 35, frozen_core: 80, permafrost: 15,
  obsidian: 22, fire_essence: 32, magma_core: 90, drake_scale: 50,
  deep_pearl: 30, sea_essence: 32, kraken_ink: 100, deep_coral: 18,
  cloud_ore: 50, wind_crystal: 45, phoenix_feather: 200, sky_bloom: 35,
  lightning_essence: 55, storm_steel: 120, storm_pearl: 70,
  relic_fragment: 25, ancient_core: 85, enchanted_dust: 20,
  dark_crystal: 90, demon_essence: 100, void_shard: 150,
  star_dust: 80, star_fragment: 160, cosmic_ore: 95, alien_alloy: 250,
  void_essence: 180, nebula_crystal: 220, eternity_shard: 500,
  rope: 5, cloth: 6, leather: 10, iron_ingot: 18, copper_ingot: 12,
  steel: 35, gold_ingot: 90, enchanted_wood: 30, enchanted_crystal: 50,
  mithril_ingot: 80, reinforced_steel: 120, void_alloy: 250,
  cooked_meat: 8, herb_potion: 15, fire_potion: 40, ice_potion: 40,
  mineral_residue: 1, metal_dust: 2, empty_bottle: 1, food_scraps: 1, repair_kit: 15,
};

// ---- 레벨 경험치 테이블 ----
export const EXP_TABLE = [
  0, 50, 120, 220, 360, 550, 800, 1120, 1520, 2020,         // 1-10
  2650, 3420, 4350, 5470, 6800, 8370, 10220, 12400, 14960, 17960, // 11-20
  21460, 25530, 30250, 35700, 41970, 49160, 57380, 66750, 77400, 89480, // 21-30
];

// ---- 계승 가능 아이템 카테고리 ----
export const INHERITABLE_CATEGORIES = ['rare', 'cosmic', 'gem'];

// ---- 환경 표시 이름 ----
export const ENV_NAMES = {
  fire: '🔥 고열', cold: '❄️ 극한', lightning: '⚡ 뇌전',
  void: '🌑 공허', pressure: '🫧 고압', radiation: '☢️ 방사선', dark: '🌑 암흑',
};
