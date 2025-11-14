import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Risk level normalization utilities
// Maps both Spanish and English risk levels to internal constants
const RISK_LEVEL_MAP = {
  // Intolerable
  'Intolerable': 'INTOLERABLE',
  'intolerable': 'INTOLERABLE',
  // High
  'Alto': 'HIGH',
  'High': 'HIGH',
  'alto': 'HIGH',
  'high': 'HIGH',
  // Medium
  'Medio': 'MEDIUM',
  'Medium': 'MEDIUM',
  'medio': 'MEDIUM',
  'medium': 'MEDIUM',
  // Low
  'Bajo': 'LOW',
  'Low': 'LOW',
  'bajo': 'LOW',
  'low': 'LOW',
  // Tolerable
  'Tolerable': 'TOLERABLE',
  'tolerable': 'TOLERABLE',
  // Unclassified
  'Sin clasificar': 'UNCLASSIFIED',
  'Unclassified': 'UNCLASSIFIED',
  'sin clasificar': 'UNCLASSIFIED',
  'unclassified': 'UNCLASSIFIED',
};

/**
 * Normalizes a risk level (in any language) to an internal constant
 * @param {string} level - The risk level in Spanish or English
 * @returns {string} The normalized internal constant (e.g., 'HIGH', 'MEDIUM')
 */
export function normalizeRiskLevel(level) {
  if (!level) return 'UNCLASSIFIED';
  return RISK_LEVEL_MAP[level] || 'UNCLASSIFIED';
}

/**
 * Checks if a risk level is high or intolerable
 * @param {string} level - The risk level in any language
 * @returns {boolean} True if the level is high or intolerable
 */
export function isHighRisk(level) {
  const normalized = normalizeRiskLevel(level);
  return normalized === 'HIGH' || normalized === 'INTOLERABLE';
}

/**
 * Checks if a risk level is low or tolerable
 * @param {string} level - The risk level in any language
 * @returns {boolean} True if the level is low or tolerable
 */
export function isLowRisk(level) {
  const normalized = normalizeRiskLevel(level);
  return normalized === 'LOW' || normalized === 'TOLERABLE';
}

/**
 * Gets the appropriate color classes for a risk level regardless of language
 * @param {string} level - The risk level in any language
 * @returns {object} Object with color classes for each normalized level
 */
export function getRiskLevelColorClasses() {
  return {
    'INTOLERABLE': 'bg-red-300 text-red-900 border border-red-500 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/30',
    'HIGH': 'bg-orange-300 text-orange-900 border border-orange-500 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/30',
    'MEDIUM': 'bg-amber-300 text-amber-900 border border-amber-500 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30',
    'LOW': 'bg-blue-300 text-blue-900 border border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30',
    'TOLERABLE': 'bg-green-300 text-green-900 border border-green-500 dark:bg-green-500/20 dark:text-green-300 dark:border-green-400/30',
    'UNCLASSIFIED': 'glass'
  };
} 