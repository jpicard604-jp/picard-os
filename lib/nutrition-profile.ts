// User nutrition profile — stored independently of daily logs.
// Seeded once with confirmed current values; updated via XODUS parser or Settings.
// Macro math: 210p×4 + 210c×4 + 58f×9 = 840 + 840 + 522 = 2,202 kcal.
// Practical fat range 58–61g accounts for food rounding; total lands ~2,200–2,220.

export type NutritionPhase = 'cutting' | 'maintenance' | 'bulking' | 'unknown'
export type NutritionSource = 'user_confirmed' | 'whoop' | 'estimated' | 'missing'

export interface NutritionProfile {
  phase: NutritionPhase
  currentWeightLb?: number
  calorieTarget?: number
  proteinTarget?: number
  carbTarget?: number
  fatTarget?: number
  historicalCalorieRange?: [number, number]
  historicalProteinRange?: [number, number]
  source?: NutritionSource
  updatedAt?: string
}

// Current confirmed profile — the source of truth until the user changes it.
export const CONFIRMED_NUTRITION_PROFILE: NutritionProfile = {
  phase: 'cutting',
  calorieTarget: 2200,
  proteinTarget: 210,
  carbTarget: 210,
  fatTarget: 58,
  historicalCalorieRange: [2100, 2250],
  historicalProteinRange: [190, 240],
  source: 'user_confirmed',
  updatedAt: '2026-05-10',
}

const KEY = 'picard_nutrition_profile_v1'

export function getNutritionProfile(): NutritionProfile {
  if (typeof window === 'undefined') return CONFIRMED_NUTRITION_PROFILE
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(CONFIRMED_NUTRITION_PROFILE))
      return CONFIRMED_NUTRITION_PROFILE
    }
    return { ...CONFIRMED_NUTRITION_PROFILE, ...JSON.parse(raw) } as NutritionProfile
  } catch {
    return CONFIRMED_NUTRITION_PROFILE
  }
}

export function saveNutritionProfile(updates: Partial<NutritionProfile>): void {
  if (typeof window === 'undefined') return
  try {
    const current = getNutritionProfile()
    localStorage.setItem(KEY, JSON.stringify({
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    }))
    window.dispatchEvent(new CustomEvent('picard:nutrition-profile-updated'))
  } catch {}
}
