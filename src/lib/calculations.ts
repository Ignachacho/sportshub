/**
 * calculations.ts
 * ───────────────
 * Funciones de cálculo deportivo y de riesgo.
 * Sin dependencias de React ni Supabase — sólo tipos y lógica pura.
 */

import { LoadRecord, Session, WellnessReport } from '../types';

// ── Wellness ─────────────────────────────────────────────────────────────────

export const calculateWellnessScores = (w: WellnessReport) => {
  const fFisica = w.muscleSoreness + w.fatigue;
  const fMental = w.mood + w.stressLevel + w.sleepQuality;
  return { fFisica, fMental, total: fFisica + fMental };
};

export const getWellnessColor = (val: number) => {
  if (val <= 2)   return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  if (val <= 3.5) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  return 'bg-red-500/20 text-red-500 border border-red-500/30';
};

// ── Risk ──────────────────────────────────────────────────────────────────────

export const calculateRiskScore = (wellness: number, load: number): number => {
  const normalizedWellness = Math.max(0, Math.min(100, ((wellness - 1) / 4) * 100));
  const normalizedLoad     = Math.max(0, Math.min(100, (load / 800) * 100));
  return Math.round((normalizedWellness * 0.7) + (normalizedLoad * 0.3));
};

export const getRiskColor = (score: number) => {
  if (score >= 75) return { bg: 'bg-red-500',     text: 'text-red-500',     border: 'border-red-500/30',     label: 'CRÍTICO' };
  if (score >= 55) return { bg: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-orange-500/30',  label: 'ALERTA'  };
  if (score >= 35) return { bg: 'bg-yellow-500',  text: 'text-yellow-400',  border: 'border-yellow-500/30',  label: 'VIGILAR' };
  return                  { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'ÓPTIMO'  };
};

// ── ACWR ──────────────────────────────────────────────────────────────────────

/**
 * ACWR (Acute:Chronic Workload Ratio) — Banister Foster CR10
 * Aguda (7d media) / Crónica (28d media)
 * Zona segura: 0.8 – 1.3
 */
export const calculateACWR = (
  loadRecords: LoadRecord[],
  sessions: Session[],
  subjectId: string,
): number | null => {
  const now    = new Date();
  const dayMs  = 86400000;

  const dailyLoad = new Map<string, number>();
  loadRecords
    .filter(l => l.subjectId === subjectId)
    .forEach(l => {
      const sess = sessions.find(s => s.id === l.sessionId);
      if (!sess) return;
      const d = typeof sess.date === 'string'
        ? sess.date.split('T')[0]
        : new Date(sess.date).toISOString().split('T')[0];
      dailyLoad.set(d, (dailyLoad.get(d) || 0) + (l.sessionLoad || 0));
    });

  let acuteTotal = 0, chronicTotal = 0;
  for (let i = 0; i < 28; i++) {
    const d    = new Date(now.getTime() - i * dayMs).toISOString().split('T')[0];
    const load = dailyLoad.get(d) || 0;
    if (i < 7) acuteTotal += load;
    chronicTotal += load;
  }

  const acute   = acuteTotal  / 7;
  const chronic = chronicTotal / 28;
  if (chronic === 0) return null;
  return Math.round((acute / chronic) * 100) / 100;
};

/**
 * Color y etiqueta para un valor ACWR dado.
 * Devuelve clases Tailwind + valor hex para gráficas.
 */
export const acwrColor = (v: number) => {
  if (v < 0.8)  return { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30',    label: 'BAJO',      bar: '#3b82f6' };
  if (v <= 1.3) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'ÓPTIMO',    bar: '#10b981' };
  if (v <= 1.5) return { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/30',  label: 'PRECAUCIÓN',bar: '#eab308' };
  return               { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'RIESGO',    bar: '#ef4444' };
};

// ── Fecha ─────────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha JS como 'YYYY-MM-DD' usando hora LOCAL.
 * Evita el desfase UTC en calendarios (p.ej. España UTC+2).
 */
export const localDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
