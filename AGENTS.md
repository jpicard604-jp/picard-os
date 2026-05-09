export type RecoveryState = 'OPTIMAL' | 'ADAPTED' | 'STRAINED' | 'RECOVERING'
export type UrgencyLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type WorkoutType = 'upper' | 'lower' | 'cardio' | 'full'
export type Trend = 'up' | 'down' | 'flat'
export type CompoundCategory = 'Performance' | 'Recovery' | 'Health' | 'Stimulant' | 'Peptide'
export type CompoundTiming = 'AM' | 'PM' | 'Pre-workout' | 'With meals' | 'As needed'
export type FileType = 'pdf' | 'image' | 'audio' | 'csv' | 'text'

export interface Exercise {
  name: string
  sets: string
  weight: string
  pr: boolean
  trend: Trend
}

export interface Workout {
  date: string
  name: string
  type: WorkoutType
  completed: boolean
  duration: number
  exercises: Exercise[]
}

export interface StackItem {
  id: string
  name: string
  category: CompoundCategory
  dose: string
  timing: CompoundTiming
  takenToday: boolean
  notes?: string
}

export interface UploadedFile {
  id: string
  name: string
  type: FileType
  size: string
  uploadedAt: string
  category: string
  previewDataUrl?: string
}

export const JACKSON = {
  name: 'Jackson',
  handle: 'Jpicky',
  bodyWeight: 180,

  today: {
    date: 'May 8, 2026',
    recovery: {
      score: 74,
      hrv: 52,
      restingHR: 52,
      sleepHours: 7.2,
      sleepScore: 78,
      strain: 9.4,
      state: 'ADAPTED' as RecoveryState,
    },
    nutrition: {
      calories: { consumed: 1840, target: 2500 },
      protein: { consumed: 142, target: 180 },
      carbs: { consumed: 185, target: 250 },
      fat: { consumed: 58, target: 80 },
    },
    fitness: {
      workoutDone: false,
      plannedWorkout: 'Upper — Chest & Back',
      weeklyTarget: 5,
      weeklyDone: 3,
    },
    screenTime: {
      total: 3.2,
      instagram: 1.1,
      target: 2.0,
    },
    streaks: {
      noDrinking: 23,
      smokingToday: false,
      workoutDaysThisWeek: 3,
    },
    confidence: 72,
    mood: 4,
  },

  weeklyWorkouts: [
    { day: 'M', done: true },
    { day: 'T', done: true },
    { day: 'W', done: true },
    { day: 'T', done: false },
    { day: 'F', done: false },
    { day: 'S', done: false },
    { day: 'S', done: false },
  ],

  recentWorkouts: [
    {
      date: 'May 7',
      name: 'Upper — Chest & Back',
      type: 'upper' as WorkoutType,
      completed: true,
      duration: 62,
      exercises: [
        { name: 'Flat Bench Press', sets: '4×5', weight: '225 lb', pr: false, trend: 'up' as Trend },
        { name: 'Incline DB Press', sets: '3×10', weight: '80 lb', pr: false, trend: 'flat' as Trend },
        { name: 'Weighted Pull-Up', sets: '4×6', weight: '+45 lb', pr: true, trend: 'up' as Trend },
        { name: 'Cable Row', sets: '3×12', weight: '160 lb', pr: false, trend: 'up' as Trend },
      ],
    },
    {
      date: 'May 6',
      name: 'Lower — Squat Focus',
      type: 'lower' as WorkoutType,
      completed: true,
      duration: 55,
      exercises: [
        { name: 'Back Squat', sets: '4×5', weight: '275 lb', pr: false, trend: 'flat' as Trend },
        { name: 'Romanian Deadlift', sets: '3×10', weight: '185 lb', pr: false, trend: 'up' as Trend },
        { name: 'Leg Press', sets: '3×12', weight: '360 lb', pr: false, trend: 'up' as Trend },
      ],
    },
  ] as Workout[],

  progressionHistory: {
    benchPress: [205, 210, 215, 215, 220, 220, 225],
    weightedPullUp: [35, 35, 40, 40, 42, 45, 45],
    bodyWeight: [183, 182, 181, 180, 181, 180, 180],
  },

  stack: [
    { id: '1', name: 'Creatine Monohydrate', category: 'Performance' as CompoundCategory, dose: '5g', timing: 'AM' as CompoundTiming, takenToday: true },
    { id: '2', name: 'Caffeine', category: 'Stimulant' as CompoundCategory, dose: '200mg', timing: 'AM' as CompoundTiming, takenToday: true },
    { id: '3', name: 'Vitamin D3 + K2', category: 'Health' as CompoundCategory, dose: '5,000 IU', timing: 'AM' as CompoundTiming, takenToday: true },
    { id: '4', name: 'Omega-3 Fish Oil', category: 'Health' as CompoundCategory, dose: '2g EPA/DHA', timing: 'With meals' as CompoundTiming, takenToday: true, notes: '2 softgels with breakfast' },
    { id: '5', name: 'Magnesium Glycinate', category: 'Recovery' as CompoundCategory, dose: '400mg', timing: 'PM' as CompoundTiming, takenToday: false },
    { id: '6', name: 'Electrolytes', category: 'Performance' as CompoundCategory, dose: '1 scoop', timing: 'Pre-workout' as CompoundTiming, takenToday: false },
    { id: '7', name: 'Zinc', category: 'Health' as CompoundCategory, dose: '30mg', timing: 'PM' as CompoundTiming, takenToday: false, notes: 'Take on empty stomach' },
  ] as StackItem[],

  uploads: [
    { id: '1', name: 'Bloodwork_Q1_2026.pdf', type: 'pdf' as FileType, size: '1.2 MB', uploadedAt: 'May 1', category: 'Health' },
    { id: '2', name: 'DEXA_Scan_April2026.pdf', type: 'pdf' as FileType, size: '3.8 MB', uploadedAt: 'Apr 20', category: 'Health' },
    { id: '3', name: 'Grocery_List_May.csv', type: 'csv' as FileType, size: '8 KB', uploadedAt: 'May 3', category: 'Nutrition' },
    { id: '4', name: 'Training_Block_Q2.pdf', type: 'pdf' as FileType, size: '524 KB', uploadedAt: 'Apr 28', category: 'Fitness' },
  ] as UploadedFile[],

  xodus: {
    urgency: 'HIGH' as UrgencyLevel,
    executionScore: 61,
    recoveryState: 'ADAPTED' as RecoveryState,
    focusRecommendation: 'Upper session → close protein gap → cap Instagram at 20 min',
    paragraphs: [
      'Recovery is at 74 — HRV held at 52ms. Your system absorbed yesterday\'s pull-up PR and is ready to train again.',
      'You have not trained yet today. Upper chest and back is on deck. That session does not move itself.',
      'Protein is 38g behind at this hour. One focused meal closes that gap. Calories are on track at 1,840.',
      'Screen time is already at 3.2 hours — 1.2 over your daily target before 2 PM. Instagram alone: 1.1 hours.',
      '23 days no alcohol. That\'s compounding quietly. Don\'t break it with noise.',
      'Stop scrolling. Train. Eat. Build.',
    ],
  },
}
