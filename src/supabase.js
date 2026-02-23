import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dhwllgdxpeucldtmzhme.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRod2xsZ2R4cGV1Y2xkdG16aG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzI2NTMsImV4cCI6MjA4NTgwODY1M30.PmDxpoWXP0zA2sJLgRxAfODH1JcjdFOoRMdnGZwJYLE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STUDENT = 'max';
const WRITE_QUEUE_KEY = 'math-prep-write-queue';

// ===== WRITE QUEUE (offline safety) =====

function getWriteQueue() {
  try {
    return JSON.parse(localStorage.getItem(WRITE_QUEUE_KEY) || '[]');
  } catch { return []; }
}

function addToWriteQueue(operation) {
  const queue = getWriteQueue();
  queue.push({ ...operation, timestamp: Date.now() });
  localStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(queue));
}

function clearWriteQueue() {
  localStorage.setItem(WRITE_QUEUE_KEY, '[]');
}

let _flushing = false;

export async function flushWriteQueue() {
  if (_flushing) return; // prevent concurrent flushes
  _flushing = true;

  try {
    const queue = getWriteQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const op of queue) {
      try {
        let error = null;
        if (op.type === 'upsert-profile') {
          ({ error } = await supabase.from('math_student_profile').upsert(op.data, { onConflict: 'student_name' }));
        } else if (op.type === 'insert-session') {
          ({ error } = await supabase.from('math_practice_sessions').upsert(op.data, { onConflict: 'id' }));
        } else if (op.type === 'update-session') {
          ({ error } = await supabase.from('math_practice_sessions').update(op.data).eq('id', op.id));
        } else if (op.type === 'insert-problem') {
          ({ error } = await supabase.from('math_problem_results').upsert(op.data, { onConflict: 'id' }));
        } else if (op.type === 'upsert-summary') {
          ({ error } = await supabase.from('math_diagnostic_summary').upsert(op.data, { onConflict: 'student_name' }));
        } else if (op.type === 'insert-diagnostic') {
          ({ error } = await supabase.from('math_diagnostic_results').insert(op.data));
        }
        // 409 = already exists, treat as success
        if (error && error.code !== '23505') {
          remaining.push(op);
        }
      } catch {
        remaining.push(op);
      }
    }

    // Re-read queue to preserve items added during flush
    const current = getWriteQueue();
    const newItems = current.slice(queue.length);
    localStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify([...remaining, ...newItems]));
  } finally {
    _flushing = false;
  }
}

// Try to flush queue on load and periodically
setTimeout(flushWriteQueue, 2000);
setInterval(flushWriteQueue, 30000);
window.addEventListener('online', () => setTimeout(flushWriteQueue, 1000));

// ===== SAFE WRITE (localStorage first, then Supabase) =====

async function safeWrite(operation) {
  // Always queue first for safety
  addToWriteQueue(operation);
  // Then try to flush immediately
  try {
    await flushWriteQueue();
  } catch {
    // Queue will retry later
  }
}

// ===== STUDENT PROFILE =====

export async function loadProfile() {
  try {
    const { data, error } = await supabase
      .from('math_student_profile')
      .select('*')
      .eq('student_name', STUDENT)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to load profile:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Profile load error:', e);
    return null;
  }
}

export async function saveProfile(profile) {
  const data = {
    student_name: STUDENT,
    total_xp: profile.total_xp || 0,
    level: profile.level || 1,
    streak: profile.streak || 0,
    best_streak: profile.best_streak || 0,
    mastery: profile.mastery || {},
    topic_history: profile.topic_history || {},
    badges: profile.badges || [],
    sessions_completed: profile.sessions_completed || 0,
    problems_solved: profile.problems_solved || 0,
    updated_at: new Date().toISOString(),
  };
  await safeWrite({ type: 'upsert-profile', data });
}

// ===== PRACTICE SESSIONS =====

export async function createSession(sessionType = 'practice', existingId = null) {
  const id = existingId || crypto.randomUUID();
  const data = {
    id,
    student_name: STUDENT,
    session_type: sessionType,
    started_at: new Date().toISOString(),
    problems_attempted: 0,
    problems_correct: 0,
    xp_earned: 0,
    streak_high: 0,
    mastery_snapshot: {},
    topics_covered: [],
  };
  await safeWrite({ type: 'insert-session', data });
  return id;
}

export async function updateSession(sessionId, updates) {
  await safeWrite({
    type: 'update-session',
    id: sessionId,
    data: {
      ...updates,
      ended_at: updates.ended_at || undefined,
    },
  });
}

// ===== PROBLEM RESULTS =====

export async function saveProblemResult(result) {
  const data = {
    id: crypto.randomUUID(),
    session_id: result.session_id,
    student_name: STUDENT,
    topic: result.topic,
    difficulty: result.difficulty || 1,
    correct: result.correct,
    first_try: result.first_try !== false,
    time_spent_ms: result.time_spent_ms || null,
    xp_awarded: result.xp_awarded || 0,
  };
  await safeWrite({ type: 'insert-problem', data });
}

// ===== ACTIVE SESSION RESUME =====

export async function loadActiveSession() {
  try {
    const { data, error } = await supabase
      .from('math_practice_sessions')
      .select('*')
      .eq('student_name', STUDENT)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to load active session:', error);
      return null;
    }
    // Only resume sessions less than 1 hour old
    if (data && Date.now() - new Date(data.started_at).getTime() < 60 * 60 * 1000) {
      return data;
    }
    return null;
  } catch (e) {
    console.error('Active session load error:', e);
    return null;
  }
}

export async function saveSessionState(sessionId, state) {
  await safeWrite({
    type: 'update-session',
    id: sessionId,
    data: {
      problems_attempted: state.problemIndex,
      problems_correct: state.correctCount,
      xp_earned: state.sessionXP,
      streak_high: state.bestStreak,
      mastery_snapshot: state.sessionMastery,
      topics_covered: state.topicsCovered,
      session_state: state,
    },
  });
}

// ===== LEGACY: Diagnostic Summary (keep backward compatibility) =====

export async function saveSummary(results, mastery, confidence = {}, bossResults = null) {
  const data = {
    student_name: STUDENT,
    results,
    mastery,
    confidence,
    boss_results: bossResults,
    updated_at: new Date().toISOString(),
  };
  await safeWrite({ type: 'upsert-summary', data });
}

export async function loadSummary() {
  try {
    const { data, error } = await supabase
      .from('math_diagnostic_summary')
      .select('*')
      .eq('student_name', STUDENT)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to load summary:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Supabase load error:', e);
    return null;
  }
}

export async function saveSessionResult(sessionType, topic, correct, total, confidence = []) {
  const data = {
    student_name: STUDENT,
    session_type: sessionType,
    topic,
    correct,
    total,
    confidence,
  };
  await safeWrite({ type: 'insert-diagnostic', data });
}
