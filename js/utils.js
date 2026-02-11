// ============================================================
// utils.js - 공통 유틸리티 함수
// ============================================================

/**
 * 랜덤 정수 생성 (min ~ max 포함)
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {number} 랜덤 정수
 */
export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 값을 범위 내로 제한
 * @param {number} v - 값
 * @param {number} lo - 최소값
 * @param {number} hi - 최대값
 * @returns {number} 제한된 값
 */
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 고유 ID 생성
 * @returns {string} 타임스탬프 기반 고유 ID
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * 숫자를 K/M 형식으로 포맷팅
 * @param {number} num - 숫자
 * @returns {string} 포맷된 문자열
 */
export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * 퍼센트 계산
 * @param {number} value - 현재 값
 * @param {number} max - 최대값
 * @returns {number} 퍼센트 (0-100)
 */
export function getPercent(value, max) {
  if (max === 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/**
 * 시간 포맷팅 (초 → MM:SS)
 * @param {number} seconds - 초
 * @returns {string} 포맷된 시간
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 배열에서 랜덤 요소 선택
 * @param {Array} arr - 배열
 * @returns {*} 랜덤 요소
 */
export function randomChoice(arr) {
  return arr[rand(0, arr.length - 1)];
}

/**
 * 확률 체크 (0-100)
 * @param {number} chance - 확률 (0-100)
 * @returns {boolean} 성공 여부
 */
export function rollChance(chance) {
  return Math.random() * 100 < chance;
}
