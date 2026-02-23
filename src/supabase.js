import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dhwllgdxpeucldtmzhme.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRod2xsZ2R4cGV1Y2xkdG16aG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzI2NTMsImV4cCI6MjA4NTgwODY1M30.PmDxpoWXP0zA2sJLgRxAfODH1JcjdFOoRMdnGZwJYLE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STUDENT = 'max';

// Save the full summary (results + mastery + confidence) to Supabase
export async function saveSummary(results, mastery, confidence = {}, bossResults = null) {
  try {
    const { error } = await supabase
      .from('math_diagnostic_summary')
      .upsert({
        student_name: STUDENT,
        results,
        mastery,
        confidence,
        boss_results: bossResults,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_name' });

    if (error) console.error('Failed to save summary:', error);
  } catch (e) {
    console.error('Supabase save error:', e);
  }
}

// Load summary from Supabase
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

// Save individual session results (for detailed history)
export async function saveSessionResult(sessionType, topic, correct, total, confidence = []) {
  try {
    const { error } = await supabase
      .from('math_diagnostic_results')
      .insert({
        student_name: STUDENT,
        session_type: sessionType,
        topic,
        correct,
        total,
        confidence,
      });

    if (error) console.error('Failed to save session result:', error);
  } catch (e) {
    console.error('Supabase session save error:', e);
  }
}
