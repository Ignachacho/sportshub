/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Role, Context, Subject, Metric, Event, RecordItem, Team } from './types';

export const MOCK_TEAMS: Team[] = [
  { id: 't1', name: 'CB Dragons Academy', category: 'U18 Gold', sport: 'Basketball', playersCount: 12 },
  { id: 't2', name: 'Spartans BC', category: 'Senior Pro', sport: 'Basketball', playersCount: 15 },
  { id: 't3', name: 'Westside Titans', category: 'U16 Regional', sport: 'Basketball', playersCount: 10 },
];

export const MOCK_SUBJECTS: Subject[] = [
  { id: 'p1', teamId: 't1', name: 'Marcos Ruiz', lastName: 'Rivera', role: Role.PLAYER, number: 10, position: 'Base', contact: 'marcos@ejemplo.com' },
  { id: 'p2', teamId: 't1', name: 'Alex Rivera', lastName: 'Santos', role: Role.PLAYER, number: 23, position: 'Escolta' },
  { id: 'p3', teamId: 't1', name: 'Dani López', lastName: 'García', role: Role.PLAYER, number: 5, position: 'Alero' },
  { id: 'p4', teamId: 't1', name: 'Lucas Martin', lastName: 'Sánchez', role: Role.PLAYER, number: 15, position: 'Ala-Pívot' },
  { id: 'p5', teamId: 't1', name: 'Jordi Soler', lastName: 'Vidal', role: Role.PLAYER, number: 32, position: 'Pívot' },
  { id: 's1', teamId: 't1', name: 'Ignacio Arcas', role: Role.STAFF, position: 'Head Coach' },
  { id: 's2', teamId: 't1', name: 'Marta Pérez', role: Role.STAFF, position: 'Physiotherapist' },
  { id: 's3', teamId: 't1', name: 'David Ortíz', role: Role.STAFF, position: 'Assistant Coach' },
];

export const MOCK_METRICS: Metric[] = [
  { id: 'm1', name: 'Points', unit: 'pts', category: 'performance' },
  { id: 'm2', name: 'Rebounds', unit: 'reb', category: 'performance' },
  { id: 'm3', name: 'Assists', unit: 'ast', category: 'performance' },
  { id: 'm4', name: 'Wellness', unit: '/5', category: 'health' },
  { id: 'm5', name: 'RPE', unit: '/10', category: 'health' },
  { id: 'm6', name: 'Minutes', unit: 'min', category: 'performance' },
];

export const MOCK_EVENTS: Event[] = [
  { id: 'e1', date: '2026-04-20', context: Context.MATCH, title: 'Match vs Derby Kings', opponent: 'Derby Kings' },
  { id: 'e2', date: '2026-04-21', context: Context.TRAINING, title: 'Tactical Session' },
  { id: 'e3', date: '2026-04-23', context: Context.MATCH, title: 'Match vs Sea Hawks', opponent: 'Sea Hawks' },
];

export const MOCK_RECORDS: RecordItem[] = [
  // Event 1 (Match)
  { id: 'r1', eventId: 'e1', subjectId: 'p1', metricId: 'm1', value: 12 },
  { id: 'r2', eventId: 'e1', subjectId: 'p1', metricId: 'm2', value: 4 },
  { id: 'r3', eventId: 'e1', subjectId: 'p2', metricId: 'm1', value: 25 },
  { id: 'r4', eventId: 'e1', subjectId: 'p3', metricId: 'm1', value: 8 },
  // Event 2 (Training-Health)
  { id: 'r5', eventId: 'e2', subjectId: 'p1', metricId: 'm4', value: 4 },
  { id: 'r6', eventId: 'e2', subjectId: 'p1', metricId: 'm5', value: 7 },
  { id: 'r7', eventId: 'e2', subjectId: 'p2', metricId: 'm4', value: 3 },
  { id: 'r8', eventId: 'e2', subjectId: 'p2', metricId: 'm5', value: 8 },
];
