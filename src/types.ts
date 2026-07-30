/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Team {
  id: string;
  name: string;
  category: string;
  sport: string;
  logoUrl?: string;
  playersCount: number;
}

export enum Role {
  PLAYER = 'PLAYER',
  STAFF = 'STAFF',
}

export enum Context {
  MATCH = 'MATCH',
  TRAINING = 'TRAINING',
  PHYSICAL = 'PHYSICAL',
}

export interface Subject {
  id: string;
  teamId?: string;
  name: string;
  lastName?: string;
  birthDate?: string;
  contact?: string;
  role: Role;
  photoUrl?: string;
  number?: number;
  position?: string;
  dnaId?: string;
}

export interface AttendanceRecord {
  id: string;
  teamId?: string;
  eventId?: string;
  sessionId?: string;
  subjectId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export interface HealthIncident {
  id: string;
  teamId?: string;
  subjectId: string;
  date: string;
  type: string;
  status: 'active' | 'recovered' | 'treatment' | 'monitoring';
  severity: 'low' | 'medium' | 'high';
  notes: string;
  recoveryDate?: string;
}

export interface QualitativeReport {
  id: string;
  teamId?: string;
  subjectId: string;
  date: string;
  coachId: string;
  season?: string;
  comments?: string;
  overall?: string;
  evaluations: {
    tactical: string;
    technical: string;
    physical: string;
    behavioral: string;
  };
}

export interface Session {
  id: string;
  teamId: string;
  date: string;
  type: 'TRAINING' | 'MATCH' | 'PHYSICAL' | 'OTHER';
  title: string;
  notes?: string;
  durationMins?: number;
  /** ID del training_schedule que generó esta sesión (null si fue creada manualmente) */
  scheduleId?: string;
}

export interface Metric {
  id: string;
  name: string;
  unit: string;
  category: 'performance' | 'health' | 'physical';
}

export interface Event {
  id: string;
  date: string;
  context: Context;
  title: string;
  opponent?: string;
  location?: string;
}

export interface RecordItem {
  id: string;
  eventId: string;
  subjectId: string;
  metricId: string;
  value: number;
}

export interface WellnessReport {
  id: string;
  teamId?: string;
  subjectId: string;
  date: string;
  fatigue: number;        // 1-5
  sleepQuality: number;   // 1-5
  muscleSoreness: number; // 1-5
  stressLevel: number;    // 1-5
  mood: number;           // 1-5
  notes?: string;
}

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  location?: string;
  isHome: boolean;
  resultUs?: number;
  resultThem?: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  stats_headers?: string[];
  match_report?: string;
}

export interface LoadRecord {
  id: string;
  teamId?: string;
  sessionId: string;
  subjectId: string;
  borgScale: number;
  sessionLoad: number;
  durationMins: number;
}

export interface TestDefinition {
  id: string;
  teamId: string;
  name: string;
  unit: string;
}

export interface PhysicalTestResult {
  id: string;
  teamId: string;
  subjectId: string;
  testId: string;
  date: string;
  value: number;
}

export interface MatchStat {
  id: string;
  matchId: string;
  subjectId: string;
  stats: Record<string, string | number>;
}

export interface AIInsight {
  subjectId: string;
  content: string;
  date: string;
  tags: string[];
}
