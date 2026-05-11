import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { DailyLog, VoiceLog } from '@/lib/storage'
import type { ActivityLog, ExerciseSet } from '@/lib/fitness'
import type { Project, Task } from '@/lib/projects'

// Phase 1 — backup-only writes. Tables must exist in Supabase before this runs.
// Set PICARD_USER_ID in .env.local and Vercel env to a real Supabase Auth user UUID.
// Until then, writes will fail FK constraints against the profiles table gracefully.
const USER_ID = process.env.PICARD_USER_ID || '00000000-0000-0000-0000-000000000001'

function mapDailyLog(log: DailyLog) {
  return {
    user_id: USER_ID,
    date: log.date,
    calories: log.calories,
    calorie_target: log.calorieTarget,
    protein: log.protein,
    protein_target: log.proteinTarget,
    weight: log.weight,
    water: log.water,
    sleep_hours: log.sleepHours,
    sleep_quality: log.sleepQuality,
    steps: log.steps,
    screen_time: log.screenTime,
    instagram_time: log.instagramTime,
    smoked_today: log.smokedToday,
    drank_today: log.drankToday,
    confidence_score: log.confidenceScore,
    mood: log.mood,
    notes: log.notes ?? '',
    recovery_score: log.recoveryScore,
    hrv: log.hrv,
    resting_hr: log.restingHR,
    strain: log.strain,
    saved_at: log.savedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function mapActivityLog(entry: ActivityLog) {
  return {
    id: entry.id,
    user_id: USER_ID,
    date: entry.date,
    type: entry.type,
    label: entry.label ?? null,
    duration: entry.duration ?? null,
    distance: entry.distance ?? null,
    distance_unit: entry.distanceUnit ?? 'miles',
    steps: entry.steps ?? null,
    calories: entry.calories ?? null,
    rpe: entry.rpe ?? null,
    notes: entry.notes ?? null,
    source: entry.source,
    external_id: entry.externalId ?? null,
    heart_rate_avg: entry.heartRateAvg ?? null,
    heart_rate_max: entry.heartRateMax ?? null,
    created_at: entry.createdAt,
  }
}

function mapExercise(ex: ExerciseSet, activityId: string, sortOrder: number) {
  return {
    activity_id: activityId,
    exercise: ex.exercise,
    sets: ex.sets ?? null,
    reps: typeof ex.reps === 'number' ? ex.reps : null,
    weight: ex.weight ?? null,
    weight_unit: ex.weightUnit ?? 'lb',
    rpe: ex.rpe ?? null,
    notes: ex.notes ?? null,
    sort_order: sortOrder,
  }
}

function mapVoiceLog(log: VoiceLog) {
  return {
    id: log.id,
    user_id: USER_ID,
    timestamp: log.timestamp,
    transcript: log.transcript,
    duration: log.duration,
    created_at: log.timestamp,
  }
}

function mapProject(p: Project) {
  return {
    id: p.id,
    user_id: USER_ID,
    title: p.title,
    description: p.description,
    status: p.status,
    priority: p.priority,
    progress: p.progress,
    target_date: p.targetDate ?? null,
    notes: p.notes,
    urgency: p.urgency,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

function mapTask(task: Task, projectId: string, sortOrder: number) {
  return {
    id: task.id,
    project_id: projectId,
    text: task.text,
    done: task.done,
    sort_order: sortOrder,
    created_at: task.createdAt,
  }
}

export async function POST(request: Request) {
  let type: string
  let payload: unknown
  try {
    const body = await request.json()
    type = body.type
    payload = body.payload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (type) {
      case 'daily_log': {
        const { error } = await admin
          .from('daily_logs')
          .upsert(mapDailyLog(payload as DailyLog), { onConflict: 'user_id,date' })
        if (error) console.warn('[sync] daily_log:', error.message)
        break
      }

      case 'activity_log': {
        const entry = payload as ActivityLog
        const { error: actErr } = await admin
          .from('activity_logs')
          .upsert(mapActivityLog(entry), { onConflict: 'id' })
        if (actErr) {
          console.warn('[sync] activity_log:', actErr.message)
          break
        }
        if (entry.exercises?.length) {
          await admin.from('activity_exercises').delete().eq('activity_id', entry.id)
          const { error: exErr } = await admin
            .from('activity_exercises')
            .insert(entry.exercises.map((ex, i) => mapExercise(ex, entry.id, i)))
          if (exErr) console.warn('[sync] activity_exercises:', exErr.message)
        }
        break
      }

      case 'voice_log': {
        const { error } = await admin
          .from('voice_logs')
          .upsert(mapVoiceLog(payload as VoiceLog), { onConflict: 'id' })
        if (error) console.warn('[sync] voice_log:', error.message)
        break
      }

      case 'projects': {
        for (const p of payload as Project[]) {
          const { error: pErr } = await admin
            .from('projects')
            .upsert(mapProject(p), { onConflict: 'id' })
          if (pErr) {
            console.warn('[sync] project:', pErr.message)
            continue
          }
          await admin.from('project_tasks').delete().eq('project_id', p.id)
          if (p.tasks.length) {
            const { error: tErr } = await admin
              .from('project_tasks')
              .insert(p.tasks.map((t, i) => mapTask(t, p.id, i)))
            if (tErr) console.warn('[sync] project_tasks:', tErr.message)
          }
        }
        break
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown sync type: ${type}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, type })
  } catch (err) {
    console.warn('[sync] unexpected error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
