/**
 * mappers.ts
 * ──────────
 * Convierte filas de Supabase (snake_case) al modelo de dominio (camelCase).
 * Funciones puras — sin efectos secundarios.
 */

import {
  Team, Subject, HealthIncident, LoadRecord, TestDefinition,
  PhysicalTestResult, MatchStat, QualitativeReport, WellnessReport,
  Match, AttendanceRecord, Session, Role,
} from '../types';

// ── TrainingSchedule (tipo local, no está en types.ts) ───────────────────────

export type TrainingSchedule = {
  id: string;
  teamId: string;
  dayOfWeek: number; // 0=Dom … 6=Sáb
  startTime: string; // 'HH:MM'
  endTime: string;
  sessionType: string;
  title: string;
  active: boolean;
};

// ── Mappers ───────────────────────────────────────────────────────────────────

export const mapTeam = (t: any): Team => ({
  id: t.id, name: t.name, category: t.category,
  sport: t.sport, playersCount: t.players_count || 0,
});

export const mapSubject = (s: any): Subject => ({
  id: s.id, teamId: s.team_id, name: s.name, lastName: s.last_name,
  birthDate: s.birth_date, contact: s.contact, role: s.role as Role,
  number: s.number, position: s.position, photoUrl: s.photo_url, dnaId: s.dna_id,
});

export const mapIncident = (i: any): HealthIncident => ({
  id: i.id, teamId: i.team_id, subjectId: i.subject_id, date: i.date,
  type: i.type, status: i.status as any, severity: i.severity as any,
  notes: i.notes, recoveryDate: i.recovery_date,
});

export const mapLoadRecord = (l: any): LoadRecord => ({
  id: l.id, sessionId: l.session_id, subjectId: l.subject_id,
  borgScale: l.borg_scale, durationMins: l.duration_mins, sessionLoad: l.session_load,
});

export const mapTestDefinition = (d: any): TestDefinition => ({
  id: d.id, teamId: d.team_id, name: d.name, unit: d.unit,
});

export const mapPhysicalTestResult = (r: any): PhysicalTestResult => ({
  id: r.id, teamId: r.team_id, subjectId: r.subject_id,
  testId: r.test_id, date: r.date, value: r.value,
  notes: r.notes || '',
} as any);

export const mapMatchStat = (m: any): MatchStat => ({
  id: m.id, matchId: m.match_id, subjectId: m.subject_id, stats: m.stats || {},
});

export const mapEvaluation = (e: any): QualitativeReport => ({
  id: e.id, teamId: e.team_id, subjectId: e.subject_id, date: e.date,
  coachId: e.coach_id, season: e.season, comments: e.comments, overall: e.overall,
  evaluations: {
    tactical: e.tactical, technical: e.technical,
    physical: e.physical, behavioral: e.behavioral,
  },
});

export const mapWellness = (w: any): WellnessReport => ({
  id: w.id, teamId: w.team_id, subjectId: w.subject_id, date: w.date,
  fatigue: w.fatigue, sleepQuality: w.sleep_quality,
  muscleSoreness: w.muscle_soreness, stressLevel: w.stress_level,
  mood: w.mood, notes: w.notes,
});

export const mapMatch = (m: any): Match => ({
  id: m.id, teamId: m.team_id, opponent: m.opponent, date: m.date,
  location: m.location, isHome: m.is_home, resultUs: m.result_us,
  resultThem: m.result_them, status: m.status,
  stats_headers: m.stats_headers || [], match_report: m.match_report,
});

export const mapAttendance = (a: any): AttendanceRecord => ({
  id: a.id, teamId: a.team_id, sessionId: a.session_id,
  subjectId: a.subject_id, status: a.status as any,
});

export const mapSession = (s: any): Session => ({
  id: s.id, teamId: s.team_id, date: s.date, type: s.type,
  title: s.title, notes: s.notes, durationMins: s.duration_mins,
});

export const mapTrainingSchedule = (s: any): TrainingSchedule => ({
  id: s.id, teamId: s.team_id, dayOfWeek: s.day_of_week,
  startTime: s.start_time, endTime: s.end_time,
  sessionType: s.session_type || 'TRAINING', title: s.title || '', active: s.active !== false,
});
