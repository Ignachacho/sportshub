/**
 * Sports Management Hub — App.tsx v2.5
 * Full rewrite: todas las funciones implementadas, sistema de toast,
 * diseño visual mejorado, nuevas funcionalidades para entrenador.
 *
 * FIXES vs v1:
 * ✅ Toast system (eliminados todos los alert())
 * ✅ "Plan de Sesión" → modal de planificación con bloques de ejercicios
 * ✅ "Pasar Lista" en Roster → abre AttendanceTool inline sin navegar
 * ✅ ReportsView → cálculo real desde datos de BD (no hardcoded)
 * ✅ "Export PDF" en Reports → print con estilos CSS dedicados
 * ✅ "Notify Staff" → toast de confirmación
 * ✅ "+ Nueva Incidencia" en PlayerDetail → formulario inline
 * ✅ "Ver Detalle"/"Editar" en Evaluaciones → modo expandible
 * ✅ "Exportar Ficha PDF" → vista de impresión específica del jugador
 * ✅ "Configuración" en ProfileView → panel de configuración real
 * ✅ handleAddPhysicalTest → tabla correcta (physical_test_results)
 * ✅ HealthView scatter → cruce temporal X/X+1 correcto
 * ✅ ACWR (Acute:Chronic Workload Ratio) en HealthView
 * ✅ Team Readiness en Dashboard
 * NEW: SessionPlanTool — planificador de sesión con bloques de ejercicios
 * NEW: Team Calendar view en Dashboard
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, ComposedChart, Legend,
  ReferenceLine, Area, AreaChart, Cell
} from 'recharts';
import {
  Users, Activity, Calendar, BarChart3, HeartPulse, BrainCircuit,
  PlusCircle, FileText, ChevronRight, X, Loader2, Trophy, Upload,
  RefreshCw, Sparkles, Save, Edit2, Bell, Settings, Check, AlertTriangle,
  Info, CheckCircle, Clock, MapPin, Zap, Target, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Printer, Send, Filter, LogOut, User, Shield, Trash2,
  Dumbbell, Timer, BookOpen, Star, AlertCircle, MoreVertical, Copy,
  Download, Eye, EyeOff, Minus, Plus, RotateCcw, ChevronLeft, Menu, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Role, Subject, Team, HealthIncident, QualitativeReport, WellnessReport,
  Match, Session, LoadRecord, TestDefinition, PhysicalTestResult, MatchStat, AttendanceRecord
} from './types';
import { cn } from './lib/utils';
import { generatePerformanceSummary, extractMatchStatsFromFile } from './lib/gemini';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// MAPPERS
// ─────────────────────────────────────────────────────────────────────────────

const mapTeam = (t: any): Team => ({
  id: t.id, name: t.name, category: t.category,
  sport: t.sport, playersCount: t.players_count || 0
});
const mapSubject = (s: any): Subject => ({
  id: s.id, teamId: s.team_id, name: s.name, lastName: s.last_name,
  birthDate: s.birth_date, contact: s.contact, role: s.role as Role,
  number: s.number, position: s.position, photoUrl: s.photo_url, dnaId: s.dna_id
});
const mapIncident = (i: any): HealthIncident => ({
  id: i.id, teamId: i.team_id, subjectId: i.subject_id, date: i.date,
  type: i.type, status: i.status as any, severity: i.severity as any,
  notes: i.notes, recoveryDate: i.recovery_date
});
const mapLoadRecord = (l: any): LoadRecord => ({
  id: l.id, sessionId: l.session_id, subjectId: l.subject_id,
  borgScale: l.borg_scale, durationMins: l.duration_mins, sessionLoad: l.session_load
});
const mapTestDefinition = (d: any): TestDefinition => ({
  id: d.id, teamId: d.team_id, name: d.name, unit: d.unit
});
const mapPhysicalTestResult = (r: any): PhysicalTestResult => ({
  id: r.id, teamId: r.team_id, subjectId: r.subject_id,
  testId: r.test_id, date: r.date, value: r.value,
  notes: r.notes || '',
} as any);
const mapMatchStat = (m: any): MatchStat => ({
  id: m.id, matchId: m.match_id, subjectId: m.subject_id, stats: m.stats || {}
});
const mapEvaluation = (e: any): QualitativeReport => ({
  id: e.id, teamId: e.team_id, subjectId: e.subject_id, date: e.date,
  coachId: e.coach_id, season: e.season, comments: e.comments, overall: e.overall,
  evaluations: { tactical: e.tactical, technical: e.technical, physical: e.physical, behavioral: e.behavioral }
});
const mapWellness = (w: any): WellnessReport => ({
  id: w.id, teamId: w.team_id, subjectId: w.subject_id, date: w.date,
  fatigue: w.fatigue, sleepQuality: w.sleep_quality,
  muscleSoreness: w.muscle_soreness, stressLevel: w.stress_level,
  mood: w.mood, notes: w.notes
});
const mapMatch = (m: any): Match => ({
  id: m.id, teamId: m.team_id, opponent: m.opponent, date: m.date,
  location: m.location, isHome: m.is_home, resultUs: m.result_us,
  resultThem: m.result_them, status: m.status,
  stats_headers: m.stats_headers || [], match_report: m.match_report
});
const mapAttendance = (a: any): AttendanceRecord => ({
  id: a.id, teamId: a.team_id, sessionId: a.session_id,
  subjectId: a.subject_id, status: a.status as any
});
const mapSession = (s: any): Session => ({
  id: s.id, teamId: s.team_id, date: s.date, type: s.type,
  title: s.title, notes: s.notes, durationMins: s.duration_mins
});

// Training schedule type (no está en types.ts, la definimos aquí)
type TrainingSchedule = {
  id: string;
  teamId: string;
  dayOfWeek: number; // 0=Dom, 1=Lun ... 6=Sáb
  startTime: string; // "HH:MM"
  endTime: string;
  sessionType: string;
  title: string;
  active: boolean;
};
const mapTrainingSchedule = (s: any): TrainingSchedule => ({
  id: s.id, teamId: s.team_id, dayOfWeek: s.day_of_week,
  startTime: s.start_time, endTime: s.end_time,
  sessionType: s.session_type || 'TRAINING', title: s.title || '', active: s.active !== false,
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS & CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────

const calculateWellnessScores = (w: WellnessReport) => {
  const fFisica = w.muscleSoreness + w.fatigue;
  const fMental = w.mood + w.stressLevel + w.sleepQuality;
  return { fFisica, fMental, total: fFisica + fMental };
};

const calculateRiskScore = (wellness: number, load: number): number => {
  const normalizedWellness = Math.max(0, Math.min(100, ((wellness - 1) / 4) * 100));
  const normalizedLoad = Math.max(0, Math.min(100, (load / 800) * 100));
  return Math.round((normalizedWellness * 0.7) + (normalizedLoad * 0.3));
};

const getWellnessColor = (val: number) => {
  if (val <= 2) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  if (val <= 3.5) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
  return "bg-red-500/20 text-red-500 border border-red-500/30";
};

const getRiskColor = (score: number) => {
  if (score >= 75) return { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500/30', label: 'CRÍTICO' };
  if (score >= 55) return { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', label: 'ALERTA' };
  if (score >= 35) return { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'VIGILAR' };
  return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'ÓPTIMO' };
};

// ACWR color utility — usado en Dashboard, HealthView y PlayerDetail
const acwrColor = (v: number) => {
  if (v < 0.8) return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'BAJO', bar: '#3b82f6' };
  if (v <= 1.3) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'ÓPTIMO', bar: '#10b981' };
  if (v <= 1.5) return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'PRECAUCIÓN', bar: '#eab308' };
  return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'RIESGO', bar: '#ef4444' };
};

// ACWR: Acute (7d) / Chronic (28d) load ratio
const calculateACWR = (loadRecords: LoadRecord[], sessions: Session[], subjectId: string): number | null => {
  const now = new Date();
  const dayMs = 86400000;

  const dailyLoad = new Map<string, number>();
  loadRecords
    .filter(l => l.subjectId === subjectId)
    .forEach(l => {
      const sess = sessions.find(s => s.id === l.sessionId);
      if (!sess) return;
      const d = typeof sess.date === 'string' ? sess.date.split('T')[0] : new Date(sess.date).toISOString().split('T')[0];
      dailyLoad.set(d, (dailyLoad.get(d) || 0) + (l.sessionLoad || 0));
    });

  let acuteTotal = 0, chronicTotal = 0;
  for (let i = 0; i < 28; i++) {
    const d = new Date(now.getTime() - i * dayMs).toISOString().split('T')[0];
    const load = dailyLoad.get(d) || 0;
    if (i < 7) acuteTotal += load;
    chronicTotal += load;
  }
  const acute = acuteTotal / 7;
  const chronic = chronicTotal / 28;
  if (chronic === 0) return null;
  return Math.round((acute / chronic) * 100) / 100;
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastItem = { id: string; type: ToastType; message: string };

const ToastContainer = ({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) => {
  const iconMap = { success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info };
  const colorMap = {
    success: 'bg-slate-900 border-emerald-500/40 text-emerald-300',
    error: 'bg-slate-900 border-red-500/40 text-red-300',
    warning: 'bg-slate-900 border-emerald-500/40 text-emerald-300',
    info: 'bg-slate-900 border-blue-500/40 text-blue-300',
  };
  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[300] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = iconMap[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium shadow-2xl border min-w-[280px] max-w-sm',
                colorMap[t.type]
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => onDismiss(t.id)} className="text-slate-500 hover:text-white transition-colors ml-2">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN VIEW
// ─────────────────────────────────────────────────────────────────────────────

const LoginView = ({
  onLogin, onRegister, onForgotPin, error
}: {
  onLogin: (e: string, p: string) => void;
  onRegister: (e: string, p: string, n: string) => void;
  onForgotPin: (e: string, newPin: string) => void;
  error: string | null;
}) => {
  type Mode = 'login' | 'register' | 'forgot';
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const switchMode = (m: Mode) => { setMode(m); setLocalErr(''); setPin(''); setNewPin(''); setConfirmPin(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    if (mode === 'login') {
      onLogin(email, pin);
    } else if (mode === 'register') {
      if (pin.length < 4) { setLocalErr('La contraseña debe tener al menos 4 caracteres'); return; }
      onRegister(email, pin, name);
    } else {
      if (newPin.length < 4) { setLocalErr('La contraseña debe tener al menos 4 caracteres'); return; }
      if (newPin !== confirmPin) { setLocalErr('Las contraseñas no coinciden'); return; }
      onForgotPin(email, newPin);
    }
  };

  const titles: Record<Mode, { title: string; sub: string; btn: string }> = {
    login:    { title: 'Bienvenido',        sub: 'Panel del Entrenador',          btn: 'Iniciar Sesión'        },
    register: { title: 'Crear Cuenta',      sub: 'Nuevo Entrenador',              btn: 'Registrarse'           },
    forgot:   { title: 'Recuperar Acceso',  sub: 'Restablece tu contraseña',      btn: 'Actualizar Contraseña' },
  };
  const { title, sub, btn } = titles[mode];
  const displayErr = localErr || error;

  return (
    <div className="min-h-screen bg-[#070b12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[700px] h-[700px] bg-emerald-600/20 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-amber-600/8 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '9s' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* Glass card */}
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-[0_32px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">

            {/* Logo + Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-5">
                <div className="absolute inset-[-4px] bg-emerald-500/40 rounded-3xl blur-xl" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[18px] flex items-center justify-center shadow-[0_8px_32px_rgba(16,185,129,0.5)]">
                  <span className="font-black text-white text-2xl tracking-tight">CK</span>
                </div>
              </div>
              <h1 className="text-2xl font-black text-white mb-1 tracking-tight">{title}</h1>
              <p className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-[0.3em]">{sub}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Corporativo</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="coach@club.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 focus:bg-white/8 outline-none transition-all"
                />
              </div>

              {/* Name — register only */}
              <AnimatePresence>
                {mode === 'register' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="overflow-hidden space-y-1.5"
                  >
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Nombre y Apellidos"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password — login & register */}
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => switchMode('forgot')}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                        ¿La olvidaste?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'} value={pin} onChange={e => setPin(e.target.value)} required
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 pr-12 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all"
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1">
                      {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {/* New PIN — forgot mode */}
              <AnimatePresence>
                {mode === 'forgot' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="overflow-hidden space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                      <input
                        type="password" value={newPin} onChange={e => setNewPin(e.target.value)} required
                        placeholder="Mínimo 4 caracteres"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                      <input
                        type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} required
                        placeholder="Repite la contraseña"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5">
                      <Info size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-emerald-300/90 text-[11px] leading-relaxed">
                        Si tu email está registrado en el sistema podrás actualizar tu contraseña directamente.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error display */}
              <AnimatePresence>
                {displayErr && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl"
                  >
                    <AlertCircle size={13} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-xs">{displayErr}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Demo hint when Supabase not configured */}
              {!isSupabaseConfigured && mode === 'login' && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                  <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-yellow-300 text-[11px] leading-relaxed">
                    Modo local: usa <strong>admin@sports.pro</strong> / <strong>1234</strong>
                  </p>
                </div>
              )}

              {/* CTA button */}
              <button type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-[0_8px_24px_rgba(16,185,129,0.35)] hover:shadow-[0_12px_36px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0 mt-1"
              >
                {btn}
              </button>

              {/* Mode links */}
              <div className="flex items-center justify-center gap-4 pt-1">
                {mode !== 'login' && (
                  <button type="button" onClick={() => switchMode('login')}
                    className="text-xs text-slate-400 hover:text-white font-semibold transition-colors flex items-center gap-1">
                    <ChevronLeft size={12} /> Volver al login
                  </button>
                )}
                {mode === 'login' && (
                  <button type="button" onClick={() => switchMode('register')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                    ¿Primera vez? Regístrate →
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-5 text-[9px] text-slate-600 font-mono uppercase tracking-wider">
            <span>GDPR / LOPD</span><span className="text-slate-700">•</span>
            <span>CoachKit v2.5</span><span className="text-slate-700">•</span>
            <span>Solo Personal Técnico</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TEAM SELECTION VIEW
// ─────────────────────────────────────────────────────────────────────────────

const TeamSelectionView = ({
  teams, onSelect, onRegisterTeam, onInvite, onDeleteTeam, currentUser, onLogout
}: {
  teams: Team[];
  onSelect: (t: Team) => void;
  onRegisterTeam: (t: Partial<Team>) => Promise<void>;
  onInvite: (teamId: string, email: string) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  currentUser: any;
  onLogout: () => void;
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', category: '' });
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await onRegisterTeam({ name: form.name, category: form.category || 'Senior', sport: 'BASKETBALL' });
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteTeamId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await onInvite(inviteTeamId, inviteEmail.trim().toLowerCase());
      setInviteEmail('');
      setInviteTeamId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteTeam = teams.find(t => t.id === inviteTeamId);
  const deleteTeam = teams.find(t => t.id === deleteTeamId);

  const handleDeleteSubmit = async () => {
    if (!deleteTeamId || deleteConfirmName !== deleteTeam?.name) return;
    setDeleteLoading(true);
    try {
      await onDeleteTeam(deleteTeamId);
      setDeleteTeamId(null);
      setDeleteConfirmName('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6 md:p-12 relative overflow-hidden">
      {/* Invite modal */}
      {inviteTeamId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-[28px] p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="font-black text-white text-lg">Invitar al staff</h3>
                <p className="text-[10px] text-slate-500">{inviteTeam?.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              La persona invitada verá y podrá editar este equipo con su propia cuenta. Debe tener cuenta registrada en la app.
            </p>
            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email del entrenador</label>
              <input
                type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="hermana@gmail.com" autoFocus
                onKeyDown={e => e.key === 'Enter' && handleInviteSubmit()}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setInviteTeamId(null); setInviteEmail(''); }}
                className="flex-1 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-slate-700 transition-all">
                Cancelar
              </button>
              <button onClick={handleInviteSubmit} disabled={inviteLoading || !inviteEmail.trim()}
                className="flex-1 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                {inviteLoading ? <><Loader2 size={13} className="animate-spin" />Invitando...</> : <>Invitar</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Delete confirmation modal */}
      {deleteTeamId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-red-500/20 rounded-[28px] p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h3 className="font-black text-white text-lg">Eliminar equipo</h3>
            </div>
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 my-5 space-y-1">
              <p className="text-xs font-black text-red-400 uppercase tracking-widest">⚠️ Acción irreversible</p>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Se eliminarán permanentemente <span className="text-white font-bold">todos los datos</span> de <span className="text-red-400 font-bold">«{deleteTeam?.name}»</span>: jugadores, sesiones, tests físicos, wellness, lesiones, evaluaciones y estadísticas.
              </p>
            </div>
            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Escribe <span className="text-red-400">{deleteTeam?.name}</span> para confirmar
              </label>
              <input
                value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTeam?.name}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500/50 transition-colors" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTeamId(null); setDeleteConfirmName(''); }}
                className="flex-1 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-slate-700 transition-all">
                Cancelar
              </button>
              <button onClick={handleDeleteSubmit}
                disabled={deleteLoading || deleteConfirmName !== deleteTeam?.name}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {deleteLoading ? <><Loader2 size={13} className="animate-spin" />Eliminando...</> : <><Trash2 size={13} />Eliminar</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-slate-950">CK</div>
            <span className="font-black text-white tracking-tight">CoachKit</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-white uppercase">{currentUser?.name || currentUser?.email?.split('@')[0]}</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Coach</p>
            </div>
            <button onClick={onLogout} className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-red-500 px-4 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-red-500/10 transition-all">
              <LogOut size={12} /> Salir
            </button>
          </div>
        </div>

        {isCreating ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-slate-900 border border-slate-800 p-10 rounded-[32px] shadow-2xl">
              <h2 className="text-2xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><Plus size={18} className="text-slate-950" /></div>
                Nuevo Equipo
              </h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="CB Dragons Academy" disabled={loading}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Categoría</label>
                  <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Senior / U18 / Junior" disabled={loading}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsCreating(false)} disabled={loading} className="flex-1 py-3.5 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase border border-slate-700 hover:bg-slate-700 transition-all">Cancelar</button>
                  <button onClick={handleCreate} disabled={loading || !form.name.trim()} className="flex-1 py-3.5 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? 'Creando...' : 'Crear Equipo'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="mb-12">
              <p className="text-xs font-mono text-emerald-500 uppercase tracking-[0.3em] mb-3">Panel Multi-Equipo</p>
              <h2 className="text-5xl font-black tracking-tighter text-white max-w-lg leading-tight">Elige el equipo<br />para esta sesión.</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {teams.map(team => (
                <div key={team.id} className="relative group">
                  <motion.button whileHover={{ y: -4 }} onClick={() => onSelect(team)}
                    className="w-full bg-slate-900 border border-slate-800 p-8 rounded-[28px] text-left hover:border-emerald-500/50 transition-all shadow-lg flex flex-col justify-between min-h-[240px]">
                    <div className="flex justify-between">
                      <div className="w-12 h-12 bg-slate-950 border border-slate-700 rounded-2xl flex items-center justify-center text-xl font-black text-white group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">{team.name.charAt(0)}</div>
                      <span className="text-[9px] font-mono bg-slate-800 text-slate-500 px-2 py-1 rounded-lg border border-slate-700 uppercase self-start">{team.sport || 'BBALL'}</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">{team.category}</p>
                      <h3 className="text-xl font-black text-white mb-3 group-hover:text-emerald-500 transition-colors leading-tight">{team.name}</h3>
                      <p className="text-[10px] text-slate-600 font-mono uppercase flex items-center gap-1.5"><Users size={10} /> {team.playersCount} jugadores</p>
                    </div>
                  </motion.button>
                  {/* Action buttons — visible on hover */}
                  <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={e => { e.stopPropagation(); setInviteTeamId(team.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all">
                      <Users size={10} /> Invitar
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTeamId(team.id); setDeleteConfirmName(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/30 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all">
                      <Trash2 size={10} /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => setIsCreating(true)} className="border-2 border-dashed border-slate-800 p-8 rounded-[28px] flex flex-col items-center justify-center gap-3 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all group min-h-[240px]">
                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-slate-800 transition-all">
                  <Plus size={22} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em] group-hover:text-slate-400 transition-colors">Nuevo Equipo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'today',          label: 'Hoy',              icon: CheckCircle },
  { id: 'dashboard',      label: 'Dashboard',        icon: BarChart3 },
  { id: 'roster',         label: 'Plantilla',        icon: Users },
  { id: 'sessions',       label: 'Sesiones',         icon: Timer },
  { id: 'matches',        label: 'Partidos',         icon: Trophy },
  { id: 'physical_tests', label: 'Tests Físicos',    icon: Dumbbell },
  { id: 'prepfisica',     label: 'Prep. Física',     icon: Zap },
  { id: 'health',         label: 'Salud',            icon: HeartPulse },
  { id: 'reports',        label: 'Informes IA',      icon: BrainCircuit },
  { id: 'profile',        label: 'Perfil',           icon: User },
];

const Sidebar = ({
  activeTab, setActiveTab, activeTeam, onSwitchTeam, onLogout, currentUser
}: {
  activeTab: string; setActiveTab: (t: string) => void;
  activeTeam: Team | null; onSwitchTeam: () => void;
  onLogout: () => void; currentUser: any;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onSwitchTeam}>
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-sm shadow-lg shadow-emerald-500/25">CK</div>
          <div>
            <p className="font-black text-sm text-white tracking-tight leading-none">CoachKit</p>
            <p className="text-[8px] text-slate-600 uppercase tracking-widest font-mono mt-0.5">v2.5 Pro</p>
          </div>
        </div>
        <button className="lg:hidden text-slate-500 hover:text-white" onClick={() => setMobileOpen(false)}><X size={18} /></button>
      </div>

      {/* Status chip */}
      <div className="mb-5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-2">
        <div className={cn("w-1.5 h-1.5 rounded-full", isSupabaseConfigured ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-yellow-500")}></div>
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest truncate">
          {isSupabaseConfigured ? 'Supabase Live' : 'Modo Local'}
        </span>
      </div>

      {/* Active team */}
      <div className="mb-6 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1">Equipo activo</p>
        <p className="text-xs font-bold text-white truncate">{activeTeam?.name || '—'}</p>
        <button onClick={onSwitchTeam} className="text-[9px] text-emerald-500 font-bold mt-1 hover:underline uppercase tracking-wide">Cambiar equipo →</button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all",
              activeTab === item.id
                ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}>
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* User + logout */}
      <div className="mt-auto pt-5 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-white">
            {(currentUser?.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{currentUser?.name || currentUser?.email?.split('@')[0] || 'Coach'}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Staff Técnico</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-red-500 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 transition-all">
          <LogOut size={12} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 bg-slate-900 border-r border-slate-800 h-screen fixed left-0 top-0 z-40 p-5 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer (triggered from bottom nav "Más") */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 30 }}
              className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 p-5 flex flex-col lg:hidden shadow-2xl">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-16">
          {[
            { id: 'today',    label: 'Hoy',       icon: CheckCircle },
            { id: 'roster',   label: 'Plantilla', icon: Users },
            { id: 'sessions', label: 'Sesiones',  icon: Timer },
            { id: 'health',   label: 'Salud',     icon: HeartPulse },
          ].map(item => (
            <button key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
                activeTab === item.id ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
              )}>
              <item.icon size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          ))}
          <button onClick={() => setMobileOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300 transition-all active:scale-95">
            <Menu size={22} />
            <span className="text-[9px] font-bold uppercase tracking-wide">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADER (page title + primary action button)
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_CONFIG: Record<string, { title: string; subtitle: string; action?: string }> = {
  today:          { title: 'Hoy',                subtitle: 'Tu jornada de entrenamiento' },
  dashboard:      { title: 'Dashboard',          subtitle: 'Métricas y gráficos del equipo' },
  roster:         { title: 'Plantilla',           subtitle: 'Gestión de jugadores y staff', action: '+ Jugador' },
  sessions:       { title: 'Sesiones',            subtitle: 'Entrenamientos y registro de carga', action: '+ Sesión' },
  matches:        { title: 'Partidos',            subtitle: 'Calendario y estadísticas de partido', action: '+ Partido' },
  physical_tests: { title: 'Tests Físicos',       subtitle: 'Control de rendimiento físico individual', action: '+ Test' },
  wellness:       { title: 'Test Wellness',       subtitle: 'Índice de Hooper diario por jugador' },
  health:         { title: 'Salud y Prevención',  subtitle: 'Lesiones, riesgo y carga de trabajo', action: '+ Incidencia' },
  reports:        { title: 'Informes IA',         subtitle: 'Análisis avanzado generado por IA' },
  profile:        { title: 'Mi Perfil',           subtitle: 'Cuenta y configuración' },
};

const Header = ({ title, onAdd }: { title: string; onAdd?: () => void }) => {
  const cfg = HEADER_CONFIG[title] || { title, subtitle: '' };
  return (
    <div className="flex justify-between items-end mb-8 pt-2">
      <div>
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em] mb-1">CoachKit Pro</p>
        <h1 className="text-3xl font-black text-white tracking-tight">{cfg.title}</h1>
        {cfg.subtitle && <p className="text-sm text-slate-500 mt-1">{cfg.subtitle}</p>}
      </div>
      {cfg.action && onAdd && (
        <button onClick={onAdd}
          className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
          <Plus size={14} /> {cfg.action}
        </button>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// WELLNESS TEST VIEW
// ─────────────────────────────────────────────────────────────────────────────

const WellnessTestView = ({
  subjects, wellnessReports, onSave
}: {
  subjects: Subject[];
  wellnessReports: WellnessReport[];
  onSave: (w: WellnessReport) => Promise<void>;
}) => {
  const players = subjects.filter(s => s.role === Role.PLAYER);
  const [selectedId, setSelectedId] = useState(players[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ fatigue: 0, sleepQuality: 0, muscleSoreness: 0, stressLevel: 0, mood: 0, notes: '' });

  const existing = wellnessReports.find(w => w.subjectId === selectedId && w.date === date);
  useEffect(() => {
    if (existing) {
      setForm({ fatigue: existing.fatigue, sleepQuality: existing.sleepQuality, muscleSoreness: existing.muscleSoreness, stressLevel: existing.stressLevel, mood: existing.mood, notes: existing.notes || '' });
    } else {
      setForm({ fatigue: 0, sleepQuality: 0, muscleSoreness: 0, stressLevel: 0, mood: 0, notes: '' });
    }
    setSaved(false);
  }, [selectedId, date]);

  const fields = [
    { key: 'fatigue', label: 'Fatiga', desc: '1 = Nada fatigado — 5 = Agotado total' },
    { key: 'sleepQuality', label: 'Calidad del Sueño', desc: '1 = Excelente — 5 = Muy mal sueño' },
    { key: 'muscleSoreness', label: 'Dolor Muscular', desc: '1 = Sin molestias — 5 = Dolor intenso' },
    { key: 'stressLevel', label: 'Estrés', desc: '1 = Muy relajado — 5 = Muy estresado' },
    { key: 'mood', label: 'Estado de Ánimo', desc: '1 = Excelente — 5 = Muy bajo' },
  ] as const;

  const totalScore = form.fatigue + form.sleepQuality + form.muscleSoreness + form.stressLevel + form.mood;
  const avgScore = totalScore > 0 ? (totalScore / 5).toFixed(1) : '—';
  const isComplete = Object.values(form).slice(0, 5).every(v => (v as number) > 0);

  const handleSave = async () => {
    if (!isComplete || !selectedId) return;
    setSaving(true);
    try {
      await onSave({ id: existing?.id || '', teamId: '', subjectId: selectedId, date, ...form } as WellnessReport);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const todayFilledIds = new Set(wellnessReports.filter(w => w.date === date).map(w => w.subjectId));

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Registrados hoy</p>
          <p className="text-2xl font-black text-white">{todayFilledIds.size}<span className="text-sm text-slate-600 ml-1">/ {players.length}</span></p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Pendientes</p>
          <p className="text-2xl font-black text-emerald-500">{players.length - todayFilledIds.size}</p>
        </div>
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Score actual del jugador</p>
            <p className={cn("text-2xl font-black", totalScore === 0 ? 'text-slate-600' : totalScore <= 10 ? 'text-emerald-500' : totalScore <= 18 ? 'text-emerald-500' : 'text-red-500')}>{avgScore}<span className="text-sm text-slate-600 ml-1">/5</span></p>
          </div>
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-xs font-black border-2", totalScore === 0 ? 'border-slate-700 text-slate-600' : totalScore <= 10 ? 'border-emerald-500 text-emerald-500' : totalScore <= 18 ? 'border-emerald-500 text-emerald-500' : 'border-red-500 text-red-500')}>
            {totalScore === 0 ? '?' : totalScore <= 10 ? '✓' : totalScore <= 18 ? '!' : '⚠'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player list */}
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-5">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-4">Jugadores</p>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {players.map(p => {
              const filled = todayFilledIds.has(p.id);
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left",
                    selectedId === p.id ? "bg-emerald-500 text-slate-950" : "bg-slate-950 border border-slate-800 hover:border-slate-700 text-white")}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono opacity-50">#{p.number}</span>
                    <span className="text-sm font-bold">{p.name}</span>
                  </div>
                  {filled ? <Check size={14} className={selectedId === p.id ? 'text-slate-950' : 'text-emerald-500'} /> : <div className="w-3 h-3 rounded-full border-2 border-current opacity-30" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[24px] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-white text-lg">{players.find(p => p.id === selectedId)?.name || 'Selecciona jugador'}</h3>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
          </div>
          {fields.map(f => (
            <div key={f.key} className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-white">{f.label}</label>
                <span className="text-[10px] text-slate-500 italic">{f.desc}</span>
              </div>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(v => (
                  <button key={v} onClick={() => setForm(prev => ({ ...prev, [f.key]: v }))}
                    className={cn("flex-1 py-3 rounded-xl text-sm font-black transition-all border",
                      form[f.key] === v
                        ? v <= 2 ? "bg-emerald-500 border-emerald-500 text-slate-950" : v <= 4 ? "bg-emerald-500 border-emerald-500 text-slate-950" : "bg-red-500 border-red-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600")}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notas del jugador (opcional)</label>
            <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="¿Algo a destacar hoy?" rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-emerald-500/50" />
          </div>
          <button onClick={handleSave} disabled={!isComplete || saving}
            className={cn("w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              saved ? "bg-emerald-500 text-white" : isComplete ? "bg-white text-slate-950 hover:bg-slate-200 shadow-lg" : "bg-slate-800 text-slate-600 cursor-not-allowed")}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : saved ? <><Check size={14} /> Registrado</> : 'Guardar Wellness'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSION PLAN TOOL  (NEW — "Plan de Sesión" button fully implemented)
// ─────────────────────────────────────────────────────────────────────────────

type DrillBlock = { id: string; phase: string; name: string; duration: number; players: string; notes: string; tasks: string[] };

const SessionPlanTool = ({
  session, subjects, onClose, showToast
}: {
  session: Session; subjects: Subject[]; onClose: () => void; showToast: (t: ToastType, m: string) => void;
}) => {
  const [blocks, setBlocks] = useState<DrillBlock[]>([
    { id: '1', phase: 'Calentamiento', name: '', duration: 10, players: 'Todos', notes: '', tasks: [] },
    { id: '2', phase: 'Bloque Principal', name: '', duration: 30, players: 'Todos', notes: '', tasks: [''] },
    { id: '3', phase: 'Vuelta a la Calma', name: '', duration: 10, players: 'Todos', notes: '', tasks: [] },
  ]);
  const [objective, setObjective] = useState('');

  const addBlock = () => setBlocks(prev => [...prev, { id: Date.now().toString(), phase: 'Bloque Extra', name: '', duration: 15, players: 'Todos', notes: '', tasks: [''] }]);
  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id));
  const updateBlock = (id: string, field: keyof DrillBlock, value: any) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  const moveBlock = (id: string, dir: 'up' | 'down') => setBlocks(prev => {
    const idx = prev.findIndex(b => b.id === id);
    if (dir === 'up' && idx === 0) return prev;
    if (dir === 'down' && idx === prev.length - 1) return prev;
    const next = [...prev];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    return next;
  });
  const moveTask = (blockId: string, ti: number, dir: 'up' | 'down') => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const tasks = [...block.tasks];
    if (dir === 'up' && ti === 0) return;
    if (dir === 'down' && ti === tasks.length - 1) return;
    const swap = dir === 'up' ? ti - 1 : ti + 1;
    [tasks[ti], tasks[swap]] = [tasks[swap], tasks[ti]];
    updateBlock(blockId, 'tasks', tasks);
  };

  const totalMins = blocks.reduce((acc, b) => acc + b.duration, 0);
  const phaseColors: Record<string, string> = {
    'Calentamiento':       'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Activación':          'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'Bloque Principal':    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Técnica Individual':  'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'Táctica Colectiva':   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'Partido Controlado':  'bg-red-500/20 text-red-400 border-red-500/30',
    'Físico / Condición':  'bg-rose-500/20 text-rose-400 border-rose-500/30',
    'Vuelta a la Calma':   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Bloque Extra':        'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const handlePrint = () => {
    window.print();
    showToast('info', 'Abriendo vista de impresión del plan...');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-start justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-800 rounded-[28px] w-full max-w-3xl my-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-950/40">
          <div>
            <p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest mb-1">Plan de Sesión</p>
            <h2 className="text-xl font-black text-white tracking-tight">{session.title}</h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <Calendar size={11} /> {new Date(session.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              <span className="text-slate-700">•</span>
              <Timer size={11} /> {totalMins} min planificados
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"><Printer size={16} /></button>
            <button onClick={onClose} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Objective */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Objetivo de la Sesión</label>
            <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Ej: Mejora del tiro en movimiento, 4-out 1-in ofensivo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
          </div>

          {/* Timeline visual */}
          <div className="flex gap-1 h-6 rounded-full overflow-hidden">
            {blocks.map(b => (
              <div key={b.id} style={{ flex: b.duration }} title={`${b.phase}: ${b.duration} min`}
                className={cn("flex items-center justify-center text-[8px] font-bold transition-all", phaseColors[b.phase] || 'bg-slate-700 text-slate-400')}>
                {b.duration}m
              </div>
            ))}
          </div>

          {/* Blocks */}
          <div className="space-y-3">
            {blocks.map((block, idx) => (
              <div key={block.id} className={cn("border rounded-2xl p-4 space-y-3", phaseColors[block.phase] ? phaseColors[block.phase].replace('text-', 'border-').replace('/20', '/10').replace('bg-', 'border-') : 'border-slate-800', 'bg-slate-950')}>
                {/* Block header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-600 font-mono bg-slate-900 px-2 py-1 rounded-lg">#{idx + 1}</span>
                    {/* Phase selector */}
                    <select value={block.phase} onChange={e => updateBlock(block.id, 'phase', e.target.value)}
                      className={cn("text-[9px] font-bold px-2.5 py-1.5 rounded-lg border uppercase tracking-wide outline-none cursor-pointer",
                        phaseColors[block.phase] || 'bg-slate-800 text-slate-400 border-slate-700')}>
                      {['Calentamiento','Activación','Bloque Principal','Técnica Individual','Táctica Colectiva','Partido Controlado','Físico / Condición','Vuelta a la Calma','Bloque Extra'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Move block up/down */}
                    <div className="flex flex-col gap-0.5">
                      <button disabled={idx === 0} onClick={() => moveBlock(block.id, 'up')}
                        className="p-0.5 text-slate-700 hover:text-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                        <ChevronUp size={12} />
                      </button>
                      <button disabled={idx === blocks.length - 1} onClick={() => moveBlock(block.id, 'down')}
                        className="p-0.5 text-slate-700 hover:text-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                      <Timer size={10} className="text-slate-500" />
                      <input type="number" value={block.duration} min={1} max={120}
                        onChange={e => updateBlock(block.id, 'duration', parseInt(e.target.value) || 0)}
                        className="w-10 bg-transparent text-sm font-bold text-white outline-none text-center" />
                      <span className="text-[9px] text-slate-600">min</span>
                    </div>
                    {blocks.length > 1 && (
                      <button onClick={() => removeBlock(block.id)} className="p-1.5 text-slate-700 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"><X size={13} /></button>
                    )}
                  </div>
                </div>

                {/* Name + players */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Nombre del bloque</label>
                    <input value={block.name} onChange={e => updateBlock(block.id, 'name', e.target.value)}
                      placeholder="Ej: 4-out 1-in, Tiro en movimiento..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Participantes</label>
                    <select value={block.players} onChange={e => updateBlock(block.id, 'players', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40">
                      <option>Todos</option>
                      {subjects.filter(s => s.role === Role.PLAYER).map(p => <option key={p.id}>{p.name}</option>)}
                      <option value="Bases">Bases</option>
                      <option value="Aleros">Aleros</option>
                      <option value="Pívots">Pívots</option>
                      <option value="Exteriores">Exteriores</option>
                    </select>
                  </div>
                </div>

                {/* Tasks / exercises list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Tareas / Ejercicios</label>
                    <button onClick={() => updateBlock(block.id, 'tasks', [...(block.tasks || []), ''])}
                      className="text-[8px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Plus size={10} /> Añadir tarea
                    </button>
                  </div>
                  {(block.tasks || []).map((task, ti) => (
                    <div key={ti} className="flex items-center gap-2">
                      {/* Reorder task buttons */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button disabled={ti === 0} onClick={() => moveTask(block.id, ti, 'up')}
                          className="text-slate-700 hover:text-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                          <ChevronUp size={10} />
                        </button>
                        <button disabled={ti === (block.tasks || []).length - 1} onClick={() => moveTask(block.id, ti, 'down')}
                          className="text-slate-700 hover:text-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                          <ChevronDown size={10} />
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-700 font-mono w-4 shrink-0">{ti + 1}.</span>
                      <input value={task}
                        onChange={e => {
                          const t = [...(block.tasks || [])]; t[ti] = e.target.value;
                          updateBlock(block.id, 'tasks', t);
                        }}
                        placeholder="Descripción del ejercicio..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40" />
                      <button onClick={() => updateBlock(block.id, 'tasks', (block.tasks || []).filter((_, i) => i !== ti))}
                        className="text-slate-700 hover:text-red-500 transition-colors shrink-0"><X size={12} /></button>
                    </div>
                  ))}
                  {(block.tasks || []).length === 0 && (
                    <button onClick={() => updateBlock(block.id, 'tasks', [''])}
                      className="w-full py-2 border border-dashed border-slate-800 rounded-lg text-[9px] text-slate-700 hover:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase tracking-widest">
                      + Añadir primera tarea
                    </button>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Notas / Claves tácticas</label>
                  <input value={block.notes} onChange={e => updateBlock(block.id, 'notes', e.target.value)}
                    placeholder="Indicaciones clave, variantes, puntos de atención..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={addBlock} className="w-full py-3 border-2 border-dashed border-slate-800 rounded-2xl text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all flex items-center justify-center gap-2">
            <Plus size={14} /> Añadir bloque
          </button>

          <div className="flex gap-3 pt-2">
            <button onClick={() => { showToast('success', `Plan de "${session.title}" guardado localmente`); onClose(); }}
              className="flex-1 bg-emerald-500 text-slate-950 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
              <Save size={14} /> Guardar Plan
            </button>
            <button onClick={onClose} className="flex-1 bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition-all">Cerrar</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS VIEW
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING SCHEDULE MANAGER
// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL SESSION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TYPE_COLORS = {
  TRAINING: { bg: 'bg-blue-500/15 hover:bg-blue-500/25', text: 'text-blue-400', border: 'border-blue-500/25', dot: 'bg-blue-400', label: 'Entrenamiento' },
  MATCH:    { bg: 'bg-red-500/15 hover:bg-red-500/25',   text: 'text-red-400',   border: 'border-red-500/25',   dot: 'bg-red-400',   label: 'Partido'        },
  PHYSICAL: { bg: 'bg-emerald-500/15 hover:bg-emerald-500/25', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400', label: 'Físico' },
  OTHER:    { bg: 'bg-slate-500/15 hover:bg-slate-500/25', text: 'text-slate-400', border: 'border-slate-500/25', dot: 'bg-slate-500', label: 'Otro' },
};
const stc = (type: string) => SESSION_TYPE_COLORS[type as keyof typeof SESSION_TYPE_COLORS] || SESSION_TYPE_COLORS.OTHER;

// Encode/decode annotations + material + zone/phase in the notes field
const MATERIAL_DELIM = '\n---MATERIAL---\n';
const META_DELIM = '\n---META---\n';
const parseSessionNotes = (raw: string) => {
  const [notesBody = '', metaStr = ''] = (raw || '').split(META_DELIM);
  const parts = notesBody.split(MATERIAL_DELIM);
  const meta: Record<string, string> = {};
  metaStr.split('|').forEach(p => { const [k, v] = p.split(':'); if (k && v !== undefined) meta[k] = v; });
  return { annotations: parts[0] || '', material: parts[1] || '', zone: meta.zone || '', phase: meta.phase || '' };
};
const encodeSessionNotes = (annotations: string, material: string, zone = '', phase = '') => {
  const base = material.trim() ? `${annotations}${MATERIAL_DELIM}${material}` : annotations;
  const metaParts = [zone && `zone:${zone}`, phase && `phase:${phase}`].filter(Boolean);
  return metaParts.length ? `${base}${META_DELIM}${metaParts.join('|')}` : base;
};

// Extract start time from a datetime string (e.g. "2024-06-01T18:00:00" → "18:00")
const extractTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const t = dateStr.split('T')[1]?.slice(0, 5) || '';
  return t === '00:00' ? '' : t;
};

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICAL PREPARATION DATA — From validated basketball methodology (Cometti)
// ─────────────────────────────────────────────────────────────────────────────

const METABOLIC_ZONES = [
  { id: 'alactico', label: 'Anaeróbico Aláctico', short: 'ATP-PC',
    color: { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
    duration: '6 – 20 s', rest: '2 – 3 min', hr: '185 – 195 ppm', intensity: '95 – 100%',
    description: 'Explosiones, sprints, saltos. ATP y fosfocreatina como sustrato. Recuperación total obligatoria.',
    examples: ['Sprints 6-15m', 'CMJ en serie', 'Salidas explosivas', 'Aceleraciones 1vs1'],
    workRest: '1:6 a 1:10',
  },
  { id: 'lactico', label: 'Anaeróbico Láctico', short: 'Glucolítico',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
    duration: '30 s – 2 min', rest: '1 – 4 min', hr: '170 – 185 ppm', intensity: '80 – 95%',
    description: 'Contraataques sostenidos, presses altas. Ácido láctico como subproducto. Semivida del lactato: 15-20 min.',
    examples: ['Series de contraataque', 'Press defensivo 45s', 'Circuitos 1 min', 'Juego reducido intenso'],
    workRest: '1:2 a 1:4',
  },
  { id: 'aerobico', label: 'Aeróbico', short: 'Oxidativo',
    color: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
    duration: '≥ 3 min continuo', rest: 'Activo / mínimo', hr: '125 – 175 ppm', intensity: '60 – 80%',
    description: 'Se activa a los 3-5 min. Sustenta los 40 min reales de juego. Base aeróbica = mayor recuperación entre esfuerzos.',
    examples: ['Continuo extensivo 30+ min', '5vs5 fluido', 'Circuito técnico largo', 'Course Navette'],
    workRest: 'Continuo',
  },
  { id: 'fuerza', label: 'Fuerza / Potencia', short: 'Neuromuscular',
    color: { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
    duration: '3 – 10 s por rep', rest: '2 – 5 min entre series', hr: 'Variable', intensity: '70 – 100% 1RM',
    description: 'F.máxima, explosiva y pliometría. Descanso completo para máxima calidad neuro-muscular.',
    examples: ['½ squat con carga', 'Cargada / arrancada', 'Multisaltos verticales', 'Balón medicinal'],
    workRest: '1:10 a 1:20',
  },
  { id: 'mixto', label: 'Mixto / Integrado', short: 'Integrado',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
    duration: 'Variable', rest: 'Variable', hr: '130 – 185 ppm', intensity: 'Variable',
    description: 'Sesión que combina sistemas energéticos. Típico de entrenamiento técnico-táctico de baloncesto.',
    examples: ['Calentamiento + táctico + físico', 'Tiro + aceleración', '5vs5 con transiciones'],
    workRest: 'Según diseño',
  },
];

const PERIODIZATION_PHASES = [
  { id: 'basico', label: 'Básico', color: 'text-slate-300', bgColor: 'bg-slate-700/50 border-slate-600/50',
    description: 'Condición general, base aeróbica, fuerza-resistencia. Pre-temporada inicial.' },
  { id: 'dirigido', label: 'Dirigido', color: 'text-blue-300', bgColor: 'bg-blue-500/15 border-blue-500/25',
    description: 'Fuerza máxima concentrada (5-6 sem). Hipertrofia → F.Máxima → Potencia.' },
  { id: 'especifico', label: 'Específico', color: 'text-emerald-300', bgColor: 'bg-emerald-500/15 border-emerald-500/25',
    description: 'Transferencia al juego. Velocidad, pliometría, método complejo. Pretemporada.' },
  { id: 'competitivo', label: 'Competitivo', color: 'text-emerald-300', bgColor: 'bg-emerald-500/15 border-emerald-500/25',
    description: 'Mantenimiento. 1-2 sesiones/sem de fuerza. Prioridad táctica y descanso.' },
];

const FORCE_CYCLES = [
  { id: 'resistencia', label: 'Resistencia de Fuerza', phase: 'Básico', phaseColor: 'text-slate-300',
    series: '3 – 4', reps: '6 – 15', percent1RM: '55 – 70%', rest: '60 – 90 s', weeks: '~1 sem', freq: '2 – 3×/sem',
    objective: 'Acondicionamiento inicial. Prepara tendones y músculo para cargas mayores.' },
  { id: 'hipertrofia', label: 'Hipertrofia', phase: 'Dirigido', phaseColor: 'text-blue-300',
    series: '3 – 5', reps: '8 – 12', percent1RM: '70 – 82%', rest: '2 – 3 min', weeks: '3 – 8 sem', freq: '3 – 4×/sem',
    objective: 'Gran volumen, intensidad moderada. Incremento progresivo. Ritmo de ejecución rápido.' },
  { id: 'fmaxima', label: 'Fuerza Máxima', phase: 'Dirigido', phaseColor: 'text-blue-300',
    series: '3 – 6', reps: '1 – 6', percent1RM: '83 – 100%', rest: '3 – 5 min', weeks: '3 – 5 sem', freq: '3 – 4×/sem',
    objective: 'Factores nerviosos. Máxima velocidad de ejecución. Reduce déficit de fuerza.' },
  { id: 'potencia', label: 'F.Velocidad / Potencia', phase: 'Específico', phaseColor: 'text-emerald-300',
    series: '3 – 4', reps: '6 – 10', percent1RM: '78 – 88%', rest: '3 – 5 min', weeks: '3 – 5 sem', freq: '2 – 3×/sem',
    objective: 'Transferir F.Máxima → F.Explosiva. Alta velocidad ejecución + pliometría.' },
  { id: 'mantenimiento', label: 'Mantenimiento', phase: 'Competitivo', phaseColor: 'text-emerald-300',
    series: '3 – 4', reps: '4 – 8', percent1RM: '75 – 85%', rest: '2 – 4 min', weeks: 'Temporada', freq: '1 – 2×/sem',
    objective: 'Preservar potencia adquirida sin interferir con carga táctica y competitiva.' },
];

const BASKETBALL_TEST_BATTERY = [
  {
    name: 'Course Navette (Léger)', unit: 'palier', category: 'resistencia', icon: '🏃',
    audioUrl: 'https://www.youtube.com/watch?v=4oH_4_zPEjI',
    audioLabel: 'Audio oficial Course Navette (Léger 20m)',
    shortPurpose: 'Resistencia aeróbica general — cuánto aguantan al ritmo del partido',
    basketballValue: 'Determina si tus jugadores llegan al cuarto cuarto al mismo ritmo que al primero. Un equipo con buen Course Navette no pierde la marca por cansancio en los últimos minutos.',
    protocol: [
      'Marcar dos líneas paralelas a 20 m de distancia en la pista',
      'Reproducir el audio del Course Navette (usa el botón de audio en esta pantalla)',
      'Todos corren a la vez de línea a línea siguiendo el ritmo de los pitidos',
      'Cada vez que suena el pitido, el pie debe haber pisado o cruzado la línea',
      'Cuando un jugador no llega dos veces consecutivas, anota su palier actual y número de idas',
      'El último palier completo es la puntuación',
    ],
    playerBriefing: '"Corres de línea a línea al ritmo de los pitidos. El ritmo va subiendo cada minuto. Para cuando no llegues dos veces seguidas. Sin trampas — si no llegas, para."',
    scoring: { poor: '< 5', average: '5 – 7', good: '7 – 9', excellent: '> 9' },
    ref: 'Palier ≥ 8 recomendado', lowerIsBetter: false,
    improveTip: 'Continuo extensivo 30-45 min (3×/sem 6 semanas) + Interval corto 15-30s. Con 8 semanas de trabajo aeróbico se sube 1-2 paliers.',
  },
  {
    name: 'CMJ (Salto con Contramovimiento)', unit: 'cm', category: 'explosividad', icon: '⬆️',
    shortPurpose: 'Potencia explosiva de piernas — capacidad de salto real en partido',
    basketballValue: 'Es el salto que hacen en partido: rebote, tapón, entrada a canasta. Mide cuánta potencia transfieren del impulso hacia abajo al salto. Cuanto mayor, más centímetros por encima de su rival llegan al balón.',
    protocol: [
      'El jugador se coloca de pie, manos en caderas (o libres según protocolo)',
      'Flexiona las rodillas rápidamente y salta lo más alto posible',
      'El movimiento es continuo: bajar y subir sin pausa',
      'Medir con plataforma de salto, sensor de contacto o app de video (My Jump 2)',
      'Realizar 3 intentos con 1 min de recuperación entre ellos',
      'Anotar el mejor de los tres intentos',
    ],
    playerBriefing: '"Salta lo más alto que puedas. Dobla las rodillas rápido y explota hacia arriba. No hay pausa entre el bajón y el salto. 3 intentos, guardamos el mejor."',
    scoring: { poor: '< 30 cm', average: '30 – 38 cm', good: '38 – 45 cm', excellent: '> 45 cm' },
    ref: '> 40 cm buen nivel', lowerIsBetter: false,
    improveTip: 'Ciclo F.Máxima (6 sem) seguido de Potencia + Pliometría (4 sem). Multisaltos verticales 3×/sem. Mejoras de 3-6 cm por ciclo son habituales.',
  },
  {
    name: 'SJ (Squat Jump)', unit: 'cm', category: 'explosividad', icon: '🦵',
    shortPurpose: 'Fuerza concéntrica pura — motor sin efecto elástico',
    basketballValue: 'Mide solo la fuerza "pura" de las piernas, sin trampa elástica. Comparar CMJ - SJ da el índice de elasticidad: si la diferencia es > 5 cm, el jugador usa bien el ciclo estiramiento-acortamiento. Si es < 3 cm, hay margen de mejora en pliometría.',
    protocol: [
      'El jugador se coloca en posición de sentadilla (90° de flexión de rodilla), manos en caderas',
      'Mantiene 2-3 segundos en esa posición para anular el efecto elástico',
      'Salta lo más alto posible DESDE esa posición, sin contramovimiento previo',
      'Si se detecta cualquier movimiento descendente antes del salto, el intento no es válido',
      'Medir igual que CMJ (plataforma o app)',
      '3 intentos, mejor resultado',
    ],
    playerBriefing: '"Ponte en cuclillas (90 grados), cuenta tres, y salta. Nada de coger impulso bajando antes. Solo desde abajo hacia arriba. Si bajas primero, el intento no cuenta."',
    scoring: { poor: '< 25 cm', average: '25 – 33 cm', good: '33 – 40 cm', excellent: '> 40 cm' },
    ref: '> 35 cm buen nivel', lowerIsBetter: false,
    improveTip: 'Trabajo de fuerza máxima de piernas (½ squat, sentadilla profunda). El SJ mejora directamente con carga.',
  },
  {
    name: 'Drop Jump (DJ)', unit: 'cm', category: 'explosividad', icon: '📦',
    shortPurpose: 'Fuerza reactiva — respuesta explosiva a un aterrizaje',
    basketballValue: 'Simula los rebotes ofensivos: caes y explota hacia arriba inmediatamente. Un buen DJ significa que el jugador no "se hunde" en el suelo al aterrizar — rebota como una pelota. Se calcula el Índice de Reactividad (IR = altura / tiempo de contacto).',
    protocol: [
      'Colocar un banco o cajón a 30-40 cm de altura',
      'El jugador cae de pie desde el cajón (no salta — solo cae)',
      'Inmediatamente al tocar el suelo, salta lo más alto posible con el menor tiempo de contacto posible',
      'El objetivo es mínimo contacto en suelo + máxima altura',
      'Medir con plataforma de contacto o app que mida tiempo de contacto y altura',
      '3-5 intentos, anotar IR = altura(cm) / tiempo contacto(s)',
    ],
    playerBriefing: '"Cae del cajón y salta inmediatamente — como si el suelo quemara. Queremos contacto mínimo en el suelo. No necesitas saltar muy alto, necesitas hacerlo rápido."',
    scoring: { poor: 'IR < 1.5', average: 'IR 1.5 – 2.0', good: 'IR 2.0 – 2.5', excellent: 'IR > 2.5' },
    ref: 'IR > 2.0 óptimo', lowerIsBetter: false,
    improveTip: 'Pliometría: saltos sobre vallas, depth jumps, rebotes en cuerda. 4-5 series × 8-10 rep con 8-10 min descanso entre series.',
  },
  {
    name: 'Sprint 20m', unit: 's', category: 'velocidad', icon: '⚡',
    shortPurpose: 'Velocidad de aceleración — primeros pasos decisivos en pista',
    basketballValue: 'El 90% de los sprints en baloncesto son menores de 20m. Este test mide lo que pasa en la primera pasada, la recuperación defensiva, la transición rápida. Décimas de segundo aquí son metros de ventaja.',
    protocol: [
      'Marcar inicio y llegada a 20 metros, con fotocélulas o cronómetro manual (mejor fotocélulas)',
      'El jugador parte desde parado, posición libre (no bloqueada)',
      'Cronometrar desde el primer movimiento hasta cruzar los 20m',
      'Si es manual: dos personas controlan salida y llegada',
      '3 intentos con 3-5 min de recuperación completa entre ellos',
      'Anotar el mejor tiempo',
    ],
    playerBriefing: '"Corre lo más rápido que puedas desde aquí hasta allí. No empieces antes de tiempo. 3 intentos — deja 3 minutos entre cada uno para recuperar bien y dar el máximo."',
    scoring: { poor: '> 3.5 s', average: '3.1 – 3.5 s', good: '2.8 – 3.1 s', excellent: '< 2.8 s' },
    ref: '< 3.0 s buen nivel', lowerIsBetter: true,
    improveTip: 'Velocidad máxima (95-100%, 3-10s, 1-2 min rec.) + Fuerza explosiva de piernas. Mejora de 0.1-0.2 s por bloque de 6-8 semanas.',
  },
  {
    name: 'Test Mouche (28m × 12min)', unit: 'rep', category: 'resistencia', icon: '🔄',
    shortPurpose: 'Resistencia específica de baloncesto — aguantar sprints a lo largo del partido',
    basketballValue: 'Imita exactamente lo que pasa en un partido: ir y volver corriendo, una y otra vez, con las medidas reales de la pista (28m). Si un jugador hace pocas repeticiones, se cansa antes y su rendimiento cae en el segundo tiempo. El equipo con más resistencia gana los partidos ajustados.',
    protocol: [
      'Marcar los dos fondos de la pista (28 metros reales de canasta a canasta)',
      'Configurar un cronómetro visible para 12 minutos',
      'Al señal, el jugador corre de línea a línea sin parar durante 12 minutos',
      'Cada vez que toca o cruza una línea, cuenta como 1 repetición',
      'No se puede caminar — si para o camina, el test termina',
      'Anotar el total de repeticiones al finalizar los 12 minutos',
    ],
    playerBriefing: '"Tienes 12 minutos. Vas y vuelves de pared a pared. Cada vez que llegas, cuenta una. No puedes caminar — si paras, lo dejamos. Gestiona tu ritmo para aguantar los 12 minutos."',
    scoring: { poor: '< 16', average: '16 – 20', good: '20 – 24', excellent: '> 24' },
    ref: '> 22 rep buen nivel', lowerIsBetter: false,
    improveTip: 'Método interválico corto (30s trabajo / 30s descanso × 10-15 rep, 3 series). Es el test que más mejora con entrenamiento aeróbico específico.',
  },
  {
    name: 'Lanzamiento Balón Medicinal 3 kg', unit: 'm', category: 'fuerza', icon: '🏀',
    shortPurpose: 'Potencia de tren superior — fuerza de pase, entrada y contacto',
    basketballValue: 'Cuanta más potencia de tren superior, más fuerza en los pases largos, más resistencia al contacto en entrada a canasta y más potencia en el lanzamiento. Fundamental para pivots y aleros.',
    protocol: [
      'El jugador se sienta en el suelo con la espalda apoyada en la pared (o de pie sin apoyo)',
      'Sujeta el balón medicinal de 3 kg a la altura del pecho, codos hacia fuera',
      'Lanza el balón hacia adelante lo más lejos posible con las dos manos (tipo pase de pecho)',
      'No puede levantarse del sitio ni dar un paso antes de lanzar',
      'Medir la distancia desde la pared hasta el primer punto de impacto del balón',
      '3 intentos, mejor resultado',
    ],
    playerBriefing: '"Siéntate con la espalda en la pared. Balón en el pecho. Lánzalo lo más lejos que puedas con las dos manos como si fuera un pase. No te levantes del suelo."',
    scoring: { poor: '< 4.5 m', average: '4.5 – 6 m', good: '6 – 7.5 m', excellent: '> 7.5 m' },
    ref: '> 6 m nivel aceptable', lowerIsBetter: false,
    improveTip: 'Fuerza de tren superior (press banca, dominadas, fondos), trabajo de core y lanzamientos con balón medicinal.',
  },
  {
    name: '½ Squat 6 segundos (70% PC)', unit: 'rep', category: 'fuerza', icon: '🏋️',
    shortPurpose: 'Fuerza-velocidad de piernas — potencia explosiva sostenida',
    basketballValue: 'Mide qué tan rápido generan fuerza con las piernas en condiciones de fatiga parcial. Un jugador con buen ½ Squat 6s mantiene la explosividad en los saltos sucesivos dentro del mismo cuarto.',
    protocol: [
      'Colocar la barra a la altura de los hombros del jugador con carga = 70% de su peso corporal',
      'El jugador realiza medias sentadillas (90° máximo) tan rápido como sea posible durante 6 segundos exactos',
      'Contar cada repetición completa (abajo y arriba = 1 repetición)',
      'El tempo es máximo — se busca velocidad, no profundidad',
      '3 intentos con 5 min de recuperación entre ellos',
      'Anotar el mayor número de repeticiones en los 6 segundos',
    ],
    playerBriefing: '"Carga = 70% de tu peso. Medias sentadillas tan rápido como puedas durante 6 segundos. No te pares, máxima velocidad todo el rato. Vale con bajar a 90 grados."',
    scoring: { poor: '< 7 rep', average: '7 – 10 rep', good: '10 – 13 rep', excellent: '> 13 rep' },
    ref: '> 10 rep buen nivel', lowerIsBetter: false,
    improveTip: 'Fuerza máxima de piernas + trabajo de potencia con cargas altas y alta velocidad de ejecución.',
  },
  {
    name: '½ Squat 45 segundos (40% PC)', unit: 'rep', category: 'fuerza', icon: '⏱️',
    shortPurpose: 'Fuerza-resistencia de piernas — aguantar la intensidad a lo largo del partido',
    basketballValue: 'Mide si las piernas aguantan la intensidad sostenida. Un jugador con buen ½ Squat 45s no pierde potencia en los sprints del tercer y cuarto cuarto. Es la diferencia entre el jugador que "muere" a mitad del partido y el que mantiene el ritmo.',
    protocol: [
      'Carga = 40% del peso corporal del jugador (barra en hombros)',
      'Medias sentadillas (90° máximo) en modo continuo durante 45 segundos',
      'Ritmo alto pero sostenible — no es a muerte pero sí exigente',
      'Contar repeticiones completas durante los 45 segundos',
      '2-3 intentos con 8-10 min de recuperación',
      'Anotar el mejor resultado',
    ],
    playerBriefing: '"40% de tu peso, 45 segundos. Medias sentadillas continuas a buen ritmo. No pares. El objetivo es aguantar todo el tiempo con buena técnica."',
    scoring: { poor: '< 28 rep', average: '28 – 38 rep', good: '38 – 48 rep', excellent: '> 48 rep' },
    ref: '> 40 rep buen nivel', lowerIsBetter: false,
    improveTip: 'Ciclo de Resistencia de Fuerza (3-4×6-15, 55-70% 1RM, 3-4×/sem). Circuitos de sentadilla por tiempo.',
  },
  {
    name: 'TIVRE (Test Intermitente)', unit: 'nivel', category: 'resistencia', icon: '🔋',
    audioUrl: 'https://www.youtube.com/watch?v=evqvF9NEYXM',
    audioLabel: 'Audio oficial TIVRE (Test Intermitente 15-15)',
    shortPurpose: 'Potencia aeróbica específica — resistencia al esfuerzo intermitente real de partido',
    basketballValue: 'El más específico de los tests de resistencia para baloncesto. En un partido, no corres 12 minutos seguidos — corres, paras, corres, paras. El TIVRE mide exactamente esa capacidad: sprints cortos con recuperaciones parciales, igual que el juego real. Determina la VAM (Velocidad Aeróbica Máxima).',
    protocol: [
      'Marcar un circuito de 30m (o usar el protocolo específico del TIVRE que varía según versión)',
      'El test alterna esfuerzos de 15s a ritmo alto con recuperaciones activas de 15s a ritmo bajo',
      'Cada nivel incrementa la velocidad del esfuerzo en 0.5 km/h',
      'El jugador para cuando no puede mantener el ritmo del nivel actual',
      'Anotar el nivel alcanzado y calcular la VAM correspondiente',
      'Requiere audio del TIVRE o sistema de cronometraje preciso',
    ],
    playerBriefing: '"Es como el Course Navette pero con recuperaciones. 15 segundos fuerte, 15 segundos suave. El ritmo va subiendo. Para cuando no puedas más."',
    scoring: { poor: 'VAM < 13', average: 'VAM 13 – 15', good: 'VAM 15 – 17', excellent: 'VAM > 17' },
    ref: 'VAM > 16 km/h óptimo', lowerIsBetter: false,
    improveTip: 'Método interválico corto al 100-110% VAM (15s trabajo / 15s recuperación). Es el mejor método para mejorar la VAM en baloncesto.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING GOALS — Goal-based entry point for coaches
// ─────────────────────────────────────────────────────────────────────────────

const TRAINING_GOALS = [
  {
    id: 'explosivo', emoji: '💥', title: 'Más explosivos',
    subtitle: 'Saltar más alto · Primera pasada ganada · Mejor en 1vs1',
    description: 'Trabajar la explosividad significa que tus jugadores llegarán antes al balón en disputa, ganarán metros en la primera aceleración y saltarán por encima de sus rivales. Es la cualidad más determinante en el deporte moderno.',
    color: { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400', badge: 'bg-red-500/20' },
    zone: 'alactico', zoneName: 'Anaeróbico Aláctico (ATP-PC)',
    keyTests: ['CMJ (Salto con Contramovimiento)', 'SJ (Squat Jump)', 'Sprint 20m'],
    prescription: {
      frequency: '2-3 sesiones/semana de físico específico',
      duration: 'Bloque concentrado de 6-8 semanas',
      structure: [
        { time: '15 min', content: 'Calentamiento + activación neuromuscular (saltos pequeños, skipping, aceleraciones cortas)' },
        { time: '20 min', content: 'Pliometría: multisaltos verticales, depth jumps, saltos sobre vallas (3-4 series × 6-8 rep, 3 min descanso)' },
        { time: '20 min', content: 'Fuerza máxima: ½ squat o sentadilla con carga alta (3-5 series × 3-5 rep al 85-95%, 3-5 min descanso)' },
        { time: '10 min', content: 'Velocidad: sprints 10-15m máxima intensidad (4-6 rep × 2-3 series, 90s descanso)' },
        { time: '5 min', content: 'Vuelta a la calma + estiramientos' },
      ],
      keyPrinciple: 'Descanso COMPLETO entre series. La calidad de cada repetición es más importante que el volumen. Si el jugador no puede ejecutar a máxima velocidad, está demasiado cansado.',
      mistake: 'Error frecuente: hacer demasiadas repeticiones. Con explosividad menos es más — 4 series perfectas valen más que 8 mediocres.',
    },
  },
  {
    id: 'resistencia_sprint', emoji: '🔄', title: 'Aguantar más sprints',
    subtitle: 'Sin bajada de rendimiento en el 4º cuarto · Presión alta sostenida',
    description: 'El equipo que mantiene la intensidad en los últimos minutos gana los partidos igualados. Esto se entrena: la capacidad de repetir sprints a alta intensidad con recuperaciones parciales es una cualidad entrenable.',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20' },
    zone: 'lactico', zoneName: 'Anaeróbico Láctico + Aeróbico',
    keyTests: ['Test Mouche (28m × 12min)', 'TIVRE (Test Intermitente)', 'Course Navette (Léger)'],
    prescription: {
      frequency: '2-3 sesiones/semana de resistencia específica',
      duration: 'Bloque de 8-10 semanas (resultados a partir de la semana 4)',
      structure: [
        { time: '15 min', content: 'Calentamiento aeróbico progresivo (carrera continua suave)' },
        { time: '25 min', content: 'Series de contraataque: 6-8 rep de sprint 28m ida y vuelta, 45-60s descanso entre series. × 3 bloques con 3 min entre bloques.' },
        { time: '15 min', content: 'Interval corto al 90% VAM: 30s fuerte / 30s suave × 10-12 repeticiones' },
        { time: '10 min', content: 'Trote suave (eliminación de lactato activa)' },
        { time: '5 min', content: 'Estiramientos' },
      ],
      keyPrinciple: 'La recuperación entre series es fundamental. Demasiado descanso y no entrenas la resistencia lática; demasiado poco y no puedes ejecutar a la intensidad necesaria. Empieza con más descanso (1:4) e ir reduciéndolo semana a semana.',
      mistake: 'Error frecuente: hacer todo demasiado lento. Si el sprint no es al menos al 85% de la velocidad máxima, estás entrenando resistencia aeróbica, no resistencia al sprint.',
    },
  },
  {
    id: 'velocidad', emoji: '⚡', title: 'Más velocidad',
    subtitle: 'Ganar la primera pasada · Recuperación defensiva · Contraataque',
    description: 'La velocidad en baloncesto no es solo correr rápido — es reaccionar, acelerar en 2-3 pasos y llegar antes. Hay un período sensible de desarrollo pero se puede mejorar a cualquier edad con el entrenamiento correcto.',
    color: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', text: 'text-yellow-400', badge: 'bg-yellow-500/20' },
    zone: 'alactico', zoneName: 'Anaeróbico Aláctico (100% intensidad)',
    keyTests: ['Sprint 20m', 'CMJ (Salto con Contramovimiento)'],
    prescription: {
      frequency: '1-2 sesiones/semana de velocidad específica',
      duration: 'Integrar en toda la temporada; bloques específicos de 4-6 sem en pretemporada',
      structure: [
        { time: '20 min', content: 'Calentamiento completo: movilidad, drills de carrera (skipping, talones, laterales), 3-4 progresivos al 70-80-90%' },
        { time: '20 min', content: 'Velocidad pura: 4-6 sprints × 10-20m a máxima intensidad (100%), 90-120s descanso activo entre cada uno' },
        { time: '15 min', content: 'Velocidad con balón: salidas con pase, recepciones en carrera, 1vs1 con ventaja de posición' },
        { time: '5 min', content: 'Estiramientos y reflexión técnica' },
      ],
      keyPrinciple: 'La velocidad SOLO se mejora al 95-100% de intensidad. Si el jugador no va al máximo, no está entrenando velocidad. Y necesita recuperación COMPLETA entre repeticiones (1.5-2 min) para dar el 100% en cada una.',
      mistake: 'Error frecuente: entrenar velocidad cuando los jugadores están cansados (final de sesión). La velocidad va siempre AL PRINCIPIO de la sesión, con el sistema nervioso descansado.',
    },
  },
  {
    id: 'fuerza', emoji: '💪', title: 'Más fuertes',
    subtitle: 'Ganar contactos · Aguantar defensas físicas · Mejorar salto a largo plazo',
    description: 'La fuerza es la base de todo: la velocidad, la explosividad y la resistencia mejoran más si primero hay una buena base de fuerza. Un bloque concentrado de fuerza (6 sem) antes de la temporada tiene impacto durante toda la temporada.',
    color: { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400', badge: 'bg-purple-500/20' },
    zone: 'fuerza', zoneName: 'Neuromuscular (Fuerza/Potencia)',
    keyTests: ['½ Squat 6 segundos (70% PC)', '½ Squat 45 segundos (40% PC)', 'Lanzamiento Balón Medicinal 3 kg'],
    prescription: {
      frequency: '3-4 sesiones/semana de fuerza (bloque pretemporada)',
      duration: 'Bloque concentrado: 5-6 semanas antes de temporada + 1-2×/sem durante temporada',
      structure: [
        { time: '10 min', content: 'Calentamiento específico: movilidad articular, activación muscular (puentes de glúteo, sentadilla de peso corporal)' },
        { time: '25 min', content: 'Fuerza piernas: ½ squat o sentadilla (principal). Series y carga según fase (ver tabla de Fuerza). Máxima velocidad de ejecución.' },
        { time: '15 min', content: 'Fuerza brazos/core: press banca, remo, cargadas o ejercicios globales. 3-4 series.' },
        { time: '10 min', content: 'Ejercicios transferencia: lanzamientos de balón medicinal, saltos con carga ligera, pliometría mínima' },
        { time: '10 min', content: 'Estiramientos completos — OBLIGATORIOS después de sesión de fuerza' },
      ],
      keyPrinciple: 'Secuencia correcta de fases: Resistencia de Fuerza (1 sem) → Hipertrofia (3-4 sem) → Fuerza Máxima (3-4 sem) → Potencia (3-4 sem). No saltar fases. Durante competición: mantenimiento 1-2×/sem.',
      mistake: 'Error frecuente: trabajar fuerza y pliometría el mismo día de partido o el día anterior. Dejar mínimo 48h entre sesión de fuerza intensa y partido.',
    },
  },
  {
    id: 'aerobico', emoji: '🫁', title: 'Mejor fondo aeróbico',
    subtitle: 'Base para todo lo demás · Recuperación más rápida · Más minutos de rendimiento',
    description: 'El fondo aeróbico es la "batería" del jugador. Con buena base aeróbica, el jugador se recupera más rápido entre esfuerzos, aguanta más minutos sin bajar el rendimiento y tiene menor riesgo de lesión por fatiga.',
    color: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400', badge: 'bg-blue-500/20' },
    zone: 'aerobico', zoneName: 'Aeróbico (Sistema Oxidativo)',
    keyTests: ['Course Navette (Léger)', 'Test Mouche (28m × 12min)', 'TIVRE (Test Intermitente)'],
    prescription: {
      frequency: '2-3 sesiones aeróbicas/semana + trabajo técnico-táctico a ritmo elevado',
      duration: 'Base aeróbica: 6-8 semanas pretemporada. Mantener durante la temporada con 1-2 sesiones.',
      structure: [
        { time: '5 min', content: 'Calentamiento suave' },
        { time: '35 min', content: 'OPCIÓN A — Continuo extensivo: carrera continua a 65-75% de la FCmáx (puedes mantener una conversación). FC objetivo: 130-155 ppm.' },
        { time: '35 min', content: 'OPCIÓN B — Fartlek: carrera continua alternando 2 min suave / 1 min fuerte. Variedad de ritmos sin detenerse.' },
        { time: '5 min', content: 'Vuelta a la calma + estiramientos' },
      ],
      keyPrinciple: 'La FC nunca debe bajar de 110 ppm en el entrenamiento. Para el trabajo aeróbico extensivo, la zona óptima es 125-160 ppm. Más allá de 160 ppm de forma sostenida, estás entrenando la zona lática.',
      mistake: 'Error frecuente: confundir "correr" con "entrenar aeróbico". Un jugador que trota 20 min muy suave no está desarrollando su potencia aeróbica. Hay que llegar a 130-160 ppm y mantenerlos.',
    },
  },
  {
    id: 'recuperacion', emoji: '🔋', title: 'Mejor recuperación',
    subtitle: 'Aguantar partidos seguidos · Reducir lesiones por fatiga · Segundas partes mejores',
    description: 'La capacidad de recuperación es lo que permite jugar bien el jueves después de ganar el martes. Se trabaja mejorando la base aeróbica, controlando la carga semana a semana y siendo inteligente con los días de recuperación activa.',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20' },
    zone: 'mixto', zoneName: 'Aeróbico + Gestión de carga',
    keyTests: ['Course Navette (Léger)', 'TIVRE (Test Intermitente)'],
    prescription: {
      frequency: '1 sesión de recuperación activa/semana + monitorización de carga (RPE)',
      duration: 'Durante toda la temporada, especialmente en semanas de doble partido',
      structure: [
        { time: '30 min', content: 'SESIÓN DE RECUPERACIÓN ACTIVA: natación, bici estática o carrera muy suave (FC < 120 ppm). NO baloncesto. El objetivo es aumentar circulación sin generar fatiga nueva.' },
        { time: '15 min', content: 'Estiramientos estáticos profundos. PNF si hay fisioterapeuta. Foam roller.' },
        { time: 'Diario', content: 'Registro de Wellness (Hooper Index): fatiga, dolor muscular, calidad de sueño. Si ≥ 3 jugadores marcan alto → reducir carga de ese día.' },
      ],
      keyPrinciple: 'La ACWR (ratio carga aguda / carga crónica) debe estar entre 0.8 y 1.3. Por encima de 1.5 hay riesgo de lesión. El módulo de Salud de la app calcula esto automáticamente con los registros de RPE.',
      mistake: 'Error frecuente: creer que "descansar" es no hacer nada. La recuperación activa (movimiento suave) acelera la eliminación de lactato y reduce las agujetas más que el reposo total.',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER CATEGORIES — Age-appropriate training guide
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_CATEGORIES = [
  {
    id: 'minibasket', label: 'Mini / Alevín', ages: '8 – 11 años', icon: '🌱',
    color: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
    priority: 'Coordinación y hábito de movimiento',
    summary: 'Esta es la edad de ORO para la coordinación y el aprendizaje motor. No se trata de ganar partidos ni de hacer más fuertes a los jugadores — se trata de enseñarles a moverse bien, que el deporte sea divertido y crear el hábito. Lo que se aprende aquí dura para siempre.',
    canTrain: [
      { cap: 'Coordinación', note: '✅ Principal prioridad. Cuanta más variedad de movimientos, mejor.' },
      { cap: 'Velocidad de reacción y frecuencia', note: '✅ Período sensible desde los 7-8 años. Juegos de reacción, cambios de dirección.' },
      { cap: 'Flexibilidad', note: '✅ Cuanto antes, mejor. Incluir siempre en el calentamiento.' },
      { cap: 'Resistencia aeróbica general', note: '✅ Suave, mediante juegos. No carreras continuas largas.' },
      { cap: 'Fuerza rápida (PCC)', note: '⚠️ Puede introducirse con peso corporal desde los 10 años.' },
    ],
    cannotTrain: [
      { cap: 'Fuerza máxima con carga', note: '❌ Nunca. El sistema óseo no está preparado.' },
      { cap: 'Resistencia lática (series de alta intensidad)', note: '❌ Nunca. El sistema láctico no madura hasta los 12-14 años.' },
      { cap: 'Tests de carga (½ Squat, etc.)', note: '❌ Sin sentido a esta edad.' },
    ],
    sessionStructure: [
      { block: 'Calentamiento', time: '10 min', content: 'Juegos de persecución, movimientos libres, pilla-pilla con balón' },
      { block: 'Principal', time: '30-40 min', content: 'Técnica con balón, ejercicios de coordinación ojo-pie-mano, juegos reducidos' },
      { block: 'Físico', time: '10 min', content: 'Mini circuito de coordinación, saltos pequeños, cambios de dirección' },
      { block: 'Vuelta calma', time: '10 min', content: 'Juego tranquilo, estiramientos en forma de juego' },
    ],
    warning: 'No especialices demasiado pronto. Un mini que juega a otros deportes (fútbol, natación, atletismo) se convierte en mejor jugador de baloncesto a los 16 años que uno que solo hizo baloncesto desde los 8.',
  },
  {
    id: 'infantil', label: 'Infantil', ages: '12 – 13 años', icon: '🌿',
    color: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
    priority: 'Primer contacto con fuerza y resistencia aeróbica',
    summary: 'Edad de transición. Empiezan los cambios físicos y con ellos nuevas posibilidades de entrenamiento. Se puede empezar con trabajo de fuerza CON PESO CORPORAL y resistencia aeróbica más estructurada. Las chicas maduran antes — pueden introducir trabajo láctico desde los 12-13 años; los chicos deben esperar.',
    canTrain: [
      { cap: 'Coordinación avanzada', note: '✅ Seguir desarrollando con patrones más complejos.' },
      { cap: 'Velocidad de desplazamiento', note: '✅ Período sensible desde los 12 años.' },
      { cap: 'Fuerza rápida con peso corporal', note: '✅ Sentadillas, fondos, abdominales, saltos.' },
      { cap: 'Resistencia aeróbica', note: '✅ Course Navette, continuo extensivo hasta 20-25 min.' },
      { cap: 'Resistencia lática (chicas)', note: '⚠️ Con precaución desde los 12-13 años.' },
      { cap: 'Flexibilidad', note: '✅ Sigue siendo prioridad.' },
    ],
    cannotTrain: [
      { cap: 'Fuerza máxima con carga (barra)', note: '❌ Todavía no. Esperar a los 14-15 con desarrollo óseo adecuado.' },
      { cap: 'Resistencia lática intensa (chicos)', note: '❌ Esperar a los 14-16 años. Puede hacerse suave al final del período.' },
    ],
    sessionStructure: [
      { block: 'Calentamiento', time: '15 min', content: 'Movilidad, coordinación, 3-4 progresivos de velocidad' },
      { block: 'Técnico/Táctico', time: '30-35 min', content: 'Trabajo técnico con balón y situaciones de juego' },
      { block: 'Físico', time: '15 min', content: 'Circuito de peso corporal (3 rondas): saltos, fondos, abdominales, desplazamientos laterales' },
      { block: 'Vuelta calma', time: '10 min', content: 'Estiramientos estáticos, feedback del entrenamiento' },
    ],
    warning: 'Cuidado con los períodos de crecimiento acelerado (picos de altura). Durante el "estirón" el jugador puede perder coordinación temporalmente y tiene mayor riesgo de lesión de rodilla (Osgood-Schlatter). Reducir carga de impacto en esas fases.',
  },
  {
    id: 'cadete', label: 'Cadete', ages: '14 – 15 años', icon: '🌳',
    color: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
    priority: 'Inicio de trabajo de fuerza real + todas las capacidades',
    summary: 'El punto de inflexión. Con 14-15 años ya se puede entrenar prácticamente todo con las cargas adecuadas. Este es el momento de construir la base física que sostendrá el rendimiento los próximos años. Los chicos ya pueden trabajar la resistencia lática. Empieza el trabajo de fuerza con barra si el desarrollo físico lo permite.',
    canTrain: [
      { cap: 'Fuerza resistencia con barra', note: '✅ Base para el trabajo de fuerza. Comenzar con cargas bajas y técnica perfecta.' },
      { cap: 'Resistencia lática (chicos)', note: '✅ Desde los 14-16 años en varones.' },
      { cap: 'Velocidad avanzada', note: '✅ Sprint, reacción, velocidad gestual.' },
      { cap: 'Resistencia aeróbica estructurada', note: '✅ Course Navette, Test Mouche, interválico corto.' },
      { cap: 'Pliometría básica', note: '✅ Multisaltos, saltos sobre vallas de altura baja.' },
      { cap: 'Todos los tests de la batería', note: '✅ Primer año de evaluación sistemática.' },
    ],
    cannotTrain: [
      { cap: 'Fuerza máxima a alta intensidad (>85% 1RM)', note: '⚠️ Solo si el desarrollo físico está completo. Empezar con 60-70% y subir progresivamente.' },
    ],
    sessionStructure: [
      { block: 'Calentamiento', time: '15 min', content: 'Movilidad, activación, 3-4 aceleraciones progresivas' },
      { block: 'Técnico/Táctico', time: '35-40 min', content: 'Trabajo con balón, situaciones de partido' },
      { block: 'Físico', time: '20-25 min', content: 'Fuerza (2-3 ejercicios principales con barra/peso corporal) + 1 bloque de resistencia específica' },
      { block: 'Vuelta calma', time: '10 min', content: 'Estiramientos completos. Registro de carga (RPE).' },
    ],
    warning: 'Es la edad con mayor riesgo de sobreentrenamiento por el entusiasmo. Monitorizar el bienestar semana a semana. Si el jugador llega a la sesión con fatiga acumulada, reducir la carga ese día.',
  },
  {
    id: 'junior', label: 'Junior / Senior', ages: '16+ años', icon: '🏆',
    color: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25' },
    priority: 'Desarrollo completo + Periodización avanzada',
    summary: 'Todas las capacidades disponibles. La limitación ya no es biológica sino de tiempo y planificación. El objetivo es periodizar correctamente la temporada para que los jugadores estén en su máximo durante el tramo decisivo del campeonato. Se puede aplicar toda la metodología de entrenamiento de adultos.',
    canTrain: [
      { cap: 'Fuerza máxima completa (>85% 1RM)', note: '✅ Ciclos completos de Hipertrofia → F.Máxima → Potencia.' },
      { cap: 'Resistencia lática avanzada (series duras)', note: '✅ Series de alta intensidad, press alta prolongada.' },
      { cap: 'Pliometría avanzada (Drop Jump, cajones)', note: '✅ Máxima especificidad.' },
      { cap: 'Periodización compleja', note: '✅ Macrociclos, mesociclos, microciclos planificados.' },
      { cap: 'Todos los métodos y tests', note: '✅ Batería completa de evaluación.' },
    ],
    cannotTrain: [],
    sessionStructure: [
      { block: 'Calentamiento', time: '15-20 min', content: 'Movilidad, activación específica, 3-5 aceleraciones al 70-80-90-100%' },
      { block: 'Físico (si hay)', time: '25-30 min', content: 'Según planificación: fuerza, velocidad o resistencia. Al principio de sesión.' },
      { block: 'Técnico/Táctico', time: '40-50 min', content: 'Situaciones de partido, sistemas de juego' },
      { block: 'Vuelta calma', time: '10-15 min', content: 'Estiramientos, Wellness/RPE, análisis de sesión.' },
    ],
    warning: 'Con jugadores senior ya formados, lo más importante es la gestión de la fatiga acumulada. Un jugador sobreentrenado rinde menos que uno bien descansado. El descanso es parte del entrenamiento.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PLANS — Day-by-day structure per category + days/week
// ─────────────────────────────────────────────────────────────────────────────
const WEEKLY_PLANS: Record<string, Record<number, { day: string; focus: string; details: string; intensity: 'alta' | 'media' | 'baja' | 'libre' }[]>> = {
  minibasket: {
    2: [
      { day: 'Día 1 — Lunes/Martes', focus: 'Coordinación + Habilidades básicas', intensity: 'media', details: 'Calentamiento con juegos de reacción (8 min). Circuito de coordinación: bote, pase, recepción con variaciones. Juego reducido libre. Vuelta a la calma con estiramientos dinámicos.' },
      { day: 'Día 2 — Jueves/Viernes', focus: 'Velocidad de reacción + Juego', intensity: 'media', details: 'Activación con juegos de persecución (10 min). Trabajo de cambios de dirección con balón. Partido mini (4vs4). Reflexión grupal corta + estiramiento.' },
    ],
    3: [
      { day: 'Día 1', focus: 'Coordinación multidireccional', intensity: 'media', details: 'Calentamiento activo con juegos (8 min). Escaleras de agilidad / conos. Juegos de coordinación ojo-mano. Relajación con música.' },
      { day: 'Día 2', focus: 'Habilidades técnicas básicas', intensity: 'media', details: 'Activación (10 min). Trabajo de bote, pase y tiro sin presión. Ejercicios de 2vs0 y 3vs0. Partido corto.' },
      { day: 'Día 3', focus: 'Juego libre + resistencia aeróbica suave', intensity: 'baja', details: 'Calentamiento suave (10 min). Partido de juego libre guiado por el entrenador. Carrera continua suave (5 min). Estiramientos en grupo.' },
    ],
    4: [
      { day: 'Día 1', focus: 'Coordinación + Frecuencia de movimiento', intensity: 'media', details: 'Circuito de pliometría básica (saltos simples, skipping). Juegos de reacción y persecución. Práctica de bote.' },
      { day: 'Día 2', focus: 'Técnica individual', intensity: 'media', details: 'Parada en 1 y 2 tiempos. Tiro estático y en movimiento. Juego 1vs1 guiado.' },
      { day: 'Día 3', focus: 'Resistencia aeróbica + coordinación', intensity: 'baja', details: 'Carrera continua suave (8-10 min). Juegos de relevos. Flexibilidad dinámica.' },
      { day: 'Día 4', focus: 'Juego colectivo', intensity: 'media', details: 'Partido 4vs4 / 5vs5 adaptado. Situaciones de 2vs1 y 3vs2. Reflexión grupal.' },
    ],
  },
  infantil: {
    2: [
      { day: 'Día 1', focus: 'Velocidad + Técnica individual', intensity: 'media', details: 'Activación dinámica (10 min). Sprints cortos 10-15m con variantes. Trabajo técnico (bote presión, tiro en carrera). Partido 4vs4.' },
      { day: 'Día 2', focus: 'Resistencia aeróbica + Colectivo', intensity: 'media', details: 'Calentamiento activo. Circuito de resistencia aeróbica (series cortas). Situaciones colectivas 3vs3 y 4vs4. Estiramientos.' },
    ],
    3: [
      { day: 'Día 1', focus: 'Velocidad + Agilidad', intensity: 'alta', details: 'Calentamiento (10 min). 4-6 sprints de 15-20m con pausa completa. Ejercicios de agilidad con cambio de dirección y balón. Técnica individual sin fatiga.' },
      { day: 'Día 2', focus: 'Resistencia aeróbica + Táctica', intensity: 'media', details: 'Activación. Circuito aeróbico interválico (30s trabajo/30s pausa). Situaciones 3vs3 y 4vs4. Introducción a conceptos tácticos.' },
      { day: 'Día 3', focus: 'Partido + Recuperación activa', intensity: 'baja', details: 'Calentamiento suave. Partido con normas modificadas. Trote suave 5 min. Estiramientos globales.' },
    ],
    4: [
      { day: 'Día 1', focus: 'Velocidad y arranques', intensity: 'alta', details: 'Calentamiento 10 min. 5-6 sprints con salida distintas posiciones. Cambios de dirección con señal. Tiro en movimiento.' },
      { day: 'Día 2', focus: 'Fuerza general (peso corporal)', intensity: 'alta', details: 'Activación. Circuito: sentadillas, flexiones, zancadas, plancha. Trabajo de core básico. Técnica individual.' },
      { day: 'Día 3', focus: 'Resistencia + Táctica', intensity: 'media', details: 'Series aeróbicas interválicas. Situaciones 3vs3 guiadas. Colectivo ataque-defensa.' },
      { day: 'Día 4', focus: 'Partido + Trabajo explosivo', intensity: 'media', details: 'Activación pliométrica (saltos verticales). Partido 5vs5 supervisado. Reflexión táctica.' },
    ],
  },
  cadete: {
    2: [
      { day: 'Día 1', focus: 'Fuerza funcional + Explosividad', intensity: 'alta', details: 'Calentamiento potenciador (8 min). Circuito de fuerza: sentadilla, peso muerto, press. Saltos reactivos. Técnica sin fatiga.' },
      { day: 'Día 2', focus: 'Resistencia específica + Colectivo', intensity: 'alta', details: 'Activación. Series interválicas (15s/15s al 100-110% VAM). Situaciones 3vs3 / 4vs4 con fatiga acumulada. Partido.' },
    ],
    3: [
      { day: 'Día 1', focus: 'Fuerza máxima y potencia', intensity: 'alta', details: 'Calentamiento 10 min. Sentadilla 3x5 (70-80% 1RM) + salto inmediato (contraste). Press de banca / dominadas. Core estabilizador.' },
      { day: 'Día 2', focus: 'Resistencia específica basketball', intensity: 'alta', details: 'Activación. Interválico 15s/15s (4-5 series x 5 min). RSA (Sprint 6x30m descanso 30s). Situaciones 4vs4.' },
      { day: 'Día 3', focus: 'Técnica + Colectivo + Partido', intensity: 'media', details: 'Trabajo técnico específico (20 min). Colectivo 5vs5 guiado. Partido real o simulado. Reflexión.' },
    ],
    4: [
      { day: 'Día 1 — Fuerza', focus: 'Fuerza máxima', intensity: 'alta', details: 'Calentamiento potenciador. Sentadilla, peso muerto, press. 3-4 series de 4-6 reps al 80-85% 1RM. Core.' },
      { day: 'Día 2 — Cardio', focus: 'Resistencia interválica', intensity: 'alta', details: 'Interválico 15/15 al 100-110% VAM. RSA 6x30m. Situaciones con fatiga.' },
      { day: 'Día 3 — Potencia', focus: 'Explosividad + Velocidad', intensity: 'alta', details: 'Sprints 5x20m. Saltos reactivos (drop jump, CMJ). Contraste fuerza-salto.' },
      { day: 'Día 4 — Colectivo', focus: 'Partido + Recuperación activa', intensity: 'media', details: 'Partido 5vs5. Trote suave. Estiramientos. Reflexión táctica breve.' },
    ],
    5: [
      { day: 'Día 1 — Fuerza', focus: 'Fuerza máxima', intensity: 'alta', details: 'Sentadilla + Press. 4 series 4-6 reps 80-85% 1RM.' },
      { day: 'Día 2 — Velocidad', focus: 'Sprints + Agilidad', intensity: 'alta', details: 'Sprints 10-20-30m. Cambios de dirección (T-test, Illinois). Pliometría reactiva.' },
      { day: 'Día 3 — Resistencia', focus: 'Interválico intenso', intensity: 'alta', details: '15/15 al 110% VAM. RSA. Situaciones con carga de juego.' },
      { day: 'Día 4 — Potencia + Colectivo', focus: 'Contraste + Táctica', intensity: 'media', details: 'Contraste fuerza-salto. 5vs5 guiado. Correcciones tácticas.' },
      { day: 'Día 5 — Partido + Recuperación', focus: 'Competición simulada', intensity: 'baja', details: 'Partido completo. Trote regenerativo. Estiramientos profundos.' },
    ],
  },
  junior: {
    2: [
      { day: 'Día 1', focus: 'Fuerza + Potencia', intensity: 'alta', details: 'Bloque fuerza máxima (sentadilla, press, dominadas). Saltos de contraste. Técnica individual de calidad.' },
      { day: 'Día 2', focus: 'Resistencia específica + Colectivo', intensity: 'alta', details: 'Interválico específico. RSA. Partido o situaciones complejas 4vs4 / 5vs5.' },
    ],
    3: [
      { day: 'Día 1', focus: 'Fuerza máxima', intensity: 'alta', details: 'Sentadilla 4x4 (85% 1RM). Peso muerto 3x5. Press banca. Rotadores de cadera / core.' },
      { day: 'Día 2', focus: 'Potencia + Velocidad', intensity: 'alta', details: 'Sprints 5x20m. Pliometría (drop jump 40cm, CMJ). RSA 6x30m. Contraste fuerza-explosividad.' },
      { day: 'Día 3', focus: 'Resistencia específica + Partido', intensity: 'media', details: '15/15 al 110% VAM. Partido 5vs5. Análisis táctico y corrección.' },
    ],
    4: [
      { day: 'Día 1', focus: 'Fuerza máxima', intensity: 'alta', details: 'Bloque pesado: sentadilla, peso muerto, press. 4-5 series 3-5 reps.' },
      { day: 'Día 2', focus: 'Potencia + Pliometría', intensity: 'alta', details: 'Saltos reactivos. Contraste. Sprints cortos máximos.' },
      { day: 'Día 3', focus: 'Resistencia específica', intensity: 'alta', details: 'Interválico 15/15. RSA. Situaciones con fatiga real.' },
      { day: 'Día 4', focus: 'Colectivo + Competición simulada', intensity: 'media', details: 'Partido real o simulado. Gestión de fatiga acumulada. Estiramientos profundos.' },
    ],
    5: [
      { day: 'Día 1', focus: 'Fuerza máxima', intensity: 'alta', details: 'Sentadilla + Press. 4-5 series 3-5 reps 85-90% 1RM.' },
      { day: 'Día 2', focus: 'Potencia explosiva', intensity: 'alta', details: 'Pliometría avanzada. Contraste. Sprints 10-20m.' },
      { day: 'Día 3', focus: 'Resistencia interválica', intensity: 'alta', details: '15/15 al 110% VAM. RSA. Situaciones bajo fatiga.' },
      { day: 'Día 4', focus: 'Técnico-táctico', intensity: 'media', details: '5vs5 guiado. Sistemas de juego. Gestión de errores.' },
      { day: 'Día 5', focus: 'Partido + Recuperación', intensity: 'baja', details: 'Competición o simulacro. Trote regenerativo + estiramientos profundos.' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INJURY PREVENTION — Evidence-based protocols for basketball
// ─────────────────────────────────────────────────────────────────────────────
const INJURY_PREVENTION = [
  {
    id: 'tobillo',
    area: 'Tobillo',
    icon: '🦶',
    risk: 'Muy alto',
    riskColor: 'text-red-400',
    prevalence: '25-45% de todas las lesiones en baloncesto',
    mechanism: 'Inversión forzada durante saltos y cambios de dirección. Los pivots y escoltas son los más expuestos.',
    methods: [
      { name: 'Propiocepción en plato inestable', dose: '3x30s por pie · 3 días/semana', effect: 'Reduce recidivas hasta un 50% en jugadores con historial de esguinces', phase: 'Calentamiento / Post-sesión' },
      { name: 'Fortalecimiento peroneos (banda elástica)', dose: '3x15 reps · Eversión-inversión controlada', effect: 'Mejora la estabilidad lateral activa del tobillo', phase: 'Post-sesión' },
      { name: 'Saltos a 1 pie con aterrizaje controlado', dose: '3x8 por pie', effect: 'Entrena la amortiguación y el control motor en el aterrizaje', phase: 'Bloque físico' },
    ],
    tip: 'El vendaje funcional o el strapping reduce el riesgo en un 50% pero NO sustituye el entrenamiento propioceptivo. Usa ambos.',
  },
  {
    id: 'rodilla',
    area: 'Rodilla (LCA + Rotuliano)',
    icon: '🦵',
    risk: 'Alto',
    riskColor: 'text-emerald-400',
    prevalence: '15-20% de las lesiones. El LCA es la lesión más temida por su impacto en la carrera.',
    mechanism: 'Valgo dinámico de rodilla (rodilla hacia dentro) en aterrizajes y cambios de dirección. Mayor riesgo en chicas jóvenes.',
    methods: [
      { name: 'Programa FIFA 11+ Basketball / PEP Protocol', dose: '15-20 min · Antes de cada sesión · Todo el año', effect: 'Reduce lesiones de LCA hasta un 62% en deportes de equipo', phase: 'Calentamiento OBLIGATORIO' },
      { name: 'Nórdicos de isquiotibiales', dose: '3x6-8 reps con progresión semanal', effect: 'El ejercicio con mayor evidencia para prevenir lesiones musculares del tren inferior', phase: 'Bloque físico' },
      { name: 'Sentadilla monopodal (pistol squat)', dose: '3x8 por pierna · Controlado y lento', effect: 'Detecta y corrige asimetrías. Fortalece glúteo medio y vasto medial', phase: 'Fuerza' },
      { name: 'Aterrizajes con retroalimentación visual (espejo/vídeo)', dose: '10 min · 2 veces/semana', effect: 'El feedback visual corrige el valgo de rodilla en aterrizajes', phase: 'Técnico' },
    ],
    tip: 'Analiza siempre los aterrizajes en saltos. Si ves rodillas hacia dentro, PARA y corrige. Es más importante que el ejercicio en sí.',
  },
  {
    id: 'espalda',
    area: 'Zona lumbar',
    icon: '🏋️',
    risk: 'Medio',
    riskColor: 'text-yellow-400',
    prevalence: '10-15% de los jugadores en categoría cadete-junior-senior. Mayor incidencia en períodos de carga alta.',
    mechanism: 'Debilidad del core, fatiga muscular acumulada y sobrecarga de extensión lumbar (tiro, salto, sprints repetidos).',
    methods: [
      { name: 'Plancha frontal + lateral', dose: '3x30-45s · Sin compensaciones', effect: 'Base de la estabilidad lumbo-pélvica. Reduce la presión discal en movimientos explosivos', phase: 'Core / Post-sesión' },
      { name: 'Dead bug', dose: '3x10 por lado · Lento y controlado', effect: 'Activa el transverso abdominal sin sobrecargar la columna. Ideal para prevención', phase: 'Core' },
      { name: 'Bird dog', dose: '3x10 por lado', effect: 'Estabilidad lumbar con disociación cadera-columna. Muy efectivo en jóvenes', phase: 'Core' },
      { name: 'Hip hinge (bisagra de cadera)', dose: '3x10 · Enseñar el patrón motor correcto', effect: 'Corrige la tendencia a flexionar la columna en lugar de la cadera. Clave para el peso muerto y los saltos', phase: 'Técnico / Fuerza' },
    ],
    tip: 'Dedica 10 minutos al core al final de CADA sesión física. Es el trabajo de prevención con mayor retorno a largo plazo.',
  },
  {
    id: 'hombro',
    area: 'Hombro y manguito rotador',
    icon: '💪',
    risk: 'Medio',
    riskColor: 'text-yellow-400',
    prevalence: '8-12%. Más frecuente en lanzadores frecuentes (bases, escoltas) y jugadores con mucho volumen de tiro.',
    mechanism: 'Desequilibrio entre rotadores internos (potentes) y rotadores externos (débiles). El tiro desarrolla la musculatura anterior pero descompensa la posterior.',
    methods: [
      { name: 'Rotación externa con banda (Thrower\'s Ten)', dose: '3x15 reps · A velocidad media · Diario', effect: 'El protocolo más validado para equilibrar la musculatura del hombro en deportes de lanzamiento', phase: 'Pre/Post sesión' },
      { name: 'Face pull con banda elástica', dose: '3x15-20 reps', effect: 'Activa deltoides posterior y manguito rotador externo. Corrige la postura de hombros hacia adelante', phase: 'Post-sesión' },
      { name: 'Sleeping stretch (estiramiento cápsula posterior)', dose: '3x30s por brazo', effect: 'Aumenta la rotación interna y reduce la tensión posterior del hombro', phase: 'Vuelta a la calma' },
    ],
    tip: 'Cada 10 minutos de tiro = 1 set de rotación externa. Si tus jugadores tiran mucho, trabaja preventivamente el hombro posterior.',
  },
  {
    id: 'sobrecarga',
    area: 'Gestión de la carga (overtraining)',
    icon: '📊',
    risk: 'Transversal',
    riskColor: 'text-purple-400',
    prevalence: 'No es una lesión, es la causa raíz del 60-70% de las lesiones en temporada.',
    mechanism: 'La carga aguda supera la capacidad de recuperación del jugador. Se produce cuando la relación carga-aguda/carga-crónica (ACWR) > 1.5.',
    methods: [
      { name: 'Ratio Carga Aguda:Crónica (ACWR) ≤ 1.3', dose: 'Monitorización semanal del RPE x duración', effect: 'Zona verde: 0.8-1.3. Zona roja: >1.5. El umbral exacto donde el riesgo de lesión se dispara', phase: 'Planificación' },
      { name: 'Regla del 10%', dose: 'No aumentar la carga semanal más del 10% respecto a la semana anterior', effect: 'Permite una adaptación gradual del tejido conectivo (tendones, ligamentos) que va más lento que el músculo', phase: 'Planificación' },
      { name: 'Sesiones de recuperación activa', dose: '1-2 sesiones/semana de baja intensidad (RPE 3-4)', effect: 'Mejoran la recuperación sin añadir fatiga. Son tan importantes como los días duros', phase: 'Semanal' },
      { name: 'Wellness matutino (calidad sueño, fatiga, dolor muscular)', dose: 'Encuesta de 1 min antes del entrenamiento', effect: 'El mejor predictor de lesión inminente. Si el jugador reporta 3/5 o menos, reduce la carga ese día', phase: 'Diario (módulo Wellness)' },
    ],
    tip: 'La lesión más fácil de tratar es la que no ocurre. Los 10 minutos de prevención que haces HOY son los 3 meses de baja que no tendrás en febrero.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
const TrainingScheduleManager = ({
  schedules, onAdd, onDelete, onGenerate, onClose, showToast
}: {
  schedules: TrainingSchedule[];
  onAdd: (s: Partial<TrainingSchedule>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGenerate: (dateFrom: string, dateTo: string) => Promise<void>;
  onClose: () => void;
  showToast: (t: ToastType, m: string) => void;
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const in8weeks = new Date(); in8weeks.setDate(in8weeks.getDate() + 56);
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: '18:00', endTime: '20:00', sessionType: 'TRAINING', title: '' });
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(in8weeks.toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const TYPE_LABELS: Record<string, string> = { TRAINING: 'Entrenamiento', PHYSICAL: 'Físico', MATCH: 'Partido', OTHER: 'Otro' };

  // Count how many sessions would be generated
  const estimatedCount = useMemo(() => {
    if (!dateFrom || !dateTo || schedules.filter(s => s.active).length === 0) return 0;
    const from = new Date(dateFrom); const to = new Date(dateTo);
    let count = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      count += schedules.filter(s => s.active && s.dayOfWeek === d.getDay()).length;
    }
    return count;
  }, [dateFrom, dateTo, schedules]);

  const handleAdd = async () => {
    setSaving(true);
    try { await onAdd(form); showToast('success', 'Franja añadida'); }
    catch (err: any) { showToast('error', 'Error: ' + (err?.message || 'Verifica que hayas ejecutado el SQL de training_schedules en Supabase')); }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (schedules.filter(s => s.active).length === 0) { showToast('warning', 'Añade al menos una franja primero'); return; }
    if (!dateFrom || !dateTo || dateFrom > dateTo) { showToast('warning', 'Selecciona un rango de fechas válido'); return; }
    setGenerating(true);
    try {
      await onGenerate(dateFrom, dateTo);
      onClose();
    }
    catch (err: any) { showToast('error', 'Error al generar: ' + (err?.message || err)); }
    finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-700 rounded-[28px] w-full max-w-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center mb-5">
          <h2 className="font-black text-white flex items-center gap-2">
            <Calendar size={18} className="text-emerald-500" /> Horarios de Entrenamiento
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* Existing slots */}
        <div className="space-y-2 mb-5 max-h-44 overflow-y-auto">
          {schedules.filter(s => s.active).length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-2xl">
              No hay horarios configurados
            </div>
          ) : schedules.filter(s => s.active).sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(s => (
            <div key={s.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <Timer size={13} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{DAY_NAMES[s.dayOfWeek]} · {s.startTime}–{s.endTime}</p>
                  <p className="text-[10px] text-slate-500">{s.title || TYPE_LABELS[s.sessionType] || s.sessionType}</p>
                </div>
              </div>
              <button onClick={() => onDelete(s.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><X size={14} /></button>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 mb-5">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Nueva franja horaria</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest">Día</label>
              <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50">
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest">Tipo</label>
              <select value={form.sessionType} onChange={e => setForm({ ...form, sessionType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50">
                <option value="TRAINING">Entrenamiento</option>
                <option value="PHYSICAL">Físico</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest">Hora inicio</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest">Hora fin</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50" />
            </div>
          </div>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Título opcional (ej: Táctica ofensiva)"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-slate-600" />
          <button onClick={handleAdd} disabled={saving}
            className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : '+ Añadir Franja'}
          </button>
        </div>

        {/* Generate */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-white mb-0.5">Generar Sesiones en Rango</p>
            <p className="text-[10px] text-slate-500">Crea sesiones automáticamente entre dos fechas según el horario definido</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50" />
            </div>
          </div>
          {estimatedCount > 0 && (
            <p className="text-[10px] text-emerald-400 font-bold">
              Se generarán aproximadamente <strong>{estimatedCount}</strong> sesiones
            </p>
          )}
          <button onClick={handleGenerate} disabled={generating || estimatedCount === 0}
            className="w-full bg-emerald-500 text-slate-950 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {generating
              ? <><Loader2 size={14} className="animate-spin" /> Generando...</>
              : <><Zap size={14} /> Generar {estimatedCount > 0 ? estimatedCount + ' sesiones' : 'sesiones'}</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS VIEW — Calendar (Día / Semana / Mes)
// ─────────────────────────────────────────────────────────────────────────────
const SessionsView = ({
  sessions, onAddSession, onDeleteSession, onUpdateSession, subjects, teamId, onQuickAttendance,
  isAdding, setIsAdding, attendanceRecords, loadRecords, showToast,
  trainingSchedules, onAddSchedule, onDeleteSchedule, onGenerateSessions,
  initialSession, onSessionOpened,
}: {
  sessions: Session[];
  onAddSession: (s: Partial<Session>) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onUpdateSession: (id: string, data: Partial<Session>) => Promise<void>;
  subjects: Subject[];
  teamId?: string;
  onQuickAttendance: (a: Record<string, string>) => Promise<void>;
  isAdding: boolean;
  setIsAdding: (v: boolean) => void;
  attendanceRecords: AttendanceRecord[];
  loadRecords: LoadRecord[];
  showToast: (t: ToastType, m: string) => void;
  trainingSchedules: TrainingSchedule[];
  onAddSchedule: (s: Partial<TrainingSchedule>) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onGenerateSessions: (dateFrom: string, dateTo: string) => Promise<void>;
  initialSession?: Session | null;
  onSessionOpened?: () => void;
}) => {
  type ViewMode = 'week' | 'month' | 'day';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedSession, setSelectedSession] = useState<Session | null>(initialSession || null);
  const [selectedSessionTab, setSelectedSessionTab] = useState<'anotaciones' | 'plan' | 'lista' | 'material'>('anotaciones');
  const [showAttendance, setShowAttendance] = useState(false);
  const [showScheduleManager, setShowScheduleManager] = useState(false);
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', type: 'TRAINING', notes: '', durationMins: 90, zone: '', phase: '' });
  const [saving, setSaving] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState({ title: '', date: '', startTime: '', type: 'TRAINING', notes: '', durationMins: 90, zone: '', phase: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Si viene de la vista Hoy con una sesión preseleccionada, abrirla en pestaña "lista"
  useEffect(() => {
    if (initialSession) {
      setSelectedSession(initialSession);
      setSelectedSessionTab('lista');
      onSessionOpened?.();
    }
  }, [initialSession]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const getMonday = (d: Date) => {
    const date = new Date(d); date.setHours(0,0,0,0);
    const dow = date.getDay();
    date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
    return date;
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    else if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const sessionsByDate = useMemo(() =>
    sessions.reduce((acc, s) => {
      const key = (s.date as string).split('T')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {} as Record<string, Session[]>),
  [sessions]);

  const tc = stc;

  const periodLabel = useMemo(() => {
    if (viewMode === 'week') {
      const mon = getMonday(currentDate);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
    }
    if (viewMode === 'month') return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [viewMode, currentDate]);

  const isCurrentPeriod = useMemo(() => {
    if (viewMode === 'week') return getMonday(currentDate).getTime() === getMonday(today).getTime();
    if (viewMode === 'month') return currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    return currentDate.toDateString() === today.toDateString();
  }, [viewMode, currentDate, today]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const combinedDate = form.startTime && form.startTime !== '00:00'
        ? `${form.date}T${form.startTime}:00` : form.date;
      const notesWithMeta = encodeSessionNotes(form.notes, '', form.zone, form.phase);
      await onAddSession({ ...form, date: combinedDate, notes: notesWithMeta });
      setIsAdding(false);
      setForm({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', type: 'TRAINING', notes: '', durationMins: 90, zone: '', phase: '' });
      showToast('success', 'Sesión creada');
    } catch { showToast('error', 'Error al crear sesión'); }
    finally { setSaving(false); }
  };

  const openEdit = (s: Session) => {
    setEditingSession(s);
    const dateStr = s.date as string;
    const parsed = parseSessionNotes(s.notes || '');
    setEditForm({ title: s.title || '', date: dateStr.split('T')[0], startTime: extractTime(dateStr), type: s.type, notes: parsed.annotations, durationMins: s.durationMins || 90, zone: parsed.zone, phase: parsed.phase });
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    setSavingEdit(true);
    try {
      const combinedDate = editForm.startTime && editForm.startTime !== '00:00'
        ? `${editForm.date}T${editForm.startTime}:00` : editForm.date;
      // Preserve material from original notes when editing
      const { material: existingMaterial } = parseSessionNotes(editingSession.notes || '');
      const notesWithMeta = encodeSessionNotes(editForm.notes, existingMaterial, editForm.zone, editForm.phase);
      await onUpdateSession(editingSession.id, { ...editForm, date: combinedDate, notes: notesWithMeta });
      setEditingSession(null);
      showToast('success', 'Sesión actualizada');
    } catch { showToast('error', 'Error al actualizar la sesión'); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Borrar esta sesión? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      await onDeleteSession(id);
      showToast('success', 'Sesión eliminada');
    } catch { showToast('error', 'Error al eliminar la sesión'); }
    finally { setDeletingId(null); }
  };

  const handleDuplicate = async (session: Session) => {
    setDuplicatingId(session.id);
    try {
      await onAddSession({
        title: `${session.title || 'Sesión'} (copia)`,
        date: new Date().toISOString().split('T')[0],
        type: session.type,
        notes: session.notes,
        durationMins: session.durationMins,
      });
      showToast('success', `Sesión duplicada para hoy`);
    } catch { showToast('error', 'Error al duplicar la sesión'); }
    finally { setDuplicatingId(null); }
  };

  // ── Week view ──────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const mon = getMonday(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
    const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return (
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const key = day.toISOString().split('T')[0];
          const daySessions = sessionsByDate[key] || [];
          const isToday = day.toDateString() === today.toDateString();
          const isPast = day < today && !isToday;

          return (
            <div key={i}
              className={cn('min-h-[180px] rounded-2xl border p-2 flex flex-col cursor-pointer transition-all group',
                isToday ? 'bg-emerald-500/5 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                  : isPast ? 'bg-slate-900/40 border-slate-800/50 opacity-70'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-600'
              )}
              onClick={() => { setCurrentDate(day); setViewMode('day'); }}>
              {/* Day header */}
              <div className="flex flex-col items-center pb-2 mb-2 border-b border-slate-800">
                <span className={cn('text-[9px] font-bold uppercase tracking-widest', isToday ? 'text-emerald-400' : 'text-slate-600')}>{DAY_SHORT[i]}</span>
                <span className={cn('text-base font-black', isToday ? 'text-emerald-400' : isPast ? 'text-slate-600' : 'text-white')}>{day.getDate()}</span>
                {isToday && <div className="w-1 h-1 bg-emerald-500 rounded-full mt-0.5" />}
              </div>
              {/* Sessions */}
              <div className="space-y-1 flex-1">
                {daySessions.map(s => {
                  const sAtt = attendanceRecords.filter(a => a.sessionId === s.id);
                  const sLoad = loadRecords.filter(l => l.sessionId === s.id && (l.sessionLoad || 0) > 0);
                  const sDot = sAtt.length > 0 && sLoad.length > 0 ? 'bg-emerald-400'
                    : sAtt.length > 0 || sLoad.length > 0 ? 'bg-yellow-400' : 'bg-slate-600';
                  return (
                  <div key={s.id}
                    className={cn('px-2 py-1.5 rounded-lg border text-[9px] font-bold leading-tight transition-all group/chip', tc(s.type).bg, tc(s.type).text, tc(s.type).border)}>
                    <div className="flex items-center gap-1">
                      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', sDot)} />
                      <div className="truncate flex-1">{s.title || tc(s.type).label}</div>
                    </div>
                    <div className="opacity-60 mt-0.5">{s.durationMins}′</div>
                    {/* Mini actions on hover */}
                    <div className="flex gap-1 mt-1 opacity-0 group-hover/chip:opacity-100 transition-all">
                      <button onClick={e => { e.stopPropagation(); setPlanningSession(s); }}
                        className="flex-1 bg-slate-900/60 rounded px-1 py-0.5 text-[7px] font-black uppercase hover:text-emerald-400 transition-colors">
                        Plan
                      </button>
                      <button onClick={e => { e.stopPropagation(); setSelectedSessionTab('lista'); setSelectedSession(s); }}
                        className="flex-1 bg-slate-900/60 rounded px-1 py-0.5 text-[7px] font-black uppercase hover:text-emerald-400 transition-colors">
                        Lista
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
              {/* Add hint */}
              {!isPast && daySessions.length === 0 && (
                <button onClick={e => { e.stopPropagation(); setForm({ ...form, date: key }); setIsAdding(true); }}
                  className="mt-auto pt-1 text-[9px] text-slate-700 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all text-center uppercase tracking-widest">
                  + Añadir
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Month view ─────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = new Date(firstDay);
    const dow = firstDay.getDay();
    startDay.setDate(firstDay.getDate() - (dow === 0 ? 6 : dow - 1));
    const DAY_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const weeks: Date[][] = [];
    const cur = new Date(startDay);
    while (cur <= lastDay || weeks.length < 4) {
      if (weeks.length >= 6) break;
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      weeks.push(week);
    }

    return (
      <div>
        <div className="grid grid-cols-7 mb-2">
          {DAY_HEADER.map(d => <div key={d} className="text-center text-[9px] font-bold text-slate-600 uppercase tracking-widest py-2">{d}</div>)}
        </div>
        <div className="space-y-1.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {week.map((day, di) => {
                const key = day.toISOString().split('T')[0];
                const daySessions = sessionsByDate[key] || [];
                const isToday = day.toDateString() === today.toDateString();
                const inMonth = day.getMonth() === month;
                return (
                  <div key={di}
                    onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                    className={cn('min-h-[88px] rounded-xl border p-1.5 cursor-pointer transition-all flex flex-col',
                      isToday ? 'bg-emerald-500/8 border-emerald-500/35'
                        : inMonth ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950 border-slate-900 opacity-40'
                    )}>
                    <span className={cn('text-[10px] font-bold block mb-1', isToday ? 'text-emerald-400' : inMonth ? 'text-white' : 'text-slate-600')}>{day.getDate()}</span>
                    <div className="flex flex-col gap-0.5 flex-1">
                      {daySessions.slice(0, 3).map(s => (
                        <div key={s.id}
                          onClick={e => { e.stopPropagation(); setPlanningSession(s); }}
                          className={cn('px-1 py-0.5 rounded text-[7px] font-bold truncate border cursor-pointer', tc(s.type).bg.split(' ')[0], tc(s.type).text, tc(s.type).border)}
                          title={s.title || tc(s.type).label}>
                          {s.title || tc(s.type).label}
                        </div>
                      ))}
                      {daySessions.length > 3 && <span className="text-[7px] text-slate-600 mt-0.5">+{daySessions.length - 3} más</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Day view ───────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const key = currentDate.toISOString().split('T')[0];
    const daySessions = (sessionsByDate[key] || []).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const isToday = currentDate.toDateString() === today.toDateString();

    return (
      <div className="space-y-3">
        {daySessions.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-[24px]">
            <Timer className="mx-auto text-slate-700 mb-3" size={32} />
            <p className="text-slate-600 text-sm mb-3">{isToday ? 'No hay sesiones hoy' : 'Sin sesiones este día'}</p>
            <button onClick={() => { setForm({ ...form, date: key }); setIsAdding(true); }}
              className="text-xs text-emerald-500 font-bold hover:underline uppercase tracking-widest">
              + Crear sesión →
            </button>
          </div>
        ) : daySessions.map(session => {
          const att = attendanceRecords.filter(a => a.sessionId === session.id);
          const present = att.filter(a => a.status === 'present').length;
          const loads = loadRecords.filter(l => l.sessionId === session.id && (l.sessionLoad || 0) > 0);
          const avgLoad = loads.length ? Math.round(loads.reduce((a, l) => a + (l.sessionLoad || 0), 0) / loads.length) : null;
          const col = tc(session.type);
          // Badge de estado de la sesión
          const sessionStatus = att.length === 0 && loads.length === 0 ? 'pending'
            : att.length > 0 && loads.length > 0 ? 'done' : 'partial';
          const statusBadge = {
            pending: { label: 'Pendiente', cls: 'bg-slate-800 text-slate-500 border-slate-700' },
            partial: { label: 'Parcial',   cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
            done:    { label: '✓ Cerrada', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
          }[sessionStatus];
          return (
            <div key={session.id} className={cn('bg-slate-900 border rounded-[20px] p-5 cursor-pointer hover:border-slate-500 transition-colors', col.border)} onClick={() => { setSelectedSessionTab('anotaciones'); setSelectedSession(session); }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md border inline-block', col.bg.split(' ')[0], col.text, col.border)}>{col.label}</span>
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-md border', statusBadge.cls)}>{statusBadge.label}</span>
                  </div>
                  <h4 className="font-black text-white text-base">{session.title || 'Sesión sin título'}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">{session.durationMins} min</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {present > 0 && <span className="text-[9px] text-slate-500 font-bold mr-2">{present} presentes</span>}
                  {avgLoad !== null && <span className="text-[9px] text-slate-500 font-bold mr-2">{avgLoad} AU</span>}
                  <button onClick={e => { e.stopPropagation(); openEdit(session); }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Editar sesión">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDuplicate(session); }} disabled={duplicatingId === session.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-40" title="Duplicar a hoy">
                    {duplicatingId === session.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(session.id); }} disabled={deletingId === session.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40" title="Borrar sesión">
                    {deletingId === session.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
              {session.notes && <p className="text-xs text-slate-500 mb-4 leading-relaxed border-t border-slate-800 pt-3">{session.notes}</p>}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setSelectedSessionTab('plan'); setSelectedSession(session); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-bold text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase">
                  <BookOpen size={11} /> Plan
                </button>
                <button onClick={() => setSelectedSession(session)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all uppercase">
                  <Check size={11} /> Lista / RPE
                </button>
              </div>
            </div>
          );
        })}
        {daySessions.length > 0 && (
          <button onClick={() => { setForm({ ...form, date: key }); setIsAdding(true); }}
            className="w-full py-3 border-2 border-dashed border-slate-800 rounded-[20px] text-slate-600 hover:text-emerald-400 hover:border-emerald-500/30 text-xs font-bold uppercase tracking-widest transition-all">
            + Nueva sesión este día
          </button>
        )}
      </div>
    );
  };

  // ── Overrides ──────────────────────────────────────────────────────────────
  if (selectedSession) return (
    <SessionWorkspaceView
      session={selectedSession}
      initialTab={selectedSessionTab}
      subjects={subjects}
      teamId={teamId}
      onBack={() => { setSelectedSession(null); setSelectedSessionTab('anotaciones'); }}
      onUpdateSession={onUpdateSession}
      showToast={showToast}
    />
  );

  if (showAttendance) return (
    <div>
      <button onClick={() => setShowAttendance(false)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
        <ChevronLeft size={16} /> Volver al calendario
      </button>
      <AttendanceTool subjects={subjects} onCancel={() => setShowAttendance(false)}
        onSave={async (att) => { await onQuickAttendance(att); setShowAttendance(false); showToast('success', 'Lista pasada y sesión creada'); }}
        teamId={teamId} />
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View toggle */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-0.5">
          {(['week', 'month', 'day'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all',
                viewMode === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-white'
              )}>
              {m === 'week' ? 'Semana' : m === 'month' ? 'Mes' : 'Día'}
            </button>
          ))}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAttendance(true)}
            className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-500/20 transition-all">
            <Check size={12} /> Lista Rápida
          </button>
          <button onClick={() => setShowScheduleManager(true)}
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-700 transition-all">
            <Settings size={12} /> Horarios
          </button>
          <button onClick={() => { setForm({ ...form, date: currentDate.toISOString().split('T')[0] }); setIsAdding(true); }}
            className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-500/20 transition-all">
            <Plus size={12} /> Nueva
          </button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => navigate(1)} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all">
            <ChevronRight size={15} />
          </button>
          <AnimatePresence>
            {!isCurrentPeriod && (
              <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                onClick={goToday}
                className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-400 font-bold uppercase hover:bg-emerald-500/20 transition-all">
                Hoy
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <h3 className="text-sm font-bold text-white capitalize text-center">{periodLabel}</h3>
        <div className="w-24 flex justify-end">
          {sessions.length > 0 && (
            <span className="text-[9px] text-slate-600 font-mono">{sessions.length} sesiones</span>
          )}
        </div>
      </div>

      {/* Edit session modal */}
      <AnimatePresence>
        {editingSession && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 border border-blue-500/25 rounded-[24px] p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-white flex items-center gap-2"><Edit2 size={16} className="text-blue-400" /> Editar Sesión</h3>
              <button onClick={() => setEditingSession(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Título</label>
                <input type="text" value={editForm.title} placeholder="Entrenamiento táctico..."
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fecha</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Hora de inicio</label>
                <input type="time" value={editForm.startTime} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tipo</label>
                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50">
                  <option value="TRAINING">Entrenamiento</option>
                  <option value="MATCH">Partido</option>
                  <option value="PHYSICAL">Físico</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Duración (min)</label>
                <input type="number" value={editForm.durationMins} min={5} max={300}
                  onChange={e => setEditForm({ ...editForm, durationMins: parseInt(e.target.value) || 90 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Zona metabólica</label>
                <select value={editForm.zone} onChange={e => setEditForm({ ...editForm, zone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50">
                  <option value="">Sin especificar</option>
                  {METABOLIC_ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fase temporada</label>
                <select value={editForm.phase} onChange={e => setEditForm({ ...editForm, phase: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50">
                  <option value="">Sin especificar</option>
                  {PERIODIZATION_PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Notas</label>
                <textarea value={editForm.notes} rows={2} placeholder="Notas de la sesión..."
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 bg-blue-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {savingEdit ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : <><Save size={13} /> Guardar cambios</>}
              </button>
              <button onClick={() => setEditingSession(null)} className="px-6 bg-slate-800 border border-slate-700 text-white py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-700 transition-all">
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New session form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 border border-emerald-500/25 rounded-[24px] p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-white">Nueva Sesión</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                { label: 'Título', field: 'title', type: 'text', placeholder: 'Entrenamiento táctico...', el: 'input' },
                { label: 'Fecha', field: 'date', type: 'date', placeholder: '', el: 'input' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
                  <input type={type} value={(form as any)[field]} placeholder={placeholder}
                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Hora de inicio</label>
                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="TRAINING">Entrenamiento</option>
                  <option value="MATCH">Partido</option>
                  <option value="PHYSICAL">Físico</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Duración (min)</label>
                <input type="number" value={form.durationMins} onChange={e => setForm({ ...form, durationMins: parseInt(e.target.value) || 90 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Zona metabólica</label>
                <select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="">Sin especificar</option>
                  {METABOLIC_ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fase temporada</label>
                <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="">Sin especificar</option>
                  {PERIODIZATION_PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5 mb-5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Notas</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                placeholder="Objetivos, indicaciones..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-emerald-500/50" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} disabled={saving}
                className="flex-1 bg-emerald-500 text-slate-950 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Crear Sesión'}
              </button>
              <button onClick={() => setIsAdding(false)} className="px-8 bg-slate-800 border border-slate-700 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-700 transition-all">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar */}
      {viewMode === 'week'  && renderWeekView()}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'day'   && renderDayView()}

      {/* Schedule manager modal */}
      {showScheduleManager && (
        <TrainingScheduleManager
          schedules={trainingSchedules}
          onAdd={onAddSchedule}
          onDelete={onDeleteSchedule}
          onGenerate={onGenerateSessions}
          onClose={() => setShowScheduleManager(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSION WORKSPACE VIEW — Vista unificada con pestañas de navegador
// ─────────────────────────────────────────────────────────────────────────────

const SessionWorkspaceView = ({
  session, initialTab, subjects, teamId, onBack, onUpdateSession, showToast
}: {
  session: Session; initialTab: 'anotaciones' | 'plan' | 'lista' | 'material';
  subjects: Subject[]; teamId?: string;
  onBack: () => void;
  onUpdateSession: (id: string, data: Partial<Session>) => Promise<void>;
  showToast: (t: ToastType, m: string) => void;
}) => {
  type WTab = 'anotaciones' | 'plan' | 'lista' | 'material';
  const [activeTab, setActiveTab] = useState<WTab>(initialTab);
  const { annotations: initA, material: initM, zone: initZone, phase: initPhase } = parseSessionNotes(session.notes || '');
  const [annotations, setAnnotations] = useState(initA);
  const [material, setMaterial] = useState(initM);
  const [savingNotes, setSavingNotes] = useState(false);

  // zone/phase are read-only in workspace (edit via session form)
  const zoneInfo = METABOLIC_ZONES.find(z => z.id === initZone);
  const phaseInfo = PERIODIZATION_PHASES.find(p => p.id === initPhase);

  const saveContent = async () => {
    setSavingNotes(true);
    try {
      await onUpdateSession(session.id, { notes: encodeSessionNotes(annotations, material, initZone, initPhase) });
      showToast('success', activeTab === 'material' ? 'Material guardado' : 'Anotaciones guardadas');
    } catch { showToast('error', 'Error al guardar'); }
    finally { setSavingNotes(false); }
  };

  const col = stc(session.type);
  const startTime = extractTime(session.date as string);

  const TABS: { id: WTab; label: string }[] = [
    { id: 'anotaciones', label: '📝 Anotaciones' },
    { id: 'plan',        label: '📋 Plan' },
    { id: 'lista',       label: '✓ Lista / RPE' },
    { id: 'material',    label: '🧰 Material' },
  ];

  return (
    <div className="space-y-4">
      {/* Back + session info */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-1">
        <ChevronLeft size={16} /> Volver al calendario
      </button>
      <div className="bg-slate-900 border border-slate-800 rounded-[20px] px-6 py-4 flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-black text-white leading-tight">{session.title || 'Sesión sin título'}</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5 capitalize">
            {new Date(session.date as string).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            {startTime && <span className="text-emerald-400 font-bold"> · {startTime}</span>}
            {` · ${session.durationMins} min`}
          </p>
          {(zoneInfo || phaseInfo) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {zoneInfo && (
                <span className={cn('text-[8px] font-black px-2 py-1 rounded-lg border uppercase', zoneInfo.color.badge, zoneInfo.color.border)}>
                  ⚡ {zoneInfo.short}
                </span>
              )}
              {phaseInfo && (
                <span className={cn('text-[8px] font-black px-2 py-1 rounded-lg border uppercase bg-slate-800/60 border-slate-700/50', phaseInfo.color)}>
                  📅 Fase {phaseInfo.label}
                </span>
              )}
            </div>
          )}
        </div>
        <span className={cn('text-[9px] font-black px-3 py-1.5 rounded-xl uppercase border', col.bg.split(' ')[0], col.text, col.border)}>
          {col.label}
        </span>
      </div>

      {/* Browser-style tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('flex-1 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap',
              activeTab === t.id ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-slate-800')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {activeTab === 'anotaciones' && (
            <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-white flex items-center gap-2">
                  <FileText size={16} className="text-emerald-500" /> Anotaciones del entrenador
                </h3>
                <span className="text-[9px] text-slate-600 font-mono">{annotations.length} car.</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ausencias previstas, conceptos a trabajar, mensajes al grupo, observaciones del último entrenamiento...
              </p>
              <textarea
                value={annotations} onChange={e => setAnnotations(e.target.value)}
                rows={9}
                placeholder={"Ej: No viene Carlos (lesión). Trabajar defensa de zona 2-3.\nIntroducir bloqueo directo en ataque estático.\nGrupo cansado — reducir intensidad del físico..."}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-emerald-500/50 resize-none font-mono leading-relaxed placeholder:text-slate-700"
              />
              <button onClick={saveContent} disabled={savingNotes}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                {savingNotes ? <><Loader2 size={12} className="animate-spin" /> Guardando...</> : <><Save size={12} /> Guardar anotaciones</>}
              </button>
            </div>
          )}

          {activeTab === 'plan' && (
            <SessionPlanTool session={session} subjects={subjects} onClose={() => setActiveTab('anotaciones')} showToast={showToast} />
          )}

          {activeTab === 'lista' && (
            <SessionDetailTool session={session} subjects={subjects} onBack={() => setActiveTab('anotaciones')} teamId={teamId} showToast={showToast} />
          )}

          {activeTab === 'material' && (
            <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 space-y-4">
              <h3 className="font-black text-white flex items-center gap-2">
                <Dumbbell size={16} className="text-emerald-500" /> Material necesario
              </h3>
              <p className="text-xs text-slate-500">Un ítem por línea. Puedes indicar cantidad, color o referencia.</p>
              <textarea
                value={material} onChange={e => setMaterial(e.target.value)}
                rows={8}
                placeholder={"Ej:\n10 balones de baloncesto\n4 conos (azules)\n2 petos por equipo (rojo y azul)\nPizarra táctica\nCronómetro"}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-emerald-500/50 resize-none font-mono leading-relaxed placeholder:text-slate-700"
              />
              {/* Formatted list preview */}
              {material.trim() && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Vista previa — lista de material</p>
                  {material.split('\n').filter(l => l.trim()).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-800/40 last:border-0">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[9px] font-black text-emerald-500 shrink-0">{i + 1}</div>
                      <span className="text-sm text-white">{item.trim()}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={saveContent} disabled={savingNotes}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                {savingNotes ? <><Loader2 size={12} className="animate-spin" /> Guardando...</> : <><Save size={12} /> Guardar material</>}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSION DETAIL TOOL  (Asistencia + RPE por jugador)
// ─────────────────────────────────────────────────────────────────────────────

const SessionDetailTool = ({
  session, subjects, onBack, teamId, showToast
}: {
  session: Session; subjects: Subject[]; onBack: () => void; teamId?: string; showToast: (t: ToastType, m: string) => void;
}) => {
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [borgScale, setBorgScale] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured || !session.id) { setLoading(false); return; }
      try {
        const [attRes, loadRes] = await Promise.all([
          supabase.from('attendance').select('subject_id, status').eq('session_id', session.id),
          supabase.from('load_records').select('subject_id, borg_scale').eq('session_id', session.id),
        ]);
        if (attRes.data?.length) { const m: Record<string,string> = {}; attRes.data.forEach(r => m[r.subject_id] = r.status); setAttendance(m); setHasExisting(true); }
        if (loadRes.data?.length) { const m: Record<string,number> = {}; loadRes.data.forEach(r => m[r.subject_id] = r.borg_scale); setBorgScale(m); setHasExisting(true); }
      } catch { /* silent */ } finally { setLoading(false); }
    };
    load();
  }, [session.id]);

  const handleSave = async () => {
    if (!isSupabaseConfigured) { showToast('warning', 'Modo local: datos no persistidos en BD'); onBack(); return; }
    setSaving(true);
    try {
      const attInserts = Object.entries(attendance).map(([sid, status]) => ({ team_id: teamId, session_id: session.id, subject_id: sid, status }));
      if (attInserts.length) await supabase.from('attendance').upsert(attInserts, { onConflict: 'session_id,subject_id' });

      const borgInserts = Object.entries(borgScale).map(([sid, v]) => ({
        team_id: teamId, session_id: session.id, subject_id: sid,
        borg_scale: v, duration_mins: session.durationMins || 90,
        session_load: v * (session.durationMins || 90),
      }));
      if (borgInserts.length) await supabase.from('load_records').upsert(borgInserts, { onConflict: 'session_id,subject_id' });

      showToast('success', hasExisting ? 'Sesión actualizada correctamente' : 'Asistencia y carga registradas');
      onBack();
    } catch (err: any) { showToast('error', 'Error al guardar: ' + err.message); }
    finally { setSaving(false); }
  };

  const players = subjects.filter(s => s.role === Role.PLAYER);
  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const teamAvgBorg = Object.values(borgScale).length ? (Object.values(borgScale).reduce((a, b) => a + b, 0) / Object.values(borgScale).length).toFixed(1) : '—';

  const statusLabels = [
    { key: 'present', label: 'P', full: 'Presente', color: 'bg-emerald-500 text-white border-emerald-500' },
    { key: 'absent', label: 'A', full: 'Ausente', color: 'bg-red-500 text-white border-red-500' },
    { key: 'late', label: 'T', full: 'Tarde', color: 'bg-yellow-500 text-slate-950 border-yellow-500' },
    { key: 'excused', label: 'J', full: 'Justificado', color: 'bg-blue-500 text-white border-blue-500' },
  ];

  const getBorgLabel = (v: number) => {
    if (v === 0) return '—'; if (v <= 3) return 'Suave'; if (v <= 5) return 'Moderado';
    if (v <= 7) return 'Duro'; if (v <= 9) return 'Muy duro'; return 'Máximo';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl relative">
      {loading && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-[28px]">
          <Loader2 className="text-emerald-500 animate-spin" size={32} />
        </div>
      )}
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest mb-1">Pasar Lista + RPE</p>
            <h3 className="text-xl font-black text-white tracking-tight">{session.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{new Date(session.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} • {session.durationMins} min</p>
          </div>
          <div className="flex gap-4 text-center">
            <div><p className="text-[8px] text-slate-600 uppercase mb-1">Presentes</p><p className="text-lg font-black text-white">{presentCount}</p></div>
            <div><p className="text-[8px] text-slate-600 uppercase mb-1">RPE Medio</p><p className="text-lg font-black text-emerald-400">{teamAvgBorg}</p></div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 pt-4 flex gap-3 flex-wrap">
        {statusLabels.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
            <span className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black border", s.color)}>{s.label}</span>
            {s.full}
          </div>
        ))}
      </div>

      {/* Players */}
      <div className="p-6 space-y-3">
        {players.map(player => (
          <div key={player.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Name */}
              <div className="flex items-center gap-3 min-w-[160px]">
                <span className="text-[10px] font-mono text-slate-600 w-8">#{player.number}</span>
                <span className="text-sm font-bold text-white">{player.name} {player.lastName || ''}</span>
              </div>
              {/* Status buttons */}
              <div className="flex gap-1.5">
                {statusLabels.map(s => (
                  <button key={s.key} onClick={() => setAttendance(prev => ({ ...prev, [player.id]: s.key }))}
                    className={cn("w-8 h-8 rounded-lg text-[10px] font-black border transition-all",
                      attendance[player.id] === s.key ? s.color : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600")}>
                    {s.label}
                  </button>
                ))}
              </div>
              {/* RPE slider */}
              <div className="flex items-center gap-3 flex-1">
                <span className="text-[9px] text-slate-600 uppercase font-bold whitespace-nowrap">RPE Borg</span>
                <input type="range" min={0} max={10} step={1} value={borgScale[player.id] || 0}
                  onChange={e => setBorgScale(prev => ({ ...prev, [player.id]: parseInt(e.target.value) }))}
                  className="flex-1 accent-emerald-500" />
                <div className="flex flex-col items-center w-14">
                  <span className="text-base font-black text-emerald-500 leading-none">{borgScale[player.id] || 0}</span>
                  <span className="text-[8px] text-slate-600 mt-0.5">{getBorgLabel(borgScale[player.id] || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-slate-800 flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-emerald-500 text-slate-950 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-500/20">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : hasExisting ? <><Save size={14} /> Actualizar Sesión</> : <><Check size={14} /> Finalizar Sesión</>}
        </button>
        <button onClick={onBack} className="px-8 bg-slate-800 text-white py-4 rounded-xl text-[10px] font-bold uppercase border border-slate-700 hover:bg-slate-700 transition-all">Cancelar</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE TOOL  (Lista rápida sin sesión previa)
// ─────────────────────────────────────────────────────────────────────────────

const AttendanceTool = ({
  subjects, onCancel, onSave, teamId
}: {
  subjects: Subject[]; onCancel: () => void; onSave: (a: Record<string, string>) => Promise<void>; teamId?: string;
}) => {
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const players = subjects.filter(s => s.role === Role.PLAYER);

  // Auto-mark all as present
  const markAll = (status: string) => {
    const all: Record<string, string> = {};
    players.forEach(p => all[p.id] = status);
    setAttendance(all);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(attendance); }
    catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const statusLabels = [
    { key: 'present', label: 'P', full: 'Presente', color: 'bg-emerald-500 text-white border-emerald-500' },
    { key: 'absent', label: 'A', full: 'Ausente', color: 'bg-red-500 text-white border-red-500' },
    { key: 'late', label: 'T', full: 'Tarde', color: 'bg-yellow-500 text-slate-950 border-yellow-500' },
    { key: 'excused', label: 'J', full: 'Justificado', color: 'bg-blue-500 text-white border-blue-500' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest mb-1">Asistencia Rápida</p>
          <h3 className="text-xl font-black text-white tracking-tight">Pasar Lista</h3>
          <p className="text-xs text-slate-500 mt-1">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} • {presentCount} presentes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => markAll('present')} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[9px] font-bold uppercase hover:bg-emerald-500/20 transition-all">Todos P</button>
          <button onClick={() => markAll('absent')} className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-[9px] font-bold uppercase hover:bg-slate-700 transition-all">Limpiar</button>
        </div>
      </div>

      <div className="p-6 space-y-2">
        {players.map(player => (
          <div key={player.id} className="flex items-center justify-between px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-600 w-8">#{player.number}</span>
              <span className="text-sm font-bold text-white">{player.name} {player.lastName || ''}</span>
              <span className="text-[9px] text-slate-600">{player.position}</span>
            </div>
            <div className="flex gap-1.5">
              {statusLabels.map(s => (
                <button key={s.key} onClick={() => setAttendance(prev => ({ ...prev, [player.id]: s.key }))}
                  className={cn("w-8 h-8 rounded-lg text-[10px] font-black border transition-all",
                    attendance[player.id] === s.key ? s.color : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-slate-800 flex gap-3">
        <button onClick={handleSave} disabled={saving || Object.keys(attendance).length === 0}
          className="flex-1 bg-emerald-500 text-slate-950 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-500/20">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar Asistencia</>}
        </button>
        <button onClick={onCancel} className="px-8 bg-slate-800 text-white py-4 rounded-xl text-[10px] font-bold uppercase border border-slate-700 hover:bg-slate-700 transition-all">Cancelar</button>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// GROUP READINESS BANNER
// ─────────────────────────────────────────────────────────────────────────────

const GroupReadinessBanner = ({
  subjects, wellnessReports, loadRecords, sessions
}: {
  subjects: Subject[]; wellnessReports: WellnessReport[];
  loadRecords: LoadRecord[]; sessions: Session[];
}) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const players = subjects.filter(s => s.role === Role.PLAYER);

  // Team wellness today (if no today, use yesterday)
  const todayWellness = wellnessReports.filter(w => w.date === today);
  const refWellness = todayWellness.length ? todayWellness : wellnessReports.filter(w => w.date === yesterday);

  const teamAvgWellness = refWellness.length
    ? refWellness.reduce((acc, w) => acc + (w.fatigue + w.sleepQuality + w.muscleSoreness + w.stressLevel + w.mood) / 5, 0) / refWellness.length
    : null;

  // Yesterday's team load
  const yesterdaySessions = sessions.filter(s => s.date?.toString().startsWith(yesterday));
  const yesterdayIds = new Set(yesterdaySessions.map(s => s.id));
  const yesterdayLoads = loadRecords.filter(l => yesterdayIds.has(l.sessionId));
  const teamAvgLoad = yesterdayLoads.length
    ? yesterdayLoads.reduce((acc, l) => acc + (l.sessionLoad || 0), 0) / yesterdayLoads.length
    : null;

  if (!teamAvgWellness && !teamAvgLoad) return null;

  let status: 'green' | 'yellow' | 'red' = 'green';
  let message = 'Equipo en condiciones óptimas para entrenar.';
  let icon = '🟢';
  if (teamAvgWellness !== null && teamAvgWellness >= 3.2) { status = 'red'; message = 'Fatiga colectiva elevada. Considera reducir intensidad hoy.'; icon = '🔴'; }
  else if (teamAvgWellness !== null && teamAvgWellness >= 2.5) { status = 'yellow'; message = 'Fatiga moderada en el grupo. Monitorizar individualmente.'; icon = '🟡'; }
  else if (teamAvgLoad !== null && teamAvgLoad > 750) { status = 'yellow'; message = 'Carga alta ayer. Valorar recuperación activa hoy.'; icon = '🟡'; }

  const bannerStyle = status === 'red'
    ? 'bg-red-500/10 border-red-500/30 text-red-300'
    : status === 'yellow'
    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';

  return (
    <div className={cn("border rounded-2xl px-5 py-3.5 flex items-center gap-3 text-sm font-medium mb-6", bannerStyle)}>
      <span className="text-base">{icon}</span>
      <div className="flex-1">
        <span className="font-bold">Estado del grupo: </span>{message}
      </div>
      {teamAvgWellness !== null && (
        <span className="text-xs font-mono opacity-70">Wellness: {teamAvgWellness.toFixed(1)}/5</span>
      )}
      {teamAvgLoad !== null && (
        <span className="text-xs font-mono opacity-70 ml-3">Carga ayer: {Math.round(teamAvgLoad)} AU</span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────────────────

// ── Dashboard widget config ──────────────────────────────────────────────────
const DASH_WIDGETS = [
  { id: 'banner',       label: 'Banner disponibilidad grupal' },
  { id: 'kpi',          label: 'Tarjetas KPI' },
  { id: 'chart',        label: 'Gráfico carga & wellness' },
  { id: 'availability', label: 'Disponibilidad del equipo' },
  { id: 'sessions',     label: 'Últimas sesiones' },
];
type WidgetCfg = { id: string; visible: boolean };
const getDashCfg = (coachId: string): WidgetCfg[] => {
  try { const s = localStorage.getItem(`ck_dash_${coachId}`); if (s) return JSON.parse(s); } catch {}
  return DASH_WIDGETS.map(w => ({ id: w.id, visible: true }));
};
const saveDashCfg = (coachId: string, cfg: WidgetCfg[]) =>
  localStorage.setItem(`ck_dash_${coachId}`, JSON.stringify(cfg));

// ─────────────────────────────────────────────────────────────────────────────
// TODAY VIEW  — pantalla de entrada: sesión del día, alertas y resumen
// ─────────────────────────────────────────────────────────────────────────────

const TodayView = ({
  subjects, incidents, matches, sessions, loadRecords, wellnessReports,
  attendanceRecords, onNavigate, onOpenSession,
}: {
  subjects: Subject[]; incidents: HealthIncident[]; matches: Match[];
  sessions: Session[]; loadRecords: LoadRecord[]; wellnessReports: WellnessReport[];
  attendanceRecords: AttendanceRecord[];
  onNavigate: (tab: string) => void;
  onOpenSession: (session: Session) => void;
}) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const players = subjects.filter(s => s.role === Role.PLAYER);

  // Sesión de hoy (puede haber más de una)
  const todaySessions = sessions.filter(s => s.date?.toString().startsWith(today))
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  // Estado de cada sesión: completada si tiene asistencia + RPE para al least 1 jugador
  const getSessionStatus = (session: Session): 'pending' | 'partial' | 'done' => {
    const att = attendanceRecords.filter(a => a.sessionId === session.id);
    const load = loadRecords.filter(l => l.sessionId === session.id && (l.sessionLoad || 0) > 0);
    if (att.length === 0 && load.length === 0) return 'pending';
    if (att.length > 0 && load.length > 0) return 'done';
    return 'partial';
  };

  // Próxima sesión si no hay ninguna hoy
  const nextSession = sessions
    .filter(s => s.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  // Lesionados activos
  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'monitoring');

  // Jugadores con ACWR en zona de riesgo o precaución
  const acwrAlerts = players
    .map(p => ({ player: p, acwr: calculateACWR(loadRecords, sessions, p.id) }))
    .filter(({ acwr }) => acwr !== null && acwr > 1.3)
    .sort((a, b) => (b.acwr || 0) - (a.acwr || 0));

  // Próximo partido
  const nextMatch = matches
    .filter(m => m.status === 'SCHEDULED' && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const daysToMatch = nextMatch
    ? Math.ceil((new Date(nextMatch.date).getTime() - now.getTime()) / 86400000)
    : null;

  // Saludo por hora
  const hour = now.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  // Nombre del día
  const dayLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const totalAlerts = activeIncidents.length + acwrAlerts.filter(a => (a.acwr || 0) > 1.5).length;

  return (
    <div className="space-y-5">
      {/* Header saludo */}
      <div className="mb-2">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em]">{greeting}</p>
        <h2 className="text-2xl font-black text-white capitalize mt-0.5">{dayLabel}</h2>
      </div>

      {/* SESIÓN DE HOY */}
      <div className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
          <Timer size={14} className="text-emerald-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sesión hoy</span>
        </div>

        {todaySessions.length > 0 ? (
          <div className="divide-y divide-slate-800/60">
            {todaySessions.map(session => {
              const status = getSessionStatus(session);
              const presentCount = attendanceRecords.filter(a => a.sessionId === session.id && a.status === 'present').length;
              return (
                <div key={session.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-black text-white text-base leading-tight">{session.title || 'Entrenamiento'}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{session.durationMins} min · {session.type}</p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide border shrink-0",
                      status === 'done' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                      status === 'partial' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                      'bg-slate-800 text-slate-500 border-slate-700'
                    )}>
                      {status === 'done' ? '✓ Completada' : status === 'partial' ? 'Parcial' : 'Pendiente'}
                    </span>
                  </div>

                  {status === 'done' ? (
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Users size={12} className="text-emerald-400" />{presentCount} presentes</span>
                      <button onClick={() => onOpenSession(session)} className="text-emerald-500 font-bold hover:underline ml-auto">Editar →</button>
                    </div>
                  ) : (
                    <button onClick={() => onOpenSession(session)}
                      className="w-full py-3.5 bg-emerald-500 text-slate-950 rounded-2xl text-sm font-black uppercase tracking-wide hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                      <Check size={16} />
                      {status === 'partial' ? 'Completar lista + RPE' : 'Pasar lista + RPE'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <p className="text-sm text-slate-500 mb-1">Sin sesión programada hoy.</p>
            {nextSession && (
              <p className="text-xs text-slate-600">
                Próxima: <span className="text-slate-400 font-bold">{nextSession.title || 'Entrenamiento'}</span>
                {' · '}{new Date(nextSession.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            )}
            <button onClick={() => onNavigate('sessions')}
              className="mt-4 w-full py-3 border border-slate-700 rounded-2xl text-xs font-bold text-slate-400 hover:text-white hover:border-slate-600 transition-all">
              + Crear sesión para hoy
            </button>
          </div>
        )}
      </div>

      {/* ALERTAS */}
      {(activeIncidents.length > 0 || acwrAlerts.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atención</span>
              {totalAlerts > 0 && (
                <span className="w-5 h-5 bg-orange-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">{totalAlerts}</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-800/60">
            {/* Lesionados */}
            {activeIncidents.map(incident => {
              const player = subjects.find(s => s.id === incident.subjectId);
              return (
                <div key={incident.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white">{player?.name} {player?.lastName || ''}</span>
                    <span className="text-xs text-slate-500 ml-2">{incident.type}</span>
                  </div>
                  <span className={cn(
                    "text-[8px] font-black px-2 py-0.5 rounded-md uppercase",
                    incident.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  )}>{incident.severity === 'high' ? 'Alta' : 'Media'}</span>
                </div>
              );
            })}
            {/* ACWR en riesgo/precaución */}
            {acwrAlerts.map(({ player, acwr }) => {
              const zone = acwr! > 1.5 ? { label: 'RIESGO', color: 'text-red-400', dot: 'bg-red-500' }
                : { label: 'PRECAUCIÓN', color: 'text-yellow-400', dot: 'bg-yellow-500' };
              return (
                <div key={player.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", zone.dot)} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white">{player.name} {player.lastName || ''}</span>
                    <span className="text-xs text-slate-500 ml-2">ACWR {acwr!.toFixed(2)}</span>
                  </div>
                  <span className={cn("text-[8px] font-black", zone.color)}>{zone.label}</span>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-slate-800/60">
            <button onClick={() => onNavigate('health')} className="text-[10px] text-emerald-500 font-bold hover:underline uppercase tracking-wide">Ver módulo Salud →</button>
          </div>
        </div>
      )}

      {/* EQUIPO OK si no hay alertas */}
      {activeIncidents.length === 0 && acwrAlerts.length === 0 && players.length > 0 && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-[24px] px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Check size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-black text-emerald-400">Equipo en buen estado</p>
            <p className="text-xs text-slate-500">Sin lesiones activas ni alertas de carga</p>
          </div>
        </div>
      )}

      {/* PRÓXIMO PARTIDO */}
      {nextMatch && (
        <button onClick={() => onNavigate('matches')}
          className="w-full bg-slate-900 border border-slate-800 rounded-[24px] p-5 text-left hover:border-slate-700 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Próximo partido</p>
              <h4 className="font-black text-white text-base">{nextMatch.isHome ? 'vs' : '@'} {nextMatch.opponent}</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                {nextMatch.location && ` · ${nextMatch.location}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">{daysToMatch}</p>
              <p className="text-[9px] text-slate-500 uppercase">{daysToMatch === 1 ? 'día' : 'días'}</p>
            </div>
          </div>
        </button>
      )}

      {/* ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Ver plantilla', icon: Users, tab: 'roster', color: 'text-blue-400' },
          { label: 'Analytics', icon: BarChart3, tab: 'dashboard', color: 'text-purple-400' },
          { label: 'Partidos', icon: Trophy, tab: 'matches', color: 'text-yellow-400' },
          { label: 'Tests físicos', icon: Dumbbell, tab: 'physical_tests', color: 'text-orange-400' },
        ].map(item => (
          <button key={item.tab} onClick={() => onNavigate(item.tab)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left hover:border-slate-700 transition-all flex items-center gap-3">
            <item.icon size={16} className={item.color} />
            <span className="text-xs font-bold text-slate-300">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD VIEW  (métricas, gráficos y configuración)
// ─────────────────────────────────────────────────────────────────────────────

const DashboardView = ({
  subjects, incidents, matches, wellnessReports, sessions, onNavigate, loadRecords, coachId, onOpenSession
}: {
  subjects: Subject[]; incidents: HealthIncident[]; matches: Match[];
  wellnessReports: WellnessReport[]; sessions: Session[];
  onNavigate: (tab: string) => void; loadRecords: LoadRecord[]; coachId?: string;
  onOpenSession: (s: Session) => void;
}) => {
  const [cfgOpen, setCfgOpen] = useState(false);
  const [widgets, setWidgets] = useState<WidgetCfg[]>(() => getDashCfg(coachId || 'default'));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const toggleWidget = (id: string) => {
    const next = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setWidgets(next); saveDashCfg(coachId || 'default', next);
  };
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOver(null); return; }
    const next = [...widgets];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setWidgets(next); saveDashCfg(coachId || 'default', next);
    setDragIdx(null); setDragOver(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOver(null); };
  const players = subjects.filter(s => s.role === Role.PLAYER);
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const todayWellness = wellnessReports.filter(w => w.date === today);
  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'monitoring');
  const nextMatch = matches.filter(m => m.status === 'SCHEDULED').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const recentSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  // Weekly load chart (last 7 days)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0];
    const daySessions = sessions.filter(s => s.date?.toString().startsWith(d));
    const dayIds = new Set(daySessions.map(s => s.id));
    const dayRecords = loadRecords.filter(l => dayIds.has(l.sessionId) && (l.sessionLoad || 0) > 0);
    const dayLoad = dayRecords.reduce((acc, l) => acc + (l.sessionLoad || 0), 0);
    // Dividir entre jugadores que realmente tienen registro ese día (no entre toda la plantilla)
    const uniquePlayersWithLoad = new Set(dayRecords.map(l => l.subjectId)).size;
    const dayWellness = wellnessReports.filter(w => w.date === d);
    const avgW = dayWellness.length ? dayWellness.reduce((acc, w) => acc + (w.fatigue + w.sleepQuality + w.muscleSoreness + w.stressLevel + w.mood) / 5, 0) / dayWellness.length : null;
    return {
      date: new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      load: uniquePlayersWithLoad > 0 ? Math.round(dayLoad / uniquePlayersWithLoad) : 0,
      wellness: avgW ? parseFloat(avgW.toFixed(1)) : null,
    };
  });

  // Player readiness (today wellness + yesterday load)
  const yesterdaySessions = sessions.filter(s => s.date?.toString().startsWith(yesterday));
  const yesterdaySessionIds = new Set(yesterdaySessions.map(s => s.id));

  const playerReadiness = players.map(p => {
    const todayW = wellnessReports.find(w => w.subjectId === p.id && w.date === today);
    const yesterdayW = wellnessReports.find(w => w.subjectId === p.id && w.date === yesterday);
    const w = todayW || yesterdayW;
    const yLoad = loadRecords.filter(l => l.subjectId === p.id && yesterdaySessionIds.has(l.sessionId)).reduce((acc, l) => acc + (l.sessionLoad || 0), 0);
    const wellness = w ? (w.fatigue + w.sleepQuality + w.muscleSoreness + w.stressLevel + w.mood) / 5 : null;
    const risk = wellness !== null ? calculateRiskScore(wellness, yLoad) : null;
    const hasIncident = activeIncidents.some(i => i.subjectId === p.id);
    return { player: p, wellness, risk, hasIncident, yLoad };
  }).sort((a, b) => (b.risk || 0) - (a.risk || 0));

  const atRiskCount = playerReadiness.filter(pr => (pr.risk || 0) >= 55).length;
  const wellnessFilled = todayWellness.length;

  // ── KPI catalog ─────────────────────────────────────────────────────────────
  const sessionsThisWeek = (() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    return sessions.filter(s => s.date >= weekAgo).length;
  })();
  const avgLoad7 = (() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const recent = loadRecords.filter(l => {
      const sess = sessions.find(s => s.id === l.sessionId);
      return sess && sess.date >= weekAgo;
    });
    if (!recent.length) return null;
    return Math.round(recent.reduce((a, l) => a + (l.sessionLoad || 0), 0) / recent.length);
  })();
  const avgWellness7 = (() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const recent = wellnessReports.filter(w => w.date >= weekAgo);
    if (!recent.length) return null;
    const avg = recent.reduce((a, w) => a + (w.fatigue + w.sleepQuality + w.muscleSoreness + w.stressLevel + w.mood) / 5, 0) / recent.length;
    return avg.toFixed(1);
  })();
  const daysToNextMatch = nextMatch ? Math.max(0, Math.ceil((new Date(nextMatch.date).getTime() - Date.now()) / 86400000)) : null;

  const KPI_CATALOG = [
    { id: 'players',       label: 'Jugadores',           value: players.length,                            sub: `${subjects.filter(s => s.role === Role.STAFF).length} staff`,           icon: Users,        color: 'text-blue-400',    action: 'roster'   },
    { id: 'wellness',      label: 'Wellness hoy',         value: `${wellnessFilled}/${players.length}`,     sub: `${players.length - wellnessFilled} pendientes`,                          icon: Activity,     color: 'text-emerald-400', action: 'health' },
    { id: 'injuries',      label: 'Lesiones activas',     value: activeIncidents.length,                    sub: `${activeIncidents.filter(i => i.severity === 'high').length} críticas`,  icon: HeartPulse,   color: activeIncidents.length > 0 ? 'text-red-400' : 'text-emerald-400', action: 'health' },
    { id: 'risk',          label: 'En riesgo hoy',        value: atRiskCount,                               sub: 'jugadores ≥ 55% riesgo',                                                 icon: AlertTriangle,color: atRiskCount > 0 ? 'text-yellow-400' : 'text-emerald-400', action: 'health' },
    { id: 'sessions_week', label: 'Sesiones esta semana', value: sessionsThisWeek,                          sub: 'últimos 7 días',                                                         icon: Calendar,     color: 'text-purple-400',  action: 'sessions' },
    { id: 'avg_load',      label: 'Carga media 7d',       value: avgLoad7 !== null ? `${avgLoad7} AU` : '—', sub: 'carga media por jugador',                                              icon: Zap,          color: 'text-yellow-400',  action: 'health' },
    { id: 'avg_wellness',  label: 'Wellness medio 7d',    value: avgWellness7 !== null ? `${avgWellness7}/5` : '—', sub: 'promedio del equipo',                                          icon: TrendingUp,   color: 'text-emerald-400', action: 'health' },
    { id: 'next_match',    label: 'Próximo partido',      value: daysToNextMatch !== null ? `${daysToNextMatch}d` : '—', sub: nextMatch ? `vs ${nextMatch.opponent}` : 'sin programar', icon: Trophy,       color: 'text-emerald-400', action: 'matches'  },
  ];

  const getKpiCfg = (): string[] => {
    try { const s = localStorage.getItem(`ck_kpi_${coachId || 'default'}`); if (s) return JSON.parse(s); } catch {}
    return ['players', 'wellness', 'injuries', 'risk'];
  };
  const [activeKpis, setActiveKpis] = useState<string[]>(getKpiCfg);
  const saveKpiCfg = (ids: string[]) => {
    setActiveKpis(ids);
    localStorage.setItem(`ck_kpi_${coachId || 'default'}`, JSON.stringify(ids));
  };

  // ── Widget render map ────────────────────────────────────────────────────────
  const visibleKpis = KPI_CATALOG.filter(k => activeKpis.includes(k.id));
  const widgetMap: Record<string, React.ReactNode> = {
    banner: <GroupReadinessBanner key="banner" subjects={subjects} wellnessReports={wellnessReports} loadRecords={loadRecords} sessions={sessions} />,

    kpi: (
      <div key="kpi" className={`grid gap-4 ${visibleKpis.length <= 2 ? 'grid-cols-2' : visibleKpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
        {visibleKpis.map(kpi => (
          <button key={kpi.id} onClick={() => onNavigate(kpi.action)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left group hover:border-slate-700 transition-all hover:bg-slate-900/80">
            <div className="flex items-start justify-between mb-3">
              <kpi.icon size={18} className={cn(kpi.color, 'opacity-70')} />
              <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
            </div>
            <p className="text-2xl font-black text-white mb-1">{kpi.value}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
            <p className="text-[9px] text-slate-600 mt-0.5">{kpi.sub}</p>
          </button>
        ))}
      </div>
    ),

    chart: (
      <div key="chart" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[24px] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-black text-white text-sm">Carga & Wellness — Últimos 7 días</h3>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">Carga media por jugador (AU) y score wellness</p>
            </div>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1.5 text-slate-500"><span className="w-3 h-3 rounded bg-emerald-500/60"></span>Carga</span>
              <span className="flex items-center gap-1.5 text-slate-500"><span className="w-3 h-1.5 rounded bg-blue-500"></span>Wellness</span>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} stroke="#475569" />
                <YAxis yAxisId="left" fontSize={9} axisLine={false} tickLine={false} stroke="#475569" />
                <YAxis yAxisId="right" orientation="right" domain={[1, 5]} fontSize={9} axisLine={false} tickLine={false} stroke="#475569" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="load" fill="#10b981" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Carga AU" />
                <Line yAxisId="right" type="monotone" dataKey="wellness" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} name="Wellness /5" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          {nextMatch && (
            <div className="bg-slate-900 border border-slate-800 rounded-[20px] p-5 cursor-pointer hover:border-slate-700 transition-all" onClick={() => onNavigate('matches')}>
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Próximo Partido</p>
              <h4 className="font-black text-white text-base leading-tight mb-1">{nextMatch.isHome ? 'vs' : '@'} {nextMatch.opponent}</h4>
              <p className="text-xs text-slate-500">{new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              {nextMatch.location && <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-1"><MapPin size={10} />{nextMatch.location}</p>}
            </div>
          )}
          <div className="bg-slate-900 border border-slate-800 rounded-[20px] p-5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Accesos Rápidos</p>
            <div className="space-y-2">
              {[
                { label: 'Pasar Lista Hoy', action: 'sessions', icon: Check, color: 'text-emerald-400' },
                { label: 'Registrar Wellness', action: 'health', icon: Activity, color: 'text-blue-400' },
                { label: 'Ver Salud', action: 'health', icon: HeartPulse, color: 'text-red-400' },
              ].map(item => (
                <button key={item.label} onClick={() => onNavigate(item.action)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-left group">
                  <item.icon size={14} className={item.color} />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                  <ChevronRight size={12} className="ml-auto text-slate-700 group-hover:text-slate-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),

    availability: (() => {
      const playerACWR = players.map(p => {
        const acwr = calculateACWR(loadRecords, sessions, p.id);
        const load7 = (() => {
          const w7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
          return Math.round(loadRecords.filter(l => {
            const s = sessions.find(x => x.id === l.sessionId);
            return l.subjectId === p.id && s && s.date >= w7;
          }).reduce((a, l) => a + (l.sessionLoad || 0), 0));
        })();
        const hasIncident = activeIncidents.some(i => i.subjectId === p.id);
        return { player: p, acwr, load7, hasIncident };
      }).sort((a, b) => (b.acwr || 0) - (a.acwr || 0));

      return (
        <div key="availability" className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h3 className="font-black text-white text-sm">Disponibilidad del Equipo</h3>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">ACWR = carga aguda 7d / crónica 28d · zona óptima 0.8–1.3</p>
            </div>
            <button onClick={() => {
              const latest = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
              if (latest) { onOpenSession(latest); } else { onNavigate('sessions'); }
            }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all">
              <Zap size={11} /> RPE post-sesión
            </button>
          </div>
          {/* Mobile: card list */}
          <div className="md:hidden divide-y divide-slate-800/50">
            {playerACWR.map(({ player, acwr, load7, hasIncident }) => {
              const ac = acwr !== null ? acwrColor(acwr) : null;
              const displayName = `${player.name}${player.lastName ? ' ' + player.lastName : ''}`;
              return (
                <div key={player.id} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-800/30 transition-colors">
                  <span className="text-sm font-black text-white font-mono bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 shrink-0">
                    {player.number !== undefined && player.number !== null && player.number !== '' ? `#${player.number}` : '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white truncate">{displayName}</span>
                      {hasIncident && <AlertCircle size={13} className="text-red-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono">{load7 > 0 ? `${load7} AU · 7d` : 'Sin carga registrada'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ac ? (
                      <>
                        <span className={cn("text-sm font-black tabular-nums", ac.text)}>{acwr!.toFixed(2)}</span>
                        <span className={cn("text-[9px] font-black px-2 py-1 rounded-lg uppercase border", ac.bg, ac.text, ac.border)}>{ac.label}</span>
                      </>
                    ) : <span className="text-[9px] text-slate-600 font-mono">Sin datos (≥28d)</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/60 text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-3">#</th><th className="px-6 py-3">Jugador</th>
                  <th className="px-6 py-3 text-center">Carga 7d (AU)</th>
                  <th className="px-6 py-3 text-center">ACWR</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {playerACWR.map(({ player, acwr, load7, hasIncident }) => {
                  const ac = acwr !== null ? acwrColor(acwr) : null;
                  const displayName = `${player.name}${player.lastName ? ' ' + player.lastName : ''}`;
                  return (
                    <tr key={player.id} className="hover:bg-slate-950/30 transition-colors">
                      <td className="px-6 py-3">
                        <span className="text-sm font-black text-white font-mono bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
                          {player.number !== undefined && player.number !== null && player.number !== '' ? `#${player.number}` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">{displayName}</span>{hasIncident && <AlertCircle size={12} className="text-red-400" />}</div></td>
                      <td className="px-6 py-3 text-center text-[10px] text-slate-400 font-mono">{load7 > 0 ? `${load7} AU` : '—'}</td>
                      <td className="px-6 py-3 text-center">
                        {acwr !== null ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(acwr / 2, 1) * 100}%`, background: ac?.bar }} />
                            </div>
                            <span className={cn("text-xs font-black", ac?.text)}>{acwr.toFixed(2)}</span>
                          </div>
                        ) : <span className="text-[9px] text-slate-600 font-mono">Sin datos — necesita 28d</span>}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {ac ? <span className={cn("text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide border", ac.bg, ac.text, ac.border)}>{ac.label}</span>
                          : <span className="text-[9px] text-slate-700">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    })(),

    sessions: recentSessions.length > 0 ? (
      <div key="sessions" className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="font-black text-white text-sm">Últimas Sesiones</h3>
          <button onClick={() => onNavigate('sessions')} className="text-[9px] font-bold text-emerald-500 hover:underline uppercase tracking-wider">Ver todas →</button>
        </div>
        <div className="divide-y divide-slate-800/50">
          {recentSessions.map(s => (
            <div key={s.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-950/30 transition-colors">
              <div className="flex items-center gap-3">
                <Timer size={14} className="text-slate-600" />
                <div>
                  <p className="text-sm font-bold text-white">{s.title || 'Sesión'}</p>
                  <p className="text-[10px] text-slate-600">{new Date(s.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-slate-600 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">{s.type}</span>
            </div>
          ))}
        </div>
      </div>
    ) : null,
  };

  return (
    <div className="space-y-6">
      {/* Header con botón personalizar */}
      <div className="flex justify-end">
        <button onClick={() => setCfgOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
          <Settings size={12} /> Personalizar
        </button>
      </div>

      {/* Widgets en orden */}
      {widgets.filter(w => w.visible).map(w => widgetMap[w.id])}

      {/* RPE: navega directamente a la sesión más reciente en SessionsView */}

      {/* Panel de configuración */}
      {cfgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCfgOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-[24px] p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-white text-sm">Personalizar dashboard</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Arrastra para reordenar · Toggle para mostrar/ocultar</p>
              </div>
              <button onClick={() => setCfgOpen(false)} className="text-slate-600 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {widgets.map((w, idx) => {
                const def = DASH_WIDGETS.find(d => d.id === w.id);
                return (
                  <div key={w.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none",
                      dragOver === idx && dragIdx !== idx ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-800 bg-slate-950",
                      dragIdx === idx ? "opacity-40" : "opacity-100"
                    )}>
                    <GripVertical size={14} className="text-slate-600 shrink-0" />
                    <span className="text-xs text-slate-300 flex-1">{def?.label}</span>
                    <button onClick={() => toggleWidget(w.id)}
                      className={cn("w-9 h-5 rounded-full transition-all relative shrink-0", w.visible ? "bg-emerald-500" : "bg-slate-700")}>
                      <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow", w.visible ? "left-4" : "left-0.5")} />
                    </button>
                  </div>
                );
              })}
            </div>
            {/* KPI section */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Tarjetas KPI visibles</p>
              <div className="space-y-2">
                {KPI_CATALOG.map(kpi => {
                  const active = activeKpis.includes(kpi.id);
                  return (
                    <div key={kpi.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950">
                      <kpi.icon size={13} className={kpi.color} />
                      <span className="text-xs text-slate-300 flex-1">{kpi.label}</span>
                      <button onClick={() => {
                        const next = active ? activeKpis.filter(id => id !== kpi.id) : [...activeKpis, kpi.id];
                        saveKpiCfg(next);
                      }} className={cn("w-9 h-5 rounded-full transition-all relative shrink-0", active ? "bg-emerald-500" : "bg-slate-700")}>
                        <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow", active ? "left-4" : "left-0.5")} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={() => {
              const reset = DASH_WIDGETS.map(w => ({ id: w.id, visible: true }));
              setWidgets(reset); saveDashCfg(coachId || 'default', reset);
              saveKpiCfg(['players', 'wellness', 'injuries', 'risk']);
            }} className="mt-4 w-full py-2.5 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-500 hover:text-white hover:border-slate-600 transition-all uppercase tracking-wider">
              Restablecer por defecto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH VIEW  (Scatter con cruce temporal correcto + ACWR)
// ─────────────────────────────────────────────────────────────────────────────

const HealthView = ({
  subjects, incidents, wellnessReports, loadRecords, onAddIncident,
  onUpdateIncident, isAddingIncident, setIsAddingIncident, showToast, sessions, onSaveWellness
}: {
  subjects: Subject[]; incidents: HealthIncident[]; wellnessReports: WellnessReport[];
  loadRecords: LoadRecord[]; onAddIncident: (i: Partial<HealthIncident>) => Promise<void>;
  onUpdateIncident: (id: string, u: Partial<HealthIncident>) => Promise<void>;
  isAddingIncident: boolean; setIsAddingIncident: (v: boolean) => void;
  showToast: (t: ToastType, m: string) => void; sessions: Session[];
  onSaveWellness: (w: WellnessReport) => Promise<void>;
}) => {
  const [activeTab, setActiveTab] = useState<'scatter' | 'acwr' | 'incidents' | 'wellness'>('incidents');
  const [incidentForm, setIncidentForm] = useState({ subjectId: '', type: '', severity: 'medium' as const, date: new Date().toISOString().split('T')[0], notes: '', status: 'active' });
  const [savingIncident, setSavingIncident] = useState(false);
  const players = subjects.filter(s => s.role === Role.PLAYER);

  // ── Temporal cross: Load(Day X) × Wellness(Day X+1) ──
  const scatterData = players.flatMap(p => {
    const playerLoads = loadRecords.filter(l => l.subjectId === p.id);
    return playerLoads.map(load => {
      const sess = sessions.find(s => s.id === load.sessionId);
      if (!sess) return null;
      const loadDate = sess.date?.toString().split('T')[0];
      if (!loadDate) return null;
      const nextDay = new Date(new Date(loadDate).getTime() + 86400000).toISOString().split('T')[0];
      const nextWellness = wellnessReports.find(w => w.subjectId === p.id && w.date === nextDay);
      if (!nextWellness) return null;
      const wellnessScore = (nextWellness.fatigue + nextWellness.sleepQuality + nextWellness.muscleSoreness + nextWellness.stressLevel + nextWellness.mood) / 5;
      const risk = calculateRiskScore(wellnessScore, load.sessionLoad || 0);
      return { x: load.sessionLoad || 0, y: wellnessScore, z: risk, name: p.name, risk };
    }).filter(Boolean);
  });

  // ── ACWR per player ──
  const acwrData = players.map(p => {
    const acwr = calculateACWR(loadRecords, sessions, p.id);
    const totalLoad7 = (() => {
      let sum = 0;
      const now = Date.now();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now - i * 86400000).toISOString().split('T')[0];
        const daySessionIds = new Set(sessions.filter(s => s.date?.toString().startsWith(d)).map(s => s.id));
        loadRecords.filter(l => l.subjectId === p.id && daySessionIds.has(l.sessionId)).forEach(l => sum += (l.sessionLoad || 0));
      }
      return sum;
    })();
    const shortName = p.lastName ? `${p.name} ${p.lastName.split(' ')[0]}` : p.name;
    return { name: shortName, acwr, load7: Math.round(totalLoad7) };
  }).filter(d => d.acwr !== null) as { name: string; acwr: number; load7: number }[];

  const getACWRColor = (v: number) => {
    if (v > 1.5) return '#ef4444';
    if (v < 0.8) return '#3b82f6';
    if (v <= 1.3) return '#10b981';
    return '#eab308'; // 1.3–1.5 precaución
  };

  const handleSaveIncident = async () => {
    if (!incidentForm.subjectId || !incidentForm.type) { showToast('warning', 'Completa todos los campos'); return; }
    setSavingIncident(true);
    try {
      await onAddIncident(incidentForm);
      setIsAddingIncident(false);
      setIncidentForm({ subjectId: '', type: '', severity: 'medium', date: new Date().toISOString().split('T')[0], notes: '', status: 'active' });
      showToast('success', 'Incidencia registrada correctamente');
    } catch { showToast('error', 'Error al registrar la incidencia'); }
    finally { setSavingIncident(false); }
  };

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'monitoring');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1 w-fit">
        {[
          { id: 'incidents', label: `Lesiones (${activeIncidents.length})` },
          { id: 'acwr', label: 'ACWR' },
          { id: 'wellness', label: 'Estado subjetivo' },
          { id: 'scatter', label: 'Carga × Wellness' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wide",
              activeTab === tab.id ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white")}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* New incident form */}
      <AnimatePresence>
        {isAddingIncident && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-slate-900 border border-red-500/30 rounded-[24px] p-6 shadow-lg">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-white flex items-center gap-2"><HeartPulse size={18} className="text-red-400" /> Nueva Incidencia</h3>
              <button onClick={() => setIsAddingIncident(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Jugador</label>
                <select value={incidentForm.subjectId} onChange={e => setIncidentForm({...incidentForm, subjectId: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50">
                  <option value="">Seleccionar...</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name} {p.lastName}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tipo de Lesión</label>
                <input value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})} placeholder="Tobillo, rodilla, muscular..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Severidad</label>
                <select value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as any})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50">
                  <option value="low">Leve</option>
                  <option value="medium">Moderada</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fecha</label>
                <input type="date" value={incidentForm.date} onChange={e => setIncidentForm({...incidentForm, date: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50" />
              </div>
            </div>
            <div className="space-y-1.5 mb-5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Notas clínicas</label>
              <textarea value={incidentForm.notes} onChange={e => setIncidentForm({...incidentForm, notes: e.target.value})} rows={2}
                placeholder="Mecanismo de lesión, zona anatómica, protocolo inicial..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-red-500/50" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveIncident} disabled={savingIncident}
                className="flex-1 bg-red-500 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-400 transition-all flex items-center justify-center gap-2">
                {savingIncident ? <><Loader2 size={14} className="animate-spin" />Guardando...</> : 'Registrar Incidencia'}
              </button>
              <button onClick={() => setIsAddingIncident(false)} className="px-8 bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase border border-slate-700 hover:bg-slate-700">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scatter: Load × Wellness (temporal X/X+1) */}
      {activeTab === 'scatter' && (
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6">
          <div className="mb-4">
            <h3 className="font-black text-white text-sm">Matriz Carga × Wellness — Cruce Temporal</h3>
            <p className="text-[9px] text-slate-500 font-mono mt-1">Eje X = carga sesión día D · Eje Y = wellness jugador día D+1 · Cuadrante superior derecho = riesgo máximo</p>
          </div>
          {scatterData.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" dataKey="x" name="Carga AU" stroke="#475569" fontSize={9} label={{ value: 'Carga Sesión (AU)', position: 'insideBottom', offset: -4, fill: '#475569', fontSize: 9 }} />
                  <YAxis type="number" dataKey="y" name="Wellness" domain={[1, 5]} stroke="#475569" fontSize={9} label={{ value: 'Wellness D+1', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 9 }} />
                  <ZAxis type="number" dataKey="z" range={[40, 200]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(v: any, n: string) => [n === 'Wellness' ? `${Number(v).toFixed(1)}/5` : `${v} AU`, n]} />
                  {/* Risk zones */}
                  <ReferenceLine y={3.2} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={2.5} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine x={700} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine x={800} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Scatter name="Jugadores" data={scatterData}
                    shape={(props: any) => {
                      const { cx, cy, payload } = props;
                      const c = payload.risk >= 75 ? '#ef4444' : payload.risk >= 55 ? '#10b981' : '#10b981';
                      return <circle cx={cx} cy={cy} r={7} fill={c} fillOpacity={0.8} stroke={c} strokeWidth={1} />;
                    }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm text-slate-600 italic">Sin datos suficientes para el cruce temporal. Registra sesiones con RPE y wellness diario.</p>
            </div>
          )}
          <div className="mt-4 flex gap-4 text-[9px] font-bold text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Bajo riesgo (&lt;55%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Alerta (55–74%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Crítico (≥75%)</span>
          </div>
        </div>
      )}

      {/* ACWR chart */}
      {activeTab === 'acwr' && (
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6">
          <div className="mb-4">
            <h3 className="font-black text-white text-sm">ACWR — Ratio Carga Aguda:Crónica</h3>
            <p className="text-[9px] text-slate-500 font-mono mt-1">Aguda (7d) ÷ Crónica (28d) · Zona óptima: 0.8 – 1.3 · &gt;1.5 = zona roja de lesión</p>
          </div>
          {acwrData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={acwrData} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" domain={[0, 2]} fontSize={9} stroke="#475569" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={10} stroke="#475569" axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(v: any) => [Number(v).toFixed(2), 'ACWR']} />
                  <ReferenceLine x={0.8} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine x={1.3} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine x={1.5} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Bar dataKey="acwr" radius={[0, 6, 6, 0]}
                    fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-16 text-center"><p className="text-sm text-slate-600 italic">Necesitas al menos 7 días de datos de carga para calcular el ACWR.</p></div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[{ range: '&lt; 0.8', label: 'Subcarga', color: 'text-blue-400' }, { range: '0.8 – 1.3', label: 'Zona Óptima', color: 'text-emerald-400' }, { range: '&gt; 1.5', label: 'Zona Roja', color: 'text-red-400' }].map(z => (
              <div key={z.label} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <p className={cn("text-sm font-black", z.color)} dangerouslySetInnerHTML={{ __html: z.range }} />
                <p className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">{z.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wellness tab — formulario estado subjetivo */}
      {activeTab === 'wellness' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl px-5 py-3 flex items-start gap-3">
            <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <span className="text-slate-300 font-bold">Estado subjetivo (Índice de Hooper)</span> — Requiere que el entrenador introduzca los datos por cada jugador.
              El riesgo de lesión objetivo se calcula automáticamente con ACWR desde los datos de carga.
            </p>
          </div>
          <WellnessTestView subjects={subjects} wellnessReports={wellnessReports} onSave={onSaveWellness} />
        </div>
      )}

      {/* Incidents */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-900 rounded-[28px]">
              <HeartPulse className="mx-auto text-slate-800 mb-4" size={36} />
              <p className="text-slate-600 font-mono text-sm">No hay incidencias registradas</p>
              <button onClick={() => setIsAddingIncident(true)} className="mt-3 text-xs text-emerald-500 font-bold hover:underline uppercase">Registrar primera incidencia →</button>
            </div>
          ) : (
            incidents.sort((a, b) => (a.status === 'active' ? -1 : 1)).map(incident => {
              const player = subjects.find(s => s.id === incident.subjectId);
              const severityStyle = incident.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : incident.severity === 'medium' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-700 bg-slate-950';
              return (
                <div key={incident.id} className={cn("border rounded-2xl p-5 flex items-start justify-between gap-4", severityStyle)}>
                  <div className="flex items-start gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", incident.severity === 'high' ? 'bg-red-500/20' : incident.severity === 'medium' ? 'bg-emerald-500/20' : 'bg-slate-800')}>
                      <HeartPulse size={18} className={incident.severity === 'high' ? 'text-red-400' : incident.severity === 'medium' ? 'text-emerald-400' : 'text-slate-500'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">{player?.name || 'Jugador'}</span>
                        <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-md uppercase", incident.severity === 'high' ? 'bg-red-500/20 text-red-400' : incident.severity === 'medium' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500')}>{incident.severity}</span>
                      </div>
                      <p className="text-sm text-slate-300 font-medium">{incident.type}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">{incident.date} {incident.notes && `• ${incident.notes}`}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={cn("text-[9px] font-bold px-2.5 py-1 rounded-lg uppercase border", incident.status === 'active' ? 'bg-red-500/10 text-red-400 border-red-500/20' : incident.status === 'monitoring' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>{incident.status}</span>
                    {(incident.status === 'active' || incident.status === 'monitoring') && (
                      <button onClick={() => { onUpdateIncident(incident.id, { status: 'recovered', recoveryDate: new Date().toISOString().split('T')[0] }); showToast('success', `${player?.name}: marcado como recuperado`); }}
                        className="text-[9px] font-bold text-emerald-400 hover:underline uppercase">
                        Marcar recuperado →
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER VIEW  (fix: Pasar Lista → abre AttendanceTool inline, edit icon correcto)
// ─────────────────────────────────────────────────────────────────────────────

const PlayerRegistrationForm = ({
  onSave, onCancel, editingPlayer, showToast
}: {
  onSave: (p: Subject) => Promise<void>; onCancel: () => void;
  editingPlayer: Subject | null; showToast: (t: ToastType, m: string) => void;
}) => {
  const [form, setForm] = useState({
    name: editingPlayer?.name || '', lastName: editingPlayer?.lastName || '',
    birthDate: editingPlayer?.birthDate || '', number: editingPlayer?.number?.toString() || '',
    position: editingPlayer?.position || '', contact: editingPlayer?.contact || '',
    dnaId: editingPlayer?.dnaId || '', role: editingPlayer?.role || Role.PLAYER,
  });
  const [saving, setSaving] = useState(false);

  const positions = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot'];

  const handleSave = async () => {
    if (!form.name) { showToast('warning', 'El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await onSave({ ...editingPlayer, ...form, id: editingPlayer?.id || '', teamId: editingPlayer?.teamId || '', number: form.number } as any);
      showToast('success', editingPlayer ? 'Jugador actualizado' : 'Jugador registrado');
    } catch (err: any) { showToast('error', 'Error al guardar: ' + (err?.message || JSON.stringify(err))); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[28px] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-white text-lg">{editingPlayer ? 'Editar Jugador' : 'Nuevo Jugador'}</h3>
        <button onClick={onCancel} className="text-slate-500 hover:text-white"><X size={20} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Nombre', key: 'name', placeholder: 'Nombre' },
          { label: 'Apellidos', key: 'lastName', placeholder: 'Apellidos' },
          { label: 'Fecha de Nacimiento', key: 'birthDate', placeholder: '', type: 'date' },
          { label: 'Dorsal', key: 'number', placeholder: '00' },
          { label: 'Email / Contacto', key: 'contact', placeholder: 'jugador@email.com' },
          { label: 'DNI / DNA ID', key: 'dnaId', placeholder: '12345678A' },
        ].map(f => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{f.label}</label>
            <input type={f.type || 'text'} value={(form as any)[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} placeholder={f.placeholder}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
          </div>
        ))}
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Posición</label>
          <select value={form.position} onChange={e => setForm({...form, position: e.target.value})}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
            <option value="">Seleccionar...</option>
            {positions.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Rol</label>
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
            <option value={Role.PLAYER}>Jugador</option>
            <option value={Role.STAFF}>Staff</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-emerald-500 text-slate-950 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-500/20">
          {saving ? <><Loader2 size={14} className="animate-spin" />Guardando...</> : <><Check size={14} />{editingPlayer ? 'Actualizar' : 'Registrar'}</>}
        </button>
        <button onClick={onCancel} className="px-8 bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase border border-slate-700 hover:bg-slate-700 transition-all">Cancelar</button>
      </div>
    </div>
  );
};

const RosterView = ({
  subjects, onPlayerClick, onAddSubject, onPassAttendance,
  isAddingSubject, setIsAddingSubject, editingSubject, setEditingSubject,
  showToast, attendanceRecords, sessions
}: {
  subjects: Subject[]; onPlayerClick: (p: Subject) => void;
  onAddSubject: (p: Subject) => Promise<void>; onPassAttendance: () => void;
  isAddingSubject: boolean; setIsAddingSubject: (v: boolean) => void;
  editingSubject: Subject | null; setEditingSubject: (p: Subject | null) => void;
  showToast: (t: ToastType, m: string) => void;
  attendanceRecords: AttendanceRecord[]; sessions: Session[];
}) => {
  const [filterRole, setFilterRole] = useState<'ALL' | 'PLAYER' | 'STAFF'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'position' | 'number'>('number');

  const parseNumber = (n: any) => {
    if (n === '00') return -0.5;
    const v = parseInt(String(n));
    return isNaN(v) ? 999 : v;
  };

  const positionOrder = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot'];
  const filtered = subjects
    .filter(s => filterRole === 'ALL' ? true : s.role === filterRole)
    .filter(s => search === '' ? true : `${s.name} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === Role.PLAYER ? -1 : 1;
      if (sortBy === 'number') return parseNumber(a.number) - parseNumber(b.number);
      return positionOrder.indexOf(a.position || '') - positionOrder.indexOf(b.position || '');
    });

  const getAttendanceRate = (playerId: string) => {
    const att = attendanceRecords.filter(a => a.subjectId === playerId);
    if (att.length === 0) return null;
    return Math.round((att.filter(a => a.status === 'present').length / att.length) * 100);
  };

  if (isAddingSubject || editingSubject) {
    return (
      <div>
        <button onClick={() => { setIsAddingSubject(false); setEditingSubject(null); }} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ChevronLeft size={16} /> Volver a plantilla
        </button>
        <PlayerRegistrationForm
          onSave={onAddSubject}
          onCancel={() => { setIsAddingSubject(false); setEditingSubject(null); }}
          editingPlayer={editingSubject}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex gap-2">
          {(['ALL', 'PLAYER', 'STAFF'] as const).map(r => (
            <button key={r} onClick={() => setFilterRole(r)}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                filterRole === r ? "bg-emerald-500 text-slate-950 border-emerald-500" : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700")}>
              {r === 'ALL' ? 'Todos' : r === 'PLAYER' ? 'Jugadores' : 'Staff'}
            </button>
          ))}
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..."
            className="flex-1 md:w-48 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-500/50 placeholder:text-slate-600" />
          <button onClick={() => setSortBy(s => s === 'number' ? 'position' : 'number')}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all whitespace-nowrap",
              sortBy === 'number' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700")}>
            {sortBy === 'number' ? '# Dorsal' : 'Posición'}
          </button>
          <button onClick={onPassAttendance}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold uppercase hover:bg-emerald-500/20 transition-all whitespace-nowrap">
            <Check size={14} /> Pasar Lista
          </button>
        </div>
      </div>

      {/* Players table */}
      <div className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/60 text-[8px] font-bold text-slate-600 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3 hidden md:table-cell">Posición</th>
                <th className="px-5 py-3 hidden lg:table-cell">Contacto</th>
                <th className="px-5 py-3 text-center hidden md:table-cell">Asistencia</th>
                <th className="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(player => {
                const attRate = getAttendanceRate(player.id);
                return (
                  <tr key={player.id} className="hover:bg-slate-950/40 transition-colors group">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-black text-white font-mono bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
                        {player.number !== undefined && player.number !== null && player.number !== '' ? `#${player.number}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => onPlayerClick(player)} className="flex items-center gap-3 text-left group/name">
                        <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-xs font-black text-white group-hover/name:bg-emerald-500 group-hover/name:text-slate-950 transition-all">
                          {player.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover/name:text-emerald-400 transition-colors">{player.name} {player.lastName || ''}</p>
                          <p className="text-[9px] text-slate-600 font-mono uppercase">{player.role}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-xs text-slate-400">{player.position || '—'}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-[10px] text-slate-500 font-mono">{player.contact || '—'}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-center">
                      {attRate !== null ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", attRate >= 80 ? 'bg-emerald-500' : attRate >= 60 ? 'bg-emerald-500' : 'bg-red-500')} style={{ width: `${attRate}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono">{attRate}%</span>
                        </div>
                      ) : <span className="text-[9px] text-slate-700">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setEditingSubject(player)} title="Editar"
                          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => onPlayerClick(player)} title="Ver perfil"
                          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition-all">
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <Users className="mx-auto text-slate-800 mb-3" size={32} />
            <p className="text-slate-600 text-sm font-mono">No hay jugadores que coincidan</p>
          </div>
        )}
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// MATCHES VIEW
// ─────────────────────────────────────────────────────────────────────────────

const MatchesView = ({
  matches, onAddMatch, subjects, matchStats, onAddMatchStat,
  isAdding, setIsAdding, activeTeam, showToast
}: {
  matches: Match[]; onAddMatch: (m: Partial<Match>) => Promise<void>;
  subjects: Subject[]; matchStats: MatchStat[]; onAddMatchStat: (s: any) => Promise<void>;
  isAdding: boolean; setIsAdding: (v: boolean) => void;
  activeTeam: Team | null; showToast: (t: ToastType, m: string) => void;
}) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [form, setForm] = useState({ opponent: '', date: new Date().toISOString().split('T')[0], location: '', isHome: true, status: 'SCHEDULED', resultUs: '', resultThem: '' });
  const [saving, setSaving] = useState(false);
  const [editingReport, setEditingReport] = useState(false);
  const [reportDraft, setReportDraft] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  const handleAdd = async () => {
    if (!form.opponent) { showToast('warning', 'Introduce el nombre del rival'); return; }
    setSaving(true);
    try {
      await onAddMatch({ ...form, resultUs: form.resultUs ? parseInt(form.resultUs) : undefined, resultThem: form.resultThem ? parseInt(form.resultThem) : undefined });
      setIsAdding(false);
      setForm({ opponent: '', date: new Date().toISOString().split('T')[0], location: '', isHome: true, status: 'SCHEDULED', resultUs: '', resultThem: '' });
      showToast('success', 'Partido registrado');
    } catch { showToast('error', 'Error al guardar el partido'); }
    finally { setSaving(false); }
  };

  const handleSaveReport = async () => {
    if (!selectedMatch || !isSupabaseConfigured) { showToast('warning', 'Modo local: crónica guardada localmente'); setEditingReport(false); return; }
    setSavingReport(true);
    try {
      await supabase.from('matches').update({ match_report: reportDraft }).eq('id', selectedMatch.id);
      setSelectedMatch({ ...selectedMatch, match_report: reportDraft });
      setEditingReport(false);
      showToast('success', 'Crónica táctica guardada');
    } catch { showToast('error', 'Error al guardar la crónica'); }
    finally { setSavingReport(false); }
  };

  const handlePrintReport = () => {
    window.print();
    showToast('info', 'Abriendo diálogo de impresión...');
  };

  if (selectedMatch) {
    const result = selectedMatch.resultUs !== undefined && selectedMatch.resultThem !== undefined
      ? selectedMatch.resultUs > selectedMatch.resultThem ? 'WIN' : selectedMatch.resultUs < selectedMatch.resultThem ? 'LOSS' : 'DRAW'
      : 'PENDING';
    const resultStyle = result === 'WIN' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : result === 'LOSS' ? 'bg-red-500/15 text-red-400 border-red-500/30' : result === 'DRAW' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    const statsForMatch = matchStats.filter(s => s.matchId === selectedMatch.id);
    const statsKeys = statsForMatch.length > 0 ? Object.keys(statsForMatch[0].stats) : [];

    return (
      <div>
        <button onClick={() => setSelectedMatch(null)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"><ChevronLeft size={16} /> Volver a partidos</button>
        <div className="space-y-5">
          {/* Match header */}
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[9px] text-slate-500 uppercase font-mono mb-1">{selectedMatch.isHome ? 'Local' : 'Visitante'}</p>
                  <p className="text-4xl font-black text-white">{selectedMatch.resultUs ?? '—'}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-600 uppercase tracking-widest">vs</span>
                  <span className={cn("text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-wide", resultStyle)}>{result === 'WIN' ? 'Victoria' : result === 'LOSS' ? 'Derrota' : result === 'DRAW' ? 'Empate' : 'Por jugar'}</span>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-slate-500 uppercase font-mono mb-1">{selectedMatch.opponent}</p>
                  <p className="text-4xl font-black text-white">{selectedMatch.resultThem ?? '—'}</p>
                </div>
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <p className="flex items-center gap-2"><Calendar size={13} /> {new Date(selectedMatch.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                {selectedMatch.location && <p className="flex items-center gap-2"><MapPin size={13} /> {selectedMatch.location}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrintReport} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center gap-2"><Printer size={13} /> Imprimir</button>
              </div>
            </div>
          </div>

          {/* Tactical report editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-black text-white flex items-center gap-2"><FileText size={16} className="text-blue-400" /> Crónica Táctica</h3>
              <div className="flex items-center gap-2">
                {editingReport ? (
                  <>
                    <button onClick={() => setEditingReport(false)} className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"><X size={13} /> Cancelar</button>
                    <button onClick={handleSaveReport} disabled={savingReport} className="px-3 py-1.5 rounded-xl bg-blue-600 text-xs text-white hover:bg-blue-500 transition-colors flex items-center gap-1 disabled:opacity-60">
                      {savingReport ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setReportDraft(selectedMatch.match_report || ''); setEditingReport(true); }} className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition-colors flex items-center gap-1"><Edit2 size={13} /> Editar</button>
                )}
              </div>
            </div>
            <div className="p-6">
              {editingReport ? (
                <textarea value={reportDraft} onChange={e => setReportDraft(e.target.value)} rows={8}
                  placeholder={`DEFENSA:\n- ...\n\nATAQUE:\n- ...\n\nCLAVES PRÓXIMO PARTIDO:\n- ...`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 font-mono text-sm text-slate-200 resize-none outline-none focus:border-blue-500/50 leading-relaxed" />
              ) : (
                <div className="min-h-[100px]">
                  {selectedMatch.match_report ? (
                    <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{selectedMatch.match_report}</pre>
                  ) : (
                    <p className="text-slate-600 italic text-sm">Sin crónica. Pulsa <span className="text-blue-400 not-italic font-bold">Editar</span> para añadir apuntes tácticos.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Player stats */}
          {statsForMatch.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800"><h3 className="font-black text-white">Estadísticas del Partido</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/50 text-[8px] font-bold text-slate-600 uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3">Jugador</th>
                      {statsKeys.map(k => <th key={k} className="px-4 py-3 text-center">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {statsForMatch.map(stat => {
                      const player = subjects.find(s => s.id === stat.subjectId);
                      return (
                        <tr key={stat.id} className="hover:bg-slate-950/30 transition-colors">
                          <td className="px-6 py-3 font-bold text-sm text-white">{player?.name || '—'}</td>
                          {statsKeys.map(k => <td key={k} className="px-4 py-3 text-center text-[11px] font-mono text-slate-300">{stat.stats[k] ?? '—'}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const wins = matches.filter(m => m.status === 'FINISHED' && (m.resultUs || 0) > (m.resultThem || 0)).length;
  const finished = matches.filter(m => m.status === 'FINISHED').length;

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-slate-900 border border-emerald-500/30 rounded-[24px] p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-white">Nuevo Partido</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Rival</label>
                <input value={form.opponent} onChange={e => setForm({...form, opponent: e.target.value})} placeholder="Nombre del equipo rival"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pabellón / Lugar</label>
                <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Pabellón Municipal..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Condición</label>
                <select value={form.isHome ? 'home' : 'away'} onChange={e => setForm({...form, isHome: e.target.value === 'home'})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="home">Local</option>
                  <option value="away">Visitante</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Estado</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
                  <option value="SCHEDULED">Programado</option>
                  <option value="FINISHED">Finalizado</option>
                </select>
              </div>
              {form.status === 'FINISHED' && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Resultado (Nuestro - Rival)</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" value={form.resultUs} onChange={e => setForm({...form, resultUs: e.target.value})} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 text-center" />
                    <span className="text-slate-600 font-black">—</span>
                    <input type="number" value={form.resultThem} onChange={e => setForm({...form, resultThem: e.target.value})} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 text-center" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-emerald-500 text-slate-950 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <><Loader2 size={14} className="animate-spin" />Guardando...</> : 'Guardar Partido'}
              </button>
              <button onClick={() => setIsAdding(false)} className="px-8 bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase border border-slate-700 hover:bg-slate-700 transition-all">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {finished > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[{ label: 'Jugados', v: finished }, { label: 'Victorias', v: wins, color: 'text-emerald-400' }, { label: '% Victoria', v: `${Math.round((wins / finished) * 100)}%`, color: wins / finished >= 0.5 ? 'text-emerald-400' : 'text-red-400' }].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className={cn("text-2xl font-black", s.color || 'text-white')}>{s.v}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(match => {
          const result = match.status === 'FINISHED' && match.resultUs !== undefined
            ? match.resultUs > (match.resultThem || 0) ? 'W' : match.resultUs < (match.resultThem || 0) ? 'L' : 'E'
            : null;
          const resultStyle = result === 'W' ? 'bg-emerald-500 text-white' : result === 'L' ? 'bg-red-500 text-white' : result === 'E' ? 'bg-yellow-500 text-slate-950' : 'bg-blue-500/20 text-blue-400';
          return (
            <div key={match.id} onClick={() => setSelectedMatch(match)}
              className="bg-slate-900 border border-slate-800 rounded-[20px] p-5 flex items-center justify-between hover:border-slate-700 transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                {result && <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0", resultStyle)}>{result}</span>}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{match.isHome ? 'vs' : '@'} {match.opponent}</span>
                    <span className={cn("text-[8px] font-bold px-2 py-0.5 rounded-md border", match.status === 'FINISHED' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>{match.status === 'FINISHED' ? 'Finalizado' : 'Programado'}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                    <Calendar size={10} /> {new Date(match.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {match.location && <><span className="text-slate-700">•</span><MapPin size={10} /> {match.location}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {match.status === 'FINISHED' && (
                  <span className="text-xl font-black text-white">{match.resultUs} – {match.resultThem}</span>
                )}
                <ChevronRight size={16} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          );
        })}
        {matches.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-slate-900 rounded-[28px]">
            <Trophy className="mx-auto text-slate-800 mb-3" size={36} />
            <p className="text-slate-600 text-sm font-mono">No hay partidos registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS VIEW  (FIXED: cálculo real de datos, PDF, Notify Staff)
// ─────────────────────────────────────────────────────────────────────────────

const ReportsView = ({
  subjects, incidents, evaluations, wellnessReports, loadRecords, matchStats, showToast
}: {
  subjects: Subject[]; incidents: HealthIncident[]; evaluations: QualitativeReport[];
  wellnessReports: WellnessReport[]; loadRecords: LoadRecord[]; matchStats: MatchStat[];
  showToast: (t: ToastType, m: string) => void;
}) => {
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const players = subjects.filter(s => s.role === Role.PLAYER);

  // ── REAL STAT CALCULATIONS ──
  const avgBorg = loadRecords.length > 0
    ? (loadRecords.reduce((acc, l) => acc + (l.borgScale || 0), 0) / loadRecords.length).toFixed(1)
    : '—';

  const avgWellness = wellnessReports.length > 0
    ? ((wellnessReports.reduce((acc, w) => acc + (w.fatigue + w.sleepQuality + w.muscleSoreness + w.stressLevel + w.mood) / 5, 0)) / wellnessReports.length).toFixed(1)
    : '—';

  const activeIncidents = incidents.filter(i => i.status === 'active').length;

  const allAttStats = matchStats.flatMap(s => Object.entries(s.stats));
  const ptsStats = allAttStats.filter(([k]) => k === 'PTS' || k === 'Pts');
  const topScorer = ptsStats.length > 0 ? (() => {
    const byPlayer = new Map<string, number>();
    matchStats.forEach(s => {
      const pts = parseFloat(String(s.stats['PTS'] || s.stats['Pts'] || 0));
      if (!isNaN(pts)) byPlayer.set(s.subjectId, (byPlayer.get(s.subjectId) || 0) + pts);
    });
    const topId = [...byPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!topId) return null;
    const player = players.find(p => p.id === topId[0]);
    return player ? { name: player.name, pts: (topId[1] / Math.max(matchStats.filter(s => s.subjectId === topId[0]).length, 1)).toFixed(1) } : null;
  })() : null;

  const evalAvg = evaluations.length > 0
    ? (evaluations.filter(e => e.overall).reduce((acc, e) => acc + parseFloat(e.overall || '0'), 0) / evaluations.filter(e => e.overall).length).toFixed(1)
    : '—';

  const kpis = [
    { label: 'RPE Medio Equipo', value: avgBorg, sub: 'Escala Borg 0–10', icon: Zap, color: 'text-emerald-400' },
    { label: 'Wellness Medio', value: avgWellness !== '—' ? `${avgWellness}/5` : '—', sub: 'Índice Hooper', icon: Activity, color: 'text-blue-400' },
    { label: 'Lesiones activas', value: activeIncidents.toString(), sub: 'jugadores afectados', icon: HeartPulse, color: activeIncidents > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Score Eval. Medio', value: evalAvg !== '—' ? `${evalAvg}/5` : '—', sub: 'Evaluaciones técnicas', icon: Star, color: 'text-yellow-400' },
  ];

  const handleExportPDF = () => {
    window.print();
    showToast('info', 'Abriendo vista de impresión del informe del equipo...');
  };

  const handleNotifyStaff = () => {
    showToast('success', 'Resumen de estado enviado al staff técnico');
  };

  const handleGenerateReport = async (playerId: string) => {
    if (!playerId) { showToast('warning', 'Selecciona un jugador'); return; }
    setGeneratingAI(playerId);
    setAiReport(null);
    try {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      const playerWellness = wellnessReports.filter(w => w.subjectId === playerId).slice(-7);
      const playerLoads = loadRecords.filter(l => l.subjectId === playerId).slice(-7);
      const playerEvals = evaluations.filter(e => e.subjectId === playerId);
      const playerIncidents = incidents.filter(i => i.subjectId === playerId && i.status === 'active');

      const context = `
Jugador: ${player.name} ${player.lastName || ''} | Dorsal: #${player.number} | Posición: ${player.position}
Últimos registros de wellness (7 días): ${playerWellness.map(w => `[${w.date}: Fat=${w.fatigue} Sue=${w.sleepQuality} Mus=${w.muscleSoreness} Est=${w.stressLevel} Ani=${w.mood}]`).join(', ')}
Cargas recientes: ${playerLoads.map(l => `${l.borgScale}×${l.durationMins}min=${l.sessionLoad}AU`).join(', ')}
Evaluaciones cualitativas: ${playerEvals.map(e => `[${e.season}: Tec=${e.evaluations.technical} Tac=${e.evaluations.tactical} Fis=${e.evaluations.physical} Act=${e.evaluations.behavioral}]`).join(', ')}
Lesiones activas: ${playerIncidents.map(i => i.type).join(', ') || 'Ninguna'}
      `.trim();

      const report = await generatePerformanceSummary(context);
      setAiReport(report);
    } catch { showToast('error', 'Error al generar el informe con IA'); }
    finally { setGeneratingAI(null); }
  };

  return (
    <div className="space-y-6">
      {/* KPIs reales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <kpi.icon size={18} className={cn(kpi.color, 'mb-3 opacity-70')} />
            <p className="text-2xl font-black text-white mb-1">{kpi.value}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
            <p className="text-[9px] text-slate-600 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Action buttons (FIXED) */}
      <div className="flex flex-wrap gap-3">
        <button onClick={handleExportPDF}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all uppercase tracking-wide">
          <Printer size={14} /> Exportar PDF
        </button>
        <button onClick={handleNotifyStaff}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all uppercase tracking-wide">
          <Bell size={14} /> Notificar Staff
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all uppercase tracking-wide">
          <Download size={14} /> Descargar Resumen
        </button>
      </div>

      {/* AI Report Generator */}
      <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <BrainCircuit size={20} className="text-emerald-500" />
          <div>
            <h3 className="font-black text-white text-sm">Informe Individual con IA</h3>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">Análisis de rendimiento personalizado generado por Gemini AI</p>
          </div>
        </div>
        <div className="flex gap-3 mb-4">
          <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
            <option value="">Seleccionar jugador...</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name} {p.lastName}</option>)}
          </select>
          <button onClick={() => handleGenerateReport(selectedPlayerId)} disabled={!!generatingAI || !selectedPlayerId}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 whitespace-nowrap">
            {generatingAI ? <><Loader2 size={14} className="animate-spin" />Analizando...</> : <><Sparkles size={14} />Generar Informe</>}
          </button>
        </div>
        {aiReport && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={10} /> Informe Generado por Gemini AI</span>
              <button onClick={() => setAiReport(null)} className="text-slate-600 hover:text-white"><X size={14} /></button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">{aiReport}</p>
          </motion.div>
        )}
      </div>

      {/* Top Scorer */}
      {topScorer && (
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 flex items-center gap-5">
          <div className="w-14 h-14 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center"><Star size={24} className="text-yellow-400" /></div>
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Máximo Anotador</p>
            <p className="text-xl font-black text-white">{topScorer.name}</p>
            <p className="text-sm text-yellow-400 font-bold">{topScorer.pts} pts/partido</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QUALITATIVE REPORTS VIEW  (FIXED: Ver Detalle / Editar / expandible)
// ─────────────────────────────────────────────────────────────────────────────

const QualitativeReportsView = ({
  reports, subjectId, onSave, currentUserId
}: {
  reports: QualitativeReport[]; subjectId: string;
  onSave: (r: QualitativeReport) => Promise<void>; currentUserId?: string;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tactical: 0, technical: 0, physical: 0, behavioral: 0, comments: '' });
  const [editForm, setEditForm] = useState<typeof form | null>(null);

  const handleSave = async () => {
    if ([form.tactical, form.technical, form.physical, form.behavioral].some(v => v === 0)) return;
    setSaving(true);
    const report: QualitativeReport = {
      id: '', teamId: '', subjectId, coachId: currentUserId || 'coach',
      date: new Date().toISOString().split('T')[0], season: '2025/26',
      comments: form.comments,
      evaluations: { tactical: form.tactical.toString(), technical: form.technical.toString(), physical: form.physical.toString(), behavioral: form.behavioral.toString() },
      overall: ((form.tactical + form.technical + form.physical + form.behavioral) / 4).toFixed(1),
    };
    try { await onSave(report); setIsAdding(false); setForm({ tactical: 0, technical: 0, physical: 0, behavioral: 0, comments: '' }); }
    finally { setSaving(false); }
  };

  const fieldLabels = [
    { key: 'technical', label: 'Técnica' }, { key: 'tactical', label: 'Táctica' },
    { key: 'behavioral', label: 'Actitud' }, { key: 'physical', label: 'Físico' },
  ] as const;

  const ScoreRow = ({ val, label }: { val: string | number; label: string }) => {
    const n = parseInt(String(val)) || 0;
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(v => (
            <div key={v} className={cn("w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black", v === n ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-600')}>{v}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Evaluaciones</h4>
        <button onClick={() => setIsAdding(!isAdding)}
          className="text-[9px] font-bold text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-xl hover:bg-emerald-500/10 transition-all flex items-center gap-1.5 uppercase tracking-wide">
          <Plus size={12} /> Nueva Evaluación
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {fieldLabels.map(f => (
                  <div key={f.key}>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">{f.label}</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setForm(prev => ({ ...prev, [f.key]: v }))}
                          className={cn("flex-1 h-9 rounded-lg text-sm font-black transition-all border", form[f.key] === v ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600')}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <textarea value={form.comments} onChange={e => setForm(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Comentarios del entrenador..." rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-emerald-500/50" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-emerald-500 text-slate-950 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {saving ? <><Loader2 size={12} className="animate-spin" />Guardando...</> : 'Finalizar Evaluación'}
                </button>
                <button onClick={() => setIsAdding(false)} className="px-5 bg-slate-800 text-white py-3 rounded-xl text-[9px] font-bold uppercase border border-slate-700 hover:bg-slate-700 transition-all">Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reports.length === 0 && !isAdding && (
        <div className="py-10 text-center bg-slate-950/30 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-600 font-mono uppercase">Sin evaluaciones registradas</p>
        </div>
      )}

      {reports.map(report => (
        <div key={report.id} className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/30 transition-colors" onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-600">{report.season} • {report.date}</span>
                {report.overall && <span className="text-xs font-black text-emerald-500">{parseFloat(report.overall).toFixed(1)}/5</span>}
              </div>
              {report.comments && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">"{report.comments}"</p>}
            </div>
            <ChevronDown size={16} className={cn("text-slate-600 transition-transform", expandedId === report.id && "rotate-180")} />
          </div>
          <AnimatePresence>
            {expandedId === report.id && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-slate-800">
                <div className="p-4 space-y-1">
                  <ScoreRow val={report.evaluations.technical || 0} label="Técnica Individual" />
                  <ScoreRow val={report.evaluations.tactical || 0} label="Comprensión Táctica" />
                  <ScoreRow val={report.evaluations.behavioral || 0} label="Actitud y Esfuerzo" />
                  <ScoreRow val={report.evaluations.physical || 0} label="Condición Física" />
                  {report.comments && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <p className="text-[9px] font-bold text-slate-500 uppercase mb-1.5">Comentarios</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{report.comments}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER DETAIL DASHBOARD  (FIXED: nueva incidencia inline, PDF impresión)
// ─────────────────────────────────────────────────────────────────────────────

const PlayerDetailDashboard = ({
  player, incidents, evaluations, testDefinitions, testResults,
  onBack, onAddIncident, onAddEvaluation, attendance, wellnessReports,
  loadRecords, sessions, matches, matchStats, onEditPlayer, currentUser, showToast
}: {
  player: Subject; incidents: HealthIncident[]; evaluations: QualitativeReport[];
  testDefinitions: TestDefinition[]; testResults: PhysicalTestResult[];
  onBack: () => void; onAddIncident: (i: Partial<HealthIncident>) => Promise<void>;
  onAddEvaluation: (e: QualitativeReport) => Promise<void>;
  attendance: AttendanceRecord[]; wellnessReports: WellnessReport[];
  loadRecords: LoadRecord[]; sessions: Session[]; matches: Match[]; matchStats: MatchStat[];
  onEditPlayer: (p: Subject) => void; currentUser: any;
  showToast: (t: ToastType, m: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState('bio');
  const [addingIncident, setAddingIncident] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ type: '', severity: 'medium' as const, date: new Date().toISOString().split('T')[0], notes: '' });
  const [savingIncident, setSavingIncident] = useState(false);

  // History data: load vs wellness per day
  const historyData = (() => {
    const dates = new Set([
      ...wellnessReports.filter(w => w.subjectId === player.id).map(w => w.date),
      ...sessions.map(s => s.date?.toString().split('T')[0] || ''),
    ]);
    return [...dates].map(date => {
      const wellness = wellnessReports.find(w => w.subjectId === player.id && w.date === date);
      const daySessions = sessions.filter(s => s.date?.toString().startsWith(date));
      const dayIds = new Set(daySessions.map(s => s.id));
      const dayLoad = loadRecords.filter(l => l.subjectId === player.id && dayIds.has(l.sessionId)).reduce((acc, l) => acc + (l.sessionLoad || 0), 0);
      const wellnessScore = wellness ? (wellness.fatigue + wellness.sleepQuality + wellness.muscleSoreness + wellness.stressLevel + wellness.mood) / 5 : null;
      return { date, load: dayLoad, wellness: wellnessScore ? +wellnessScore.toFixed(1) : null };
    }).filter(d => d.load > 0 || d.wellness !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-14);
  })();

  const playerAtt = attendance.filter(a => a.subjectId === player.id);
  const attRate = playerAtt.length > 0 ? Math.round((playerAtt.filter(a => a.status === 'present').length / playerAtt.length) * 100) : null;

  const latestWellness = wellnessReports.filter(w => w.subjectId === player.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const latestLoad = loadRecords.filter(l => l.subjectId === player.id).sort((a, b) => b.id.localeCompare(a.id))[0];
  const riskScore = latestWellness && latestLoad
    ? calculateRiskScore((latestWellness.fatigue + latestWellness.sleepQuality + latestWellness.muscleSoreness + latestWellness.stressLevel + latestWellness.mood) / 5, latestLoad.sessionLoad || 0)
    : null;
  const rc = riskScore !== null ? getRiskColor(riskScore) : null;

  const handleSaveIncident = async () => {
    if (!incidentForm.type) { showToast('warning', 'Introduce el tipo de lesión'); return; }
    setSavingIncident(true);
    try {
      await onAddIncident({ ...incidentForm, subjectId: player.id, status: 'active' });
      setAddingIncident(false);
      setIncidentForm({ type: '', severity: 'medium', date: new Date().toISOString().split('T')[0], notes: '' });
      showToast('success', 'Incidencia registrada para ' + player.name);
    } catch { showToast('error', 'Error al registrar la incidencia'); }
    finally { setSavingIncident(false); }
  };

  const handleExportPDF = () => {
    window.print();
    showToast('info', `Exportando ficha de ${player.name}...`);
  };

  const SUBTABS = [
    { id: 'bio', label: 'Perfil' }, { id: 'carga', label: 'Carga & ACWR' },
    { id: 'wellness_history', label: 'Wellness' },
    { id: 'physical', label: 'Físico' }, { id: 'evals', label: 'Evaluaciones' },
    { id: 'health', label: 'Salud' },
  ];

  const playerMatchStats = matchStats.filter(s => s.subjectId === player.id).map(s => ({ ...s, match: matches.find(m => m.id === s.matchId) })).filter(s => s.match).sort((a, b) => new Date(b.match!.date).getTime() - new Date(a.match!.date).getTime());
  const commonMetrics = ['PTS', 'MIN', 'VAL', 'REB', 'AST'];
  const seasonAvgs = commonMetrics.reduce((acc, m) => {
    const vals = playerMatchStats.map(s => parseFloat(String(s.stats[m] || 'x'))).filter(v => !isNaN(v));
    if (vals.length) acc[m] = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white shrink-0"><ChevronLeft size={20} /></button>
            <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-950 shrink-0">{player.name.charAt(0)}</div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-2xl font-black text-white tracking-tight">{player.name} {player.lastName}</h3>
                {rc && riskScore !== null && (
                  <span className={cn("text-[9px] font-black px-2.5 py-1 rounded-lg uppercase border", rc.bg.replace('bg-', 'bg-') + '/15', rc.text, rc.border)}>
                    {riskScore}% — {rc.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono uppercase mt-1">#{player.number} · {player.position} {attRate !== null && `· Asistencia: ${attRate}%`}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onEditPlayer(player)} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-400 transition-all flex items-center gap-1.5"><Edit2 size={12} /> Editar</button>
            <button onClick={handleExportPDF} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-bold uppercase text-slate-400 hover:text-white transition-all flex items-center gap-1.5"><Printer size={12} /> PDF</button>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-slate-800 bg-slate-950/20 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-max">
          {SUBTABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white hover:bg-slate-800")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 min-h-[350px]">
        {/* BIO */}
        {activeTab === 'bio' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[{ label: 'Nombre completo', value: `${player.name} ${player.lastName || ''}` }, { label: 'Fecha de nacimiento', value: player.birthDate || '—' }, { label: 'DNI / DNA ID', value: player.dnaId || '—' }, { label: 'Posición', value: player.position || '—' }, { label: 'Contacto / Email', value: player.contact || '—' }].map(f => (
                <div key={f.label}>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">{f.label}</p>
                  <p className="text-sm text-white font-medium">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-3">Asistencia histórica</p>
                {attRate !== null ? (
                  <>
                    <div className="flex items-end gap-1 h-10 mb-2">
                      {playerAtt.slice(-10).map((a, i) => (
                        <div key={i} className={cn("flex-1 rounded-t", a.status === 'present' ? 'bg-emerald-500 h-full' : a.status === 'late' ? 'bg-yellow-500 h-1/2' : 'bg-red-500 h-1/4')} />
                      ))}
                    </div>
                    <p className="text-right text-[9px] font-bold text-slate-500">{attRate}% presencia ({playerAtt.length} sesiones)</p>
                  </>
                ) : <p className="text-xs text-slate-700 italic">Sin registros de asistencia</p>}
              </div>
              {riskScore !== null && rc && (
                <div className={cn("border rounded-2xl p-4", rc.border, 'bg-slate-950')}>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Riesgo actual</p>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-2xl font-black", rc.text)}>{riskScore}%</span>
                    <span className={cn("text-xs font-black uppercase px-2.5 py-1 rounded-lg border", rc.text, rc.border, rc.bg + '/15')}>{rc.label}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className={cn("h-full rounded-full", rc.bg)} style={{ width: `${riskScore}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CARGA & ACWR */}
        {activeTab === 'carga' && (() => {
          const playerACWR = calculateACWR(loadRecords, sessions, player.id);
          const acwrCol = playerACWR !== null ? acwrColor(playerACWR) : null;

          // Últimas 4 semanas de carga diaria
          const last28: { date: string; load: number }[] = Array.from({ length: 28 }, (_, i) => {
            const d = new Date(Date.now() - (27 - i) * 86400000).toISOString().split('T')[0];
            const dayIds = new Set(sessions.filter(s => s.date?.toString().startsWith(d)).map(s => s.id));
            const load = loadRecords
              .filter(l => l.subjectId === player.id && dayIds.has(l.sessionId))
              .reduce((acc, l) => acc + (l.sessionLoad || 0), 0);
            return { date: d, load };
          });

          // Streak de presencia consecutiva (sesiones con asistencia o carga)
          const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
          let streak = 0;
          for (const s of sortedSessions) {
            const hasLoad = loadRecords.some(l => l.subjectId === player.id && l.sessionId === s.id && (l.sessionLoad || 0) > 0);
            const hasAtt = attendance.some(a => a.subjectId === player.id && a.sessionId === s.id && a.status === 'present');
            if (hasLoad || hasAtt) streak++;
            else break;
          }

          // Últimas 8 sesiones con estado
          const recentSess = sortedSessions.slice(0, 8).map(s => {
            const att = attendance.find(a => a.subjectId === player.id && a.sessionId === s.id);
            const load = loadRecords.find(l => l.subjectId === player.id && l.sessionId === s.id);
            return { session: s, att, load };
          });

          return (
            <div className="space-y-5">
              {/* ACWR + streak cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className={cn("border rounded-2xl p-4", acwrCol ? acwrCol.border : 'border-slate-800', 'bg-slate-950')}>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">ACWR Actual</p>
                  {playerACWR !== null && acwrCol ? (
                    <>
                      <p className={cn("text-2xl font-black", acwrCol.text)}>{playerACWR.toFixed(2)}</p>
                      <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-lg uppercase border mt-1 inline-block", acwrCol.bg, acwrCol.text, acwrCol.border)}>{acwrCol.label}</span>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 italic">Sin datos (≥28d)</p>
                  )}
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Carga Aguda (7d)</p>
                  <p className="text-2xl font-black text-white">{last28.slice(-7).reduce((a, d) => a + d.load, 0)}<span className="text-xs text-slate-500 ml-1">AU</span></p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 col-span-2 md:col-span-1">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Racha Activa</p>
                  <p className="text-2xl font-black text-white">{streak}<span className="text-xs text-slate-500 ml-1">sesiones</span></p>
                </div>
              </div>

              {/* Mini-gráfico carga 28d */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Carga últimas 4 semanas (AU)</p>
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last28} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" fontSize={7} axisLine={false} tickLine={false} stroke="#475569"
                        tickFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}
                        interval={6} />
                      <YAxis fontSize={8} axisLine={false} tickLine={false} stroke="#475569" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '10px' }}
                        formatter={(v: any) => [`${v} AU`, 'Carga']}
                        labelFormatter={l => new Date(l + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} />
                      <Bar dataKey="load" radius={[3, 3, 0, 0]}>
                        {last28.map((d, i) => (
                          <Cell key={i} fill={d.load === 0 ? '#1e293b' : d.load > 400 ? '#ef4444' : d.load > 250 ? '#eab308' : '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  {[{ col: '#10b981', label: '≤250 AU' }, { col: '#eab308', label: '251–400 AU' }, { col: '#ef4444', label: '>400 AU' }].map(z => (
                    <span key={z.label} className="flex items-center gap-1.5 text-[9px] text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: z.col }} />{z.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Últimas sesiones */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-4 py-3 border-b border-slate-800">Últimas sesiones</p>
                {recentSess.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-600 italic">Sin sesiones registradas</p>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {recentSess.map(({ session, att, load }) => {
                      const status = load && (load.sessionLoad || 0) > 0 ? 'done' : att ? 'present' : 'absent';
                      return (
                        <div key={session.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-xs font-bold text-white">{session.title || 'Sesión'}</p>
                            <p className="text-[9px] font-mono text-slate-500 mt-0.5">{new Date(session.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {load && (load.sessionLoad || 0) > 0 && (
                              <span className="text-[10px] font-mono text-slate-400">{load.sessionLoad} AU · RPE {load.borgScale}</span>
                            )}
                            <span className={cn("text-[8px] font-black px-2 py-1 rounded-lg uppercase border",
                              status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              status === 'present' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              'bg-slate-800 text-slate-500 border-slate-700')}>
                              {status === 'done' ? '✓ RPE' : status === 'present' ? 'Presente' : att?.status === 'absent' ? 'Ausente' : att?.status === 'late' ? 'Tarde' : att?.status === 'justified' ? 'Justif.' : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* WELLNESS HISTORY */}
        {activeTab === 'wellness_history' && (
          <div className="space-y-5">
            {historyData.length > 0 && (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={historyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" fontSize={8} axisLine={false} tickLine={false} stroke="#475569" />
                    <YAxis yAxisId="left" fontSize={8} axisLine={false} tickLine={false} stroke="#475569" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 5]} fontSize={8} axisLine={false} tickLine={false} stroke="#475569" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
                    <Bar yAxisId="left" dataKey="load" fill="#10b981" fillOpacity={0.4} radius={[3, 3, 0, 0]} name="Carga AU" />
                    <Line yAxisId="right" type="monotone" dataKey="wellness" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} name="Wellness /5" connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left">
                <thead className="bg-slate-950/60 text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    {['Humor', 'Dolor', 'Fatiga', 'Estrés', 'Sueño', 'Avg/5'].map(h => <th key={h} className="px-3 py-3 text-center">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {wellnessReports.filter(w => w.subjectId === player.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((w, i) => {
                    const avg = ((w.fatigue + w.sleepQuality + w.muscleSoreness + w.stressLevel + w.mood) / 5).toFixed(1);
                    return (
                      <tr key={i} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-2.5 text-[10px] font-mono text-slate-500">{w.date}</td>
                        {[w.mood, w.muscleSoreness, w.fatigue, w.stressLevel, w.sleepQuality].map((v, j) => (
                          <td key={j} className="px-3 py-2.5 text-center"><span className={cn("w-7 h-7 flex items-center justify-center mx-auto rounded-lg text-xs font-black", getWellnessColor(v))}>{v}</span></td>
                        ))}
                        <td className="px-3 py-2.5 text-center text-xs font-black text-white">{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PHYSICAL */}
        {activeTab === 'physical' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testDefinitions.map(test => {
                const latest = testResults.filter(r => r.testId === test.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                return (
                  <div key={test.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-emerald-500/20 transition-all">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2">{test.name}</p>
                    {latest ? (
                      <><p className="text-2xl font-black text-white">{latest.value}<span className="text-xs text-slate-500 ml-1">{test.unit}</span></p><p className="text-[9px] text-slate-700 font-mono mt-1">Último: {latest.date}</p></>
                    ) : <p className="text-sm text-slate-700 italic">Sin registros</p>}
                  </div>
                );
              })}
              {testDefinitions.length === 0 && <div className="col-span-3 py-12 text-center"><p className="text-sm text-slate-600 italic">No hay tests definidos</p></div>}
            </div>
          </div>
        )}

        {/* EVALS */}
        {activeTab === 'evals' && (
          <QualitativeReportsView reports={evaluations} subjectId={player.id} onSave={onAddEvaluation} currentUserId={currentUser?.id} />
        )}


        {/* HEALTH — FIXED: inline form for new incident */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historial médico</h4>
              <button onClick={() => setAddingIncident(!addingIncident)}
                className="text-[9px] font-bold text-red-400 border border-red-500/20 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-all flex items-center gap-1.5 uppercase">
                <Plus size={12} /> Nueva Incidencia
              </button>
            </div>

            <AnimatePresence>
              {addingIncident && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="bg-slate-950 border border-red-500/20 rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Tipo de lesión</label>
                        <input value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value})} placeholder="Tobillo, rodilla..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/40" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Severidad</label>
                        <select value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as any})}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/40">
                          <option value="low">Leve</option><option value="medium">Moderada</option><option value="high">Alta</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Fecha</label>
                        <input type="date" value={incidentForm.date} onChange={e => setIncidentForm({...incidentForm, date: e.target.value})}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Notas</label>
                        <input value={incidentForm.notes} onChange={e => setIncidentForm({...incidentForm, notes: e.target.value})} placeholder="Mecanismo, zona..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveIncident} disabled={savingIncident}
                        className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60">
                        {savingIncident ? <><Loader2 size={12} className="animate-spin" />Guardando...</> : 'Registrar'}
                      </button>
                      <button onClick={() => setAddingIncident(false)} className="px-4 bg-slate-800 text-white py-2.5 rounded-xl text-[9px] font-bold uppercase border border-slate-700 hover:bg-slate-700">Cancelar</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {incidents.length === 0 ? (
              <div className="py-12 text-center bg-slate-950/30 border border-dashed border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-600 font-mono">Sin historial médico registrado</p>
              </div>
            ) : incidents.map(inc => (
              <div key={inc.id} className={cn("border rounded-xl p-4 flex items-center justify-between", inc.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950 border-slate-800')}>
                <div>
                  <p className={cn("text-sm font-bold", inc.severity === 'high' ? 'text-red-400' : 'text-white')}>{inc.type}</p>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">{inc.date} · {inc.severity} · {inc.notes || 'sin notas'}</p>
                </div>
                <span className={cn("text-[8px] font-black px-2 py-1 rounded-lg uppercase border", inc.status === 'active' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>{inc.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICAL TESTS VIEW
// ─────────────────────────────────────────────────────────────────────────────

const PhysicalTestsView = ({
  subjects, teamId, testDefinitions, testResults, onSaveBulk, showToast
}: {
  subjects: Subject[]; teamId: string; testDefinitions: TestDefinition[];
  testResults: PhysicalTestResult[];
  onSaveBulk: (d: any[]) => Promise<void>; showToast: (t: ToastType, m: string) => void;
}) => {
  type TestView = 'registro' | 'comparativa' | 'informe';
  const [activeView, setActiveView] = useState<TestView>('registro');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [compareTestId, setCompareTestId] = useState('');
  const players = subjects.filter(s => s.role === Role.PLAYER);
  const selectedTest = testDefinitions.find(t => t.id === selectedTestId);

  const handleSave = async () => {
    if (!selectedTestId) { showToast('warning', 'Selecciona un test'); return; }
    const payloads = Object.entries(values)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([sid, v]) => ({
        team_id: teamId, subject_id: sid, test_id: selectedTestId,
        date, value: parseFloat(v), notes: notes[sid] || '',
      }));
    if (!payloads.length) { showToast('warning', 'Introduce al menos un resultado'); return; }
    setSaving(true);
    try { await onSaveBulk(payloads); setValues({}); setNotes({}); showToast('success', `${payloads.length} resultados guardados`); }
    catch { showToast('error', 'Error al guardar los resultados'); }
    finally { setSaving(false); }
  };

  // ── Report computation ─────────────────────────────────────────────────────
  const reportData = useMemo(() => {
    return testDefinitions.map(test => {
      const results = testResults
        .filter(r => r.testId === test.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      // Only latest result per player
      const latestPerPlayer: Record<string, PhysicalTestResult> = {};
      results.forEach(r => { if (!latestPerPlayer[r.subjectId]) latestPerPlayer[r.subjectId] = r; });
      const entries = Object.values(latestPerPlayer);
      if (entries.length === 0) return { test, entries: [], avg: 0, max: 0, min: 0, interpretation: '' };
      const vals = entries.map(e => Number(e.value));
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const dispersion = avg > 0 ? ((max - min) / avg * 100).toFixed(0) : '0';
      const aboveAvg = vals.filter(v => v >= avg).length;
      const bestEntry = entries.find(e => Number(e.value) === max);
      const worstEntry = entries.find(e => Number(e.value) === min);
      const bestPlayer = subjects.find(s => s.id === bestEntry?.subjectId);
      const worstPlayer = subjects.find(s => s.id === worstEntry?.subjectId);
      const dispNum = parseFloat(dispersion);
      const homogeneity = dispNum < 15 ? 'El grupo es muy homogéneo: todos los jugadores rinden de forma similar.' : dispNum < 30 ? 'Hay diferencias moderadas entre jugadores — revisar los que están por debajo de la media.' : 'El grupo es muy heterogéneo. Se recomienda trabajar con planes individualizados.';
      const participation = `${entries.length} de ${players.length} jugador${players.length !== 1 ? 'es evaluados' : ' evaluado'}.`;
      const interpretation = `Media del equipo: ${avg.toFixed(2)} ${test.unit}. Rango: ${min} – ${max} ${test.unit} (dispersión ${dispersion}%). ${homogeneity} ${participation}`;
      return { test, entries: entries.map(e => ({ ...e, player: subjects.find(s => s.id === e.subjectId) })), avg, max, min, bestPlayer, worstPlayer, interpretation };
    }).filter(d => d.entries.length > 0);
  }, [testDefinitions, testResults, subjects, players]);

  // ── View header shared across all sub-views ──────────────────────────────
  const viewHeader = (
    <div className="flex items-center gap-2 flex-wrap">
      {([
        { id: 'registro', label: '📝 Registro' },
        { id: 'comparativa', label: '📊 Comparativa' },
        { id: 'informe', label: '🧠 Informe' },
      ] as { id: TestView; label: string }[]).map(v => (
        <button key={v.id} onClick={() => setActiveView(v.id)}
          className={cn('px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all',
            activeView === v.id
              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
              : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300')}>
          {v.label}
        </button>
      ))}
    </div>
  );

  if (activeView === 'comparativa') {
    const compareTest = testDefinitions.find(t => t.id === compareTestId);
    // Build per-player history for selected test, sorted newest first
    const playerHistory = players.map(p => {
      const results = (testResults as any[])
        .filter(r => r.testId === compareTestId && r.subjectId === p.id)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const last = results[0] || null;
      const prev = results[1] || null;
      const delta = last && prev ? Number(last.value) - Number(prev.value) : null;
      const lowerIsBetter = (BASKETBALL_TEST_BATTERY.find(t => t.name === compareTest?.name) as any)?.lowerIsBetter ?? false;
      const improved = delta !== null ? (lowerIsBetter ? delta < 0 : delta > 0) : null;
      return { player: p, last, prev, delta, improved };
    }).filter(d => d.last !== null);

    return (
      <div className="space-y-5">
        {viewHeader}
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Selecciona el test a comparar</label>
            <select value={compareTestId} onChange={e => setCompareTestId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
              <option value="">Elige un test...</option>
              {testDefinitions.map(t => <option key={t.id} value={t.id}>{t.name} ({t.unit})</option>)}
            </select>
          </div>

          {compareTestId && playerHistory.length === 0 && (
            <div className="py-10 text-center text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-2xl">
              Sin resultados registrados para este test todavía.
            </div>
          )}

          {compareTestId && playerHistory.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left">
                <thead className="bg-slate-950/60 text-[8px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Jugador</th>
                    <th className="px-4 py-3">Última medición</th>
                    <th className="px-4 py-3">Medición anterior</th>
                    <th className="px-4 py-3">Variación</th>
                    <th className="px-4 py-3">Anotación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {[...playerHistory].sort((a, b) => Number(b.last?.value || 0) - Number(a.last?.value || 0)).map(({ player, last, prev, delta, improved }) => (
                    <tr key={player.id} className="hover:bg-slate-950/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-slate-800 rounded-lg flex items-center justify-center text-[9px] font-mono text-slate-500">
                            {player.number || '—'}
                          </span>
                          <span className="text-sm font-bold text-white">{player.name} {player.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-black text-emerald-400">{last?.value} <span className="text-[9px] text-slate-600 font-normal">{compareTest?.unit}</span></p>
                        <p className="text-[9px] text-slate-600 mt-0.5">{last ? new Date(last.date).toLocaleDateString('es-ES') : '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {prev ? (
                          <>
                            <p className="text-sm text-slate-400">{prev.value} <span className="text-[9px] text-slate-600">{compareTest?.unit}</span></p>
                            <p className="text-[9px] text-slate-600 mt-0.5">{new Date(prev.date).toLocaleDateString('es-ES')}</p>
                          </>
                        ) : <span className="text-[10px] text-slate-700 italic">Primera medición</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {delta !== null ? (
                          <div className={cn('flex items-center gap-1 font-black text-sm',
                            improved ? 'text-emerald-400' : improved === false ? 'text-red-400' : 'text-slate-500')}>
                            {improved ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
                          </div>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px]">
                        {(last as any)?.notes ? (
                          <div className="flex items-start gap-1.5">
                            <span className="text-[10px] shrink-0">📌</span>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{(last as any).notes}</p>
                          </div>
                        ) : <span className="text-slate-700 text-[10px] italic">Sin anotación</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'informe') return (
    <div className="space-y-6">
      {viewHeader}
      {/* Report header */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Informe de Condición Física</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Evaluación del equipo · {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {reportData.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[28px]">
          <Dumbbell className="mx-auto text-slate-700 mb-4" size={40} />
          <p className="text-slate-500 font-bold">Sin datos suficientes</p>
          <p className="text-slate-600 text-sm mt-1">Registra resultados de tests físicos para generar el informe.</p>
        </div>
      ) : reportData.map(({ test, entries, avg, max, min, bestPlayer, worstPlayer, interpretation }) => (
        <div key={test.id} className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
          {/* Test title bar */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-black text-white text-lg">{test.name}</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">{test.unit}</p>
            </div>
            {/* KPI chips */}
            <div className="flex gap-3 flex-wrap">
              {[
                { label: 'Media', value: avg.toFixed(2), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Máximo', value: String(max), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Mínimo', value: String(min), color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
              ].map(k => (
                <div key={k.label} className={cn('px-4 py-2 rounded-xl border text-center', k.bg)}>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest">{k.label}</p>
                  <p className={cn('text-xl font-black', k.color)}>{k.value}</p>
                  <p className="text-[8px] text-slate-600">{test.unit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Player bars */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4">Resultado por jugador</p>
            {[...entries].sort((a, b) => Number(b.value) - Number(a.value)).map(entry => {
              const val = Number(entry.value);
              const pct = max > 0 ? (val / max) * 100 : 0;
              const isAboveAvg = val >= avg;
              const isBest = val === max;
              const isWorst = val === min && entries.length > 1;
              return (
                <div key={entry.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-mono text-slate-500">
                        {entry.player?.number || '—'}
                      </span>
                      <span className="font-bold text-white">{entry.player?.name} {entry.player?.lastName}</span>
                      {isBest && <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">⬆ Mejor</span>}
                      {isWorst && <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">⬇ Menor</span>}
                    </div>
                    <span className={cn('font-black text-sm', isBest ? 'text-emerald-400' : isWorst ? 'text-blue-400' : isAboveAvg ? 'text-emerald-400' : 'text-slate-400')}>
                      {val} <span className="text-[9px] text-slate-600 font-normal">{test.unit}</span>
                    </span>
                  </div>
                  <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                    {/* Average marker */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-10" style={{ left: `${max > 0 ? (avg / max) * 100 : 50}%` }} />
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', isBest ? 'bg-emerald-500' : isAboveAvg ? 'bg-emerald-500' : 'bg-blue-500')} />
                  </div>
                </div>
              );
            })}
            {/* Legend */}
            <div className="flex items-center gap-4 pt-2 text-[8px] text-slate-600">
              <div className="flex items-center gap-1"><div className="w-0.5 h-3 bg-slate-600 rounded" /> Media del equipo</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-emerald-500" /> Por encima</div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-blue-500" /> Por debajo</div>
            </div>
          </div>

          {/* Interpretation */}
          <div className="mx-6 mb-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <BrainCircuit size={11} /> Análisis del entrenador
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{interpretation}</p>
            {bestPlayer && <p className="text-xs text-slate-500 mt-2">🏆 Destacado: <span className="text-white font-bold">{bestPlayer.name} {bestPlayer.lastName}</span> con {max} {test.unit}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  // Default: registro view
  return (
    <div className="space-y-5">
      {viewHeader}

      {/* Control bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-5 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Test a evaluar</label>
          <select value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50">
            <option value="">Seleccionar test...</option>
            {testDefinitions.map(t => <option key={t.id} value={t.id}>{t.name} ({t.unit})</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50" />
        </div>
        <button onClick={handleSave} disabled={saving || !selectedTestId} className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 whitespace-nowrap">
          {saving ? <><Loader2 size={14} className="animate-spin" />Guardando...</> : <><Save size={14} />Guardar</>}
        </button>
      </div>

      {testDefinitions.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-slate-900 rounded-[28px]">
          <Dumbbell className="mx-auto text-slate-800 mb-3" size={36} />
          <p className="text-slate-600 text-sm">Crea un test usando el botón "+ Test" arriba</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 text-[8px] font-bold text-slate-600 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Jugador</th>
                <th className="px-5 py-3">Resultado ({selectedTest?.unit || '—'})</th>
                <th className="px-5 py-3">Anotación <span className="text-slate-700 font-normal normal-case">(lesión, molestia, contexto…)</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {players.map(p => (
                <tr key={p.id} className="hover:bg-slate-950/30 transition-colors">
                  <td className="px-5 py-3 text-[10px] font-mono text-slate-600">#{p.number}</td>
                  <td className="px-5 py-3 font-bold text-sm text-white whitespace-nowrap">{p.name} {p.lastName}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <input type="number" step="0.01" placeholder="0.00" disabled={!selectedTestId} value={values[p.id] || ''}
                        onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40 disabled:opacity-40" />
                      {selectedTest && <span className="text-xs text-slate-600">{selectedTest.unit}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <input type="text" placeholder="Ej: Venía de esguince, molestia rodilla..." disabled={!selectedTestId} value={notes[p.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full min-w-[180px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40 disabled:opacity-40 placeholder:text-slate-700" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE VIEW  (FIXED: "Configuración" → panel funcional)
// ─────────────────────────────────────────────────────────────────────────────

const ProfileView = ({
  onLogout, currentUser, activeTeam, showToast
}: {
  onLogout: () => void; currentUser: any; activeTeam: Team | null; showToast: (t: ToastType, m: string) => void;
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [notifWellness, setNotifWellness] = useState(true);
  const [notifRisk, setNotifRisk] = useState(true);
  const [notifMatch, setNotifMatch] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile card */}
      <div className="bg-slate-900 border border-slate-800 rounded-[28px] p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center text-3xl font-black text-slate-950 shadow-xl shadow-emerald-500/20">
          {(currentUser?.name || currentUser?.email || 'C').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-black text-white tracking-tight mb-1">{currentUser?.name || currentUser?.email?.split('@')[0] || 'Entrenador'}</h2>
          <p className="text-sm text-slate-500 font-mono mb-4">{currentUser?.email || 'sesión local'}</p>
          <div className="flex gap-3 flex-wrap justify-center md:justify-start">
            <button onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white hover:bg-slate-700 transition-all uppercase tracking-wide">
              <Settings size={14} /> Configuración
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/20 transition-all uppercase tracking-wide">
              <LogOut size={14} /> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-slate-900 border border-slate-800 rounded-[28px] p-6 space-y-5">
            <h3 className="font-black text-white flex items-center gap-2"><Settings size={18} className="text-emerald-500" /> Configuración</h3>

            {/* Notifications */}
            <div className="space-y-3">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Notificaciones del sistema</p>
              {[
                { label: 'Alertas de Wellness no registrado', desc: 'Aviso cuando hay jugadores sin wellness hoy', value: notifWellness, set: setNotifWellness },
                { label: 'Alertas de Riesgo alto', desc: 'Notificación cuando un jugador supera 75% de riesgo', value: notifRisk, set: setNotifRisk },
                { label: 'Recordatorios de partido', desc: '24h antes de cada partido programado', value: notifMatch, set: setNotifMatch },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{n.label}</p>
                    <p className="text-[10px] text-slate-500">{n.desc}</p>
                  </div>
                  <button onClick={() => { n.set(!n.value); showToast('info', `${n.label}: ${!n.value ? 'activado' : 'desactivado'}`); }}
                    className={cn("w-11 h-6 rounded-full transition-all relative", n.value ? "bg-emerald-500" : "bg-slate-700")}>
                    <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm", n.value ? "right-0.5" : "left-0.5")} />
                  </button>
                </div>
              ))}
            </div>

            {/* Account info */}
            <div className="space-y-2 pt-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Cuenta</p>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                {[{ label: 'Email', value: currentUser?.email || '—' }, { label: 'User ID', value: currentUser?.id?.slice(0, 16) + '...' || 'LOCAL' }, { label: 'Equipo activo', value: activeTeam?.name || '—' }, { label: 'Modo', value: isSupabaseConfigured ? 'Cloud (Supabase)' : 'Local' }].map(r => (
                  <div key={r.label} className="flex justify-between items-center py-1 border-b border-slate-800/50 last:border-0">
                    <span className="text-xs text-slate-500">{r.label}</span>
                    <span className="text-xs font-mono text-white">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => { showToast('success', 'Configuración guardada'); setShowSettings(false); }}
              className="w-full bg-emerald-500 text-slate-950 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
              Guardar Cambios
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App info */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-[24px] p-6 flex items-center gap-4">
        <BrainCircuit size={32} className="text-emerald-500 opacity-30 shrink-0" />
        <div>
          <p className="text-xs font-bold text-slate-400">Sports Management Hub v2.5 Pro</p>
          <p className="text-[10px] text-slate-600 mt-1">"La excelencia no es un acto, sino un hábito." — Aristóteles</p>
          <p className="text-[9px] text-slate-700 mt-2 font-mono">React 19 + Supabase + Gemini AI · GDPR / LOPD compliant</p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER DASHBOARD VIEW  (vista del jugador cuando hace login)
// ─────────────────────────────────────────────────────────────────────────────

const PlayerDashboardView = ({
  player, incidents, evaluations, onLogout
}: {
  player: Subject; incidents: HealthIncident[]; evaluations: QualitativeReport[]; onLogout: () => void;
}) => (
  <div className="min-h-screen bg-slate-950 p-6">
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-slate-950">{player.name.charAt(0)}</div>
          <div>
            <p className="font-black text-white">Hola, {player.name}</p>
            <p className="text-[10px] text-slate-500 font-mono uppercase">Panel del Jugador</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-1.5"><LogOut size={13} /> Salir</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Mis Evaluaciones</h3>
          <QualitativeReportsView reports={evaluations} subjectId={player.id} onSave={async () => {}} />
        </div>
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Salud</h3>
            {incidents.length > 0 ? incidents.map(i => (
              <div key={i.id} className="py-2 border-b border-slate-800 last:border-0">
                <p className="text-sm font-bold text-white">{i.type}</p>
                <p className="text-[10px] text-slate-500">{i.status} · {i.date}</p>
              </div>
            )) : <p className="text-sm text-slate-600 italic">Sin lesiones activas</p>}
          </div>
        </div>
      </div>
    </div>
  </div>
);


// ─────────────────────────────────────────────────────────────────────────────
// AGENDA VIEW — Vista multi-equipo consolidada (vista del entrenador)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PREP. FÍSICA VIEW — Reference panel for training methodology
// ─────────────────────────────────────────────────────────────────────────────

const PrepFisicaView = ({
  teamId, testDefinitions, onAddTestDefinition, showToast
}: {
  teamId?: string;
  testDefinitions: TestDefinition[];
  onAddTestDefinition: (def: { name: string; unit: string }) => Promise<void>;
  showToast: (t: ToastType, m: string) => void;
}) => {
  type PTab = 'objetivos' | 'zonas' | 'fuerza' | 'categorias' | 'tests' | 'prevencion';
  const [activeTab, setActiveTab] = useState<PTab>('objetivos');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedForce, setSelectedForce] = useState<string>('fmaxima');
  const [selectedCategory, setSelectedCategory] = useState<string>('cadete');
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [testCategoryFilter, setTestCategoryFilter] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  const selectedCycle = FORCE_CYCLES.find(c => c.id === selectedForce) || FORCE_CYCLES[2];
  const goalDetail = TRAINING_GOALS.find(g => g.id === selectedGoal);
  const catDetail = PLAYER_CATEGORIES.find(c => c.id === selectedCategory);

  const handleSeedTests = async () => {
    if (!teamId) { showToast('warning', 'Selecciona un equipo primero'); return; }
    setSeeding(true);
    let count = 0;
    for (const test of BASKETBALL_TEST_BATTERY) {
      const exists = testDefinitions.some(d => d.name.toLowerCase() === test.name.toLowerCase());
      if (!exists) { try { await onAddTestDefinition({ name: test.name, unit: test.unit }); count++; } catch { /* skip */ } }
    }
    showToast('success', count > 0 ? `${count} tests añadidos al equipo` : 'Ya tienes todos los tests de la batería');
    setSeeding(false);
  };

  const TABS: { id: PTab; label: string }[] = [
    { id: 'objetivos',   label: '🎯 Objetivos' },
    { id: 'zonas',       label: '⚡ Zonas & Métodos' },
    { id: 'fuerza',      label: '💪 Fuerza' },
    { id: 'categorias',  label: '👥 Categorías' },
    { id: 'prevencion',  label: '🛡️ Prevención' },
    { id: 'tests',       label: '📐 Tests' },
  ];

  const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('bg-slate-900 border border-slate-800 rounded-[20px] p-5', className)}>{children}</div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-[20px] px-6 py-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Preparación Física</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-lg">
            Guía práctica para hacer mejores jugadores. Desde los objetivos hasta el protocolo exacto de cada test.
          </p>
        </div>
        <div className="shrink-0 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <Zap size={22} className="text-emerald-500" />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-0.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('flex-1 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap',
              activeTab === t.id ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-slate-800')}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {/* ─── OBJETIVOS ─── */}
          {activeTab === 'objetivos' && (
            <div className="space-y-4">
              <SectionCard>
                <p className="text-sm font-bold text-white mb-1">¿Qué quieres conseguir con tus jugadores?</p>
                <p className="text-xs text-slate-500">Selecciona un objetivo y te diremos exactamente cómo entrenar para conseguirlo.</p>
              </SectionCard>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {TRAINING_GOALS.map(g => (
                  <button key={g.id} onClick={() => setSelectedGoal(selectedGoal === g.id ? null : g.id)}
                    className={cn('rounded-[20px] border p-5 text-left transition-all space-y-2',
                      selectedGoal === g.id
                        ? cn('shadow-lg', g.color.bg, g.color.border, 'ring-1', g.color.border)
                        : 'bg-slate-900 border-slate-800 hover:border-slate-600')}>
                    <div className="text-2xl">{g.emoji}</div>
                    <p className={cn('font-black text-sm', selectedGoal === g.id ? g.color.text : 'text-white')}>{g.title}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{g.subtitle}</p>
                  </button>
                ))}
              </div>

              {/* Goal detail */}
              {goalDetail && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={cn('rounded-[24px] border p-6 space-y-5', goalDetail.color.bg, goalDetail.color.border)}>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{goalDetail.emoji}</div>
                    <div>
                      <h3 className={cn('text-xl font-black', goalDetail.color.text)}>{goalDetail.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">{goalDetail.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-950/60 rounded-xl p-4">
                      <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-2">Sistema energético</p>
                      <p className={cn('text-xs font-black', goalDetail.color.text)}>{goalDetail.zoneName}</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-xl p-4">
                      <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-2">Frecuencia</p>
                      <p className="text-xs font-black text-white">{goalDetail.prescription.frequency}</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-xl p-4">
                      <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-2">Duración del bloque</p>
                      <p className="text-xs font-black text-white">{goalDetail.prescription.duration}</p>
                    </div>
                  </div>

                  {/* Session template */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Estructura de sesión recomendada</p>
                    <div className="space-y-2">
                      {goalDetail.prescription.structure.map((block, i) => (
                        <div key={i} className="flex items-start gap-3 bg-slate-950/40 rounded-xl p-3">
                          <div className={cn('shrink-0 text-[9px] font-black px-2 py-1 rounded-lg', goalDetail.color.badge)}>{block.time}</div>
                          <p className="text-xs text-slate-300 leading-relaxed">{block.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key principle */}
                  <div className="bg-slate-950/60 rounded-xl p-4 border-l-2 border-emerald-500">
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Principio clave</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{goalDetail.prescription.keyPrinciple}</p>
                  </div>

                  {/* Mistake */}
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1">⚠️ Error frecuente</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{goalDetail.prescription.mistake}</p>
                  </div>

                  {/* Tests to track */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tests para medir progreso</p>
                    <div className="flex flex-wrap gap-2">
                      {goalDetail.keyTests.map(t => (
                        <button key={t} onClick={() => { setActiveTab('tests'); setExpandedTest(t); }}
                          className={cn('text-[9px] font-bold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80', goalDetail.color.badge, goalDetail.color.border)}>
                          {t} →
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ─── ZONAS & MÉTODOS ─── */}
          {activeTab === 'zonas' && (
            <div className="space-y-4">
              <SectionCard>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  El baloncesto exige los <span className="text-white font-semibold">tres sistemas energéticos</span> dependiendo de la duración e intensidad.
                  La FC nunca debe bajar de <span className="text-emerald-400 font-bold">110 ppm</span>; zona objetivo en entrenamiento: <span className="text-emerald-400 font-bold">160–195 ppm</span>.
                </p>
              </SectionCard>

              {METABOLIC_ZONES.map(z => (
                <div key={z.id} className={cn('rounded-[20px] border p-5 space-y-4', z.color.bg, z.color.border)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className={cn('font-black text-base', z.color.text)}>{z.label}</h3>
                      <span className="text-[9px] font-mono text-slate-600 uppercase">{z.short}</span>
                    </div>
                    <span className={cn('text-[9px] font-black px-3 py-1.5 rounded-lg uppercase', z.color.badge)}>
                      Trabajo:Descanso = {z.workRest}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{z.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Duración esfuerzo', val: z.duration },
                      { label: 'Recuperación', val: z.rest },
                      { label: 'FC objetivo', val: z.hr },
                      { label: 'Intensidad', val: z.intensity },
                    ].map(kv => (
                      <div key={kv.label} className="bg-slate-950/50 rounded-xl p-3">
                        <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">{kv.label}</p>
                        <p className={cn('text-sm font-black mt-1', z.color.text)}>{kv.val}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-600 uppercase font-bold mb-2">Ejercicios tipo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {z.examples.map(ex => (
                        <span key={ex} className="text-[9px] px-2 py-1 rounded-lg bg-slate-800/70 text-slate-400 border border-slate-700/40">{ex}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Methods table */}
              <SectionCard className="space-y-4">
                <h3 className="font-black text-white text-sm">Métodos de entrenamiento</h3>
                {[
                  { name: 'Continuo Extensivo', zone: 'Aeróbico', work: '30 min – 2 h', rest: 'Sin descanso', hr: '125 – 160 ppm', intensity: '60 – 80%', note: 'Base aeróbica. Para que el jugador tenga "fondo" y aguante el partido entero.' },
                  { name: 'Continuo Intensivo', zone: 'Aeróbico alto', work: '20 – 30 min', rest: 'Sin descanso', hr: '~180 ppm', intensity: '80 – 95%', note: 'Potencia aeróbica. Más exigente. Usar en pretemporada avanzada.' },
                  { name: 'Fartlek', zone: 'Mixto', work: '20 – 40 min variable', rest: 'Activo (no paras)', hr: 'Variable', intensity: 'Variable', note: 'Cambios de ritmo libres. Alta transferencia al juego real.' },
                  { name: 'Interválico Corto', zone: 'Aeróbico potencia', work: '15 – 60 s intenso', rest: '15 – 60 s suave', hr: '160 – 185 ppm', intensity: '85 – 100%', note: 'Mejor método para potencia aeróbica en baloncesto. Simula el juego.' },
                  { name: 'Interválico Muy Corto', zone: 'Aláctico', work: '6 – 10 s (máximo)', rest: '1 – 2 min completo', hr: '185 – 195 ppm', intensity: '100%', note: 'Solicita fibras rápidas. Para explosividad y velocidad pura.' },
                  { name: 'Velocidad', zone: 'Aláctico', work: '3 – 10 s (95-100%)', rest: '1.5 – 2 min activo', hr: 'Máxima', intensity: '95 – 100%', note: '2-4 series × 4-6 reps × 3-5 ejercicios. EXIGE máxima ejecución técnica.' },
                ].map(m => (
                  <div key={m.name} className="flex items-start gap-4 py-3.5 border-b border-slate-800/50 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-white text-xs">{m.name}</p>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700 font-mono uppercase">{m.zone}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{m.note}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1 min-w-[100px]">
                      <p className="text-[9px] text-blue-400 font-bold">{m.hr}</p>
                      <p className="text-[9px] text-emerald-400">{m.work}</p>
                      <p className="text-[9px] text-slate-600">Rec: {m.rest}</p>
                    </div>
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ─── FUERZA ─── */}
          {activeTab === 'fuerza' && (
            <div className="space-y-4">
              <SectionCard>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  La fuerza es la base de la velocidad, la explosividad y la resistencia. Un bloque concentrado de fuerza antes de temporada
                  (5-6 semanas) tiene un efecto que dura todo el año. Secuencia obligatoria:&nbsp;
                  <span className="text-emerald-400 font-semibold">Resistencia → Hipertrofia → F.Máxima → Potencia → Mantenimiento.</span>
                </p>
              </SectionCard>

              {/* Visual phase journey */}
              <SectionCard>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4">Hoja de ruta de la temporada</p>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {FORCE_CYCLES.map((c, i) => (
                    <React.Fragment key={c.id}>
                      <button onClick={() => setSelectedForce(c.id)}
                        className={cn('shrink-0 px-3 py-2.5 rounded-xl border text-center transition-all',
                          selectedForce === c.id
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600')}>
                        <p className={cn('text-[9px] font-black uppercase', selectedForce === c.id ? 'text-white' : '')}>{c.label}</p>
                        <p className={cn('text-[8px] mt-0.5', selectedForce === c.id ? 'text-emerald-200' : c.phaseColor)}>{c.weeks}</p>
                      </button>
                      {i < FORCE_CYCLES.length - 1 && <ChevronRight size={12} className="text-slate-700 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              </SectionCard>

              {/* Selected cycle detail */}
              <div className="bg-slate-900 border border-emerald-500/25 rounded-[20px] p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black text-white text-lg">{selectedCycle.label}</h3>
                    <p className={cn('text-xs font-bold mt-0.5', selectedCycle.phaseColor)}>Fase {selectedCycle.phase}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-slate-600 uppercase tracking-widest">Duración</p>
                    <p className="text-base font-black text-emerald-400">{selectedCycle.weeks}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{selectedCycle.freq}</p>
                  </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">{selectedCycle.objective}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Series', val: selectedCycle.series, icon: '📊' },
                    { label: 'Repeticiones', val: selectedCycle.reps, icon: '🔁' },
                    { label: '% 1RM', val: selectedCycle.percent1RM, icon: '⚖️' },
                    { label: 'Descanso', val: selectedCycle.rest, icon: '⏳' },
                  ].map(kv => (
                    <div key={kv.label} className="bg-slate-950 rounded-xl p-4 text-center">
                      <p className="text-lg mb-1">{kv.icon}</p>
                      <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold">{kv.label}</p>
                      <p className="text-lg font-black text-emerald-400 leading-tight mt-1">{kv.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frequency effect guide */}
              <SectionCard className="space-y-3">
                <h3 className="font-black text-white text-sm">Efecto según frecuencia semanal de fuerza</h3>
                <p className="text-[10px] text-slate-500">Cuántas sesiones dedicas por semana determina si ganas, mantienes o pierdes fuerza.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { freq: '1 vez / 15 días', effect: 'Disminuye la fuerza', color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/15' },
                    { freq: '1 vez / semana', effect: 'Mantenimiento', color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/15' },
                    { freq: '2 veces / semana', effect: 'Aumento discreto', color: 'text-yellow-400', bg: 'bg-yellow-500/5 border-yellow-500/15' },
                    { freq: '3 veces / semana', effect: 'Buen incremento', color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/15' },
                    { freq: '4 veces / semana', effect: 'Óptimo ✅', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25' },
                    { freq: '5-6 veces / semana', effect: 'Máximo (pretemporada)', color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/25' },
                  ].map(row => (
                    <div key={row.freq} className={cn('rounded-xl border p-3', row.bg)}>
                      <p className="text-[9px] text-slate-500 font-mono">{row.freq}</p>
                      <p className={cn('text-xs font-black mt-1', row.color)}>{row.effect}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Key exercises */}
              <SectionCard className="space-y-3">
                <h3 className="font-black text-white text-sm">Ejercicios clave por prioridad</h3>
                {[
                  { cat: 'Tren inferior (lo más importante en baloncesto)', exercises: ['½ Squat con barra', 'Sentadilla completa', 'Cargada / Arrancada', 'Zancadas con carga', 'Prensa de piernas'], color: 'text-emerald-400' },
                  { cat: 'Tren superior', exercises: ['Press banca', 'Remo con barra', 'Dominadas lastradas', 'Press militar', 'Fondos en paralelas'], color: 'text-blue-400' },
                  { cat: 'Potencia / Transferencia', exercises: ['Multisaltos verticales', 'Saltos sobre vallas', 'Lanzamiento balón medicinal', 'Le varju (saltitos con barra)', 'Pliometría combinada'], color: 'text-purple-400' },
                ].map(cat => (
                  <div key={cat.cat}>
                    <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-2', cat.color)}>{cat.cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.exercises.map(ex => (
                        <span key={ex} className="text-[9px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700/40">{ex}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          {/* ─── CATEGORÍAS ─── */}
          {activeTab === 'categorias' && (
            <div className="space-y-4">
              <SectionCard>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  No todos los jugadores pueden entrenarse igual. La edad determina qué capacidades están maduras y cuáles pueden dañarse si se fuerzan.
                  Selecciona la categoría de tu equipo.
                </p>
              </SectionCard>

              {/* Category selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PLAYER_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={cn('px-3 py-3 rounded-xl border text-center transition-all',
                      selectedCategory === cat.id
                        ? cn(cat.color.bg, cat.color.border, cat.color.text, 'font-black')
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600')}>
                    <div className="text-xl mb-1">{cat.icon}</div>
                    <p className={cn('text-[10px] font-bold', selectedCategory === cat.id ? '' : 'text-slate-400')}>{cat.label}</p>
                    <p className="text-[8px] text-slate-600 mt-0.5">{cat.ages}</p>
                  </button>
                ))}
              </div>

              {catDetail && (
                <motion.div key={catDetail.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Summary */}
                  <div className={cn('rounded-[20px] border p-6', catDetail.color.bg, catDetail.color.border)}>
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{catDetail.icon}</div>
                      <div>
                        <h3 className={cn('font-black text-lg', catDetail.color.text)}>{catDetail.label} — {catDetail.ages}</h3>
                        <p className={cn('text-[10px] font-bold mt-0.5', catDetail.color.text)}>Prioridad: {catDetail.priority}</p>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{catDetail.summary}</p>
                      </div>
                    </div>
                  </div>

                  {/* Traffic lights */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catDetail.canTrain.length > 0 && (
                      <SectionCard className="space-y-3">
                        <h4 className="font-black text-emerald-400 text-sm flex items-center gap-2">✅ Puede entrenar</h4>
                        {catDetail.canTrain.map((item: any) => (
                          <div key={item.cap} className="py-2 border-b border-slate-800/40 last:border-0">
                            <p className="text-xs font-bold text-white">{item.cap}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.note}</p>
                          </div>
                        ))}
                      </SectionCard>
                    )}
                    {catDetail.cannotTrain.length > 0 && (
                      <SectionCard className="space-y-3">
                        <h4 className="font-black text-red-400 text-sm flex items-center gap-2">❌ No recomendado todavía</h4>
                        {catDetail.cannotTrain.map((item: any) => (
                          <div key={item.cap} className="py-2 border-b border-slate-800/40 last:border-0">
                            <p className="text-xs font-bold text-white">{item.cap}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.note}</p>
                          </div>
                        ))}
                      </SectionCard>
                    )}
                  </div>

                  {/* Session structure */}
                  <SectionCard className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-black text-white text-sm">Estructura de sesión recomendada</h4>
                      <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Solo bloque físico previo a pista</span>
                    </div>
                    {catDetail.sessionStructure.map((block: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-800/40 last:border-0">
                        <div className={cn('shrink-0 text-[9px] font-black px-2 py-1 rounded-lg', catDetail.color.bg, catDetail.color.text, catDetail.color.border, 'border')}>
                          {block.block}
                        </div>
                        <div>
                          <p className="text-[9px] text-emerald-400 font-bold">{block.time}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{block.content}</p>
                        </div>
                      </div>
                    ))}
                    <p className="text-[9px] text-slate-600 pt-2">🏀 Después de este bloque físico viene la sesión de pista (técnica, táctica y partido).</p>
                  </SectionCard>

                  {/* Weekly plan by days */}
                  <SectionCard className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h4 className="font-black text-white text-sm">Plan semanal por días de entrenamiento</h4>
                      <div className="flex gap-1">
                        {[2, 3, 4, 5].map(d => (
                          <button key={d} onClick={() => setDaysPerWeek(d)}
                            className={cn('w-8 h-8 rounded-lg text-xs font-black transition-all border',
                              daysPerWeek === d
                                ? cn(catDetail.color.bg, catDetail.color.text, catDetail.color.border)
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500')}>
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-500 -mt-2">Días de preparación física por semana (pista no incluida)</p>
                    {(() => {
                      const plan = WEEKLY_PLANS[catDetail.id]?.[daysPerWeek];
                      if (!plan) return <p className="text-xs text-slate-600 italic">No hay plan disponible para esta combinación.</p>;
                      const intensityColors: Record<string, string> = {
                        alta: 'bg-red-500/15 border-red-500/25 text-red-400',
                        media: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
                        baja: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
                        libre: 'bg-slate-700 border-slate-600 text-slate-400',
                      };
                      return (
                        <div className="space-y-3">
                          {plan.map((day, i) => (
                            <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-black text-white">{day.day}</p>
                                <span className={cn('text-[8px] px-2 py-0.5 rounded-full border font-bold uppercase', intensityColors[day.intensity])}>
                                  {day.intensity}
                                </span>
                              </div>
                              <p className={cn('text-[10px] font-bold', catDetail.color.text)}>{day.focus}</p>
                              <p className="text-[10px] text-slate-500 leading-relaxed">{day.details}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </SectionCard>

                  {/* Warning */}
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-[16px] p-4">
                    <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-1">⚠️ Ten en cuenta</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{catDetail.warning}</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ─── PREVENCIÓN ─── */}
          {activeTab === 'prevencion' && (
            <div className="space-y-4">
              <SectionCard>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  La prevención de lesiones en baloncesto reduce la incidencia hasta un 62% con protocolos correctos. Estas son las áreas prioritarias, los mecanismos de lesión y los protocolos con mayor evidencia científica para cada una.
                </p>
              </SectionCard>

              {INJURY_PREVENTION.map(area => (
                <div key={area.id} className="bg-slate-900 border border-slate-800 rounded-[20px] overflow-hidden">
                  {/* Area header */}
                  <div className="p-5 border-b border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{area.icon}</span>
                        <div>
                          <h3 className="font-black text-white text-sm">{area.area}</h3>
                          <p className="text-[9px] text-slate-500 mt-0.5">{area.prevalence}</p>
                        </div>
                      </div>
                      <span className={cn('text-[8px] font-black px-2.5 py-1 rounded-full border shrink-0', area.riskColor,
                        area.risk === 'Muy alto' ? 'bg-red-500/10 border-red-500/20' :
                        area.risk === 'Alto' ? 'bg-emerald-500/10 border-emerald-500/20' :
                        area.risk === 'Medio' ? 'bg-yellow-500/10 border-yellow-500/20' :
                        'bg-purple-500/10 border-purple-500/20')}>
                        {area.risk}
                      </span>
                    </div>
                    <div className="mt-3 bg-slate-800/60 rounded-xl p-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mecanismo de lesión</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{area.mechanism}</p>
                    </div>
                  </div>

                  {/* Protocols */}
                  <div className="p-5 space-y-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Protocolos de prevención</p>
                    {area.methods.map((m, i) => (
                      <div key={i} className="border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-white leading-tight">{m.name}</p>
                          <span className="text-[8px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg text-slate-400 shrink-0 font-bold">{m.phase}</span>
                        </div>
                        <p className="text-[9px] text-emerald-400 font-bold">{m.dose}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{m.effect}</p>
                      </div>
                    ))}

                    {/* Coach tip */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 flex gap-2.5">
                      <span className="text-base shrink-0">💡</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{area.tip}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── TESTS ─── */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <SectionCard className="flex-1">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Batería estándar para baloncesto. Expande cada test para ver el protocolo completo y cómo explicárselo a tus jugadores.
                    <span className="text-white font-semibold"> Importa todos al equipo</span> para usarlos en el módulo de Tests Físicos.
                  </p>
                </SectionCard>
                <button onClick={handleSeedTests} disabled={seeding}
                  className="shrink-0 flex items-center gap-2 px-4 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                  {seeding ? <><Loader2 size={12} className="animate-spin" />Importando...</> : <><Download size={12} />Importar al equipo</>}
                </button>
              </div>

              {/* Category filter — functional */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'resistencia', label: '🏃 Resistencia' },
                  { id: 'explosividad', label: '⬆️ Explosividad' },
                  { id: 'velocidad', label: '⚡ Velocidad' },
                  { id: 'fuerza', label: '💪 Fuerza' },
                ].map(f => (
                  <button key={f.id}
                    onClick={() => setTestCategoryFilter(f.id === testCategoryFilter ? 'all' : f.id)}
                    className={cn('text-[9px] px-3 py-1.5 rounded-lg border font-bold uppercase transition-all',
                      testCategoryFilter === f.id
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300')}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {BASKETBALL_TEST_BATTERY.filter((t: any) => testCategoryFilter === 'all' || t.category === testCategoryFilter).map((test, i) => {
                  const exists = testDefinitions.some(d => d.name.toLowerCase() === test.name.toLowerCase());
                  const isExpanded = expandedTest === test.name;
                  const catColors: Record<string, string> = {
                    resistencia: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                    explosividad: 'text-red-400 bg-red-500/10 border-red-500/20',
                    velocidad: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                    fuerza: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                  };
                  const catColor = catColors[test.category] || 'text-slate-400 bg-slate-700/20 border-slate-600/20';

                  return (
                    <div key={i} className={cn('bg-slate-900 border rounded-[20px] overflow-hidden transition-all', isExpanded ? 'border-emerald-500/30' : 'border-slate-800')}>
                      {/* Header (always visible) */}
                      <button onClick={() => setExpandedTest(isExpanded ? null : test.name)}
                        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-800/30 transition-all">
                        <div className="text-2xl shrink-0">{test.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-white text-sm">{test.name}</p>
                            {exists && <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">✓ en tu equipo</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{test.shortPurpose}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn('text-[8px] font-bold px-2 py-1 rounded-lg border', catColor)}>{test.category}</span>
                          <span className="text-[9px] font-mono text-emerald-400 font-bold">{test.unit}</span>
                          <ChevronDown size={14} className={cn('text-slate-600 transition-transform', isExpanded && 'rotate-180')} />
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-5 pb-6 space-y-5 border-t border-slate-800">
                          {/* Basketball value */}
                          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 mt-4">
                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">¿Para qué sirve en baloncesto?</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{test.basketballValue}</p>
                          </div>

                          {/* Protocol */}
                          <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Protocolo — paso a paso</p>
                            <div className="space-y-2">
                              {test.protocol.map((step: string, si: number) => (
                                <div key={si} className="flex items-start gap-3">
                                  <div className="w-5 h-5 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0 mt-0.5">{si + 1}</div>
                                  <p className="text-xs text-slate-400 leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* What to tell players */}
                          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2">💬 Qué decirles a los jugadores</p>
                            <p className="text-xs text-slate-400 leading-relaxed italic">{test.playerBriefing}</p>
                          </div>

                          {/* Audio link (if available) */}
                          {(test as any).audioUrl && (
                            <a href={(test as any).audioUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/15 transition-all group">
                              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                                <span className="text-base">🎵</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Audio oficial del test</p>
                                <p className="text-xs text-slate-300 font-semibold mt-0.5">{(test as any).audioLabel}</p>
                              </div>
                              <span className="text-[9px] text-purple-400 font-bold group-hover:translate-x-0.5 transition-transform">▶ Abrir</span>
                            </a>
                          )}

                          {/* Scoring table */}
                          <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Tabla de referencia</p>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { label: 'A mejorar', val: test.scoring.poor, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
                                { label: 'Medio', val: test.scoring.average, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                                { label: 'Bueno', val: test.scoring.good, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
                                { label: 'Excelente', val: test.scoring.excellent, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                              ].map(s => (
                                <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                                  <p className="text-[8px] font-bold uppercase tracking-wide opacity-70">{s.label}</p>
                                  <p className="text-sm font-black mt-1">{s.val}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Improvement tip */}
                          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">📈 Cómo mejorarlo</p>
                            <p className="text-xs text-slate-400 leading-relaxed">{test.improveTip}</p>
                          </div>

                          {/* Add to team button */}
                          {!exists && (
                            <button onClick={async () => {
                              try {
                                await onAddTestDefinition({ name: test.name, unit: test.unit });
                                showToast('success', `"${test.name}" añadido al equipo`);
                              } catch { showToast('error', 'Error al añadir el test'); }
                            }}
                              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase hover:border-emerald-500/30 hover:text-emerald-400 transition-all">
                              <Plus size={11} /> Añadir este test al equipo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
};


const TEAM_PALETTE = [
  { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30',   dot: 'bg-blue-500' },
  { bg: 'bg-emerald-500/20',text: 'text-emerald-400', border: 'border-emerald-500/30',dot: 'bg-emerald-500' },
  { bg: 'bg-purple-500/20', text: 'text-purple-400',  border: 'border-purple-500/30', dot: 'bg-purple-500' },
  { bg: 'bg-rose-500/20',   text: 'text-rose-400',    border: 'border-rose-500/30',   dot: 'bg-rose-500' },
  { bg: 'bg-yellow-500/20', text: 'text-yellow-400',  border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
];

const AgendaView = ({ teams }: { teams: Team[] }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [allSessions, setAllSessions] = useState<Record<string, Session[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const monday = useMemo(() => getMonday(currentDate), [currentDate]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    }), [monday]);

  const today = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t; }, []);

  const isCurrentWeek = useMemo(() =>
    monday.getTime() === getMonday(today).getTime(), [monday, today]);

  const periodLabel = useMemo(() => {
    const from = weekDays[0]; const to = weekDays[6];
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    if (from.getFullYear() !== to.getFullYear())
      return `${from.toLocaleDateString('es-ES', { ...opts, year: 'numeric' })} – ${to.toLocaleDateString('es-ES', { ...opts, year: 'numeric' })}`;
    return `${from.toLocaleDateString('es-ES', opts)} – ${to.toLocaleDateString('es-ES', { ...opts, year: 'numeric' })}`;
  }, [weekDays]);

  const teamColorMap = useMemo(() => {
    const m: Record<string, typeof TEAM_PALETTE[0]> = {};
    teams.forEach((t, i) => { m[t.id] = TEAM_PALETTE[i % TEAM_PALETTE.length]; });
    return m;
  }, [teams]);

  // Fetch sessions for ALL teams in the current week
  useEffect(() => {
    if (!isSupabaseConfigured || teams.length === 0) { setAllSessions({}); return; }
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      const fromStr = weekDays[0].toISOString().split('T')[0];
      const toDate = new Date(weekDays[6]); toDate.setDate(toDate.getDate() + 1);
      const toStr = toDate.toISOString().split('T')[0];
      const { data } = await supabase
        .from('sessions').select('*')
        .in('team_id', teams.map(t => t.id))
        .gte('date', fromStr).lt('date', toStr)
        .order('date', { ascending: true });
      if (cancelled) return;
      const grouped: Record<string, Session[]> = {};
      if (data) data.map(mapSession).forEach((s: Session) => {
        const key = s.date.split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });
      setAllSessions(grouped);
      setLoading(false);
    };
    fetch();
    return () => { cancelled = true; };
  }, [monday, teams]);

  const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const selectedDaySessions = selectedDay ? (allSessions[selectedDay] || []) : [];
  const selectedDayDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : null;

  // Total sessions this week
  const totalThisWeek = Object.values(allSessions).flat().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">{periodLabel}</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
            {teams.length} equipo{teams.length !== 1 ? 's' : ''} · {totalThisWeek} sesion{totalThisWeek !== 1 ? 'es' : ''} esta semana
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDay(null); }}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition-all">
              Hoy
            </button>
          )}
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); setSelectedDay(null); }}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all text-slate-400">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); setSelectedDay(null); }}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all text-slate-400">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Team legend — only if >1 team */}
      {teams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {teams.map((t, i) => {
            const c = TEAM_PALETTE[i % TEAM_PALETTE.length];
            return (
              <div key={t.id} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold', c.bg, c.text, c.border)}>
                <div className={cn('w-2 h-2 rounded-full', c.dot)} />
                {t.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Single-team callout */}
      {teams.length === 1 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-500">
          <Calendar size={14} className="text-emerald-500 shrink-0" />
          Crea más equipos para ver todos tus horarios consolidados aquí.
        </div>
      )}

      {/* Weekly grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-600">
          <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mr-3" />
          Cargando agenda...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, i) => {
            const dateKey = day.toISOString().split('T')[0];
            const daySessions = allSessions[dateKey] || [];
            const isToday = day.getTime() === today.getTime();
            const isSelected = selectedDay === dateKey;

            return (
              <button key={dateKey}
                onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                className={cn(
                  'flex flex-col items-center rounded-2xl p-2 pb-3 border transition-all min-h-[110px] text-left',
                  isToday
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : isSelected
                    ? 'bg-slate-800 border-slate-600'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700',
                )}>
                <span className={cn('text-[9px] font-bold uppercase tracking-widest mb-1 w-full text-center',
                  isToday ? 'text-emerald-400' : 'text-slate-500')}>
                  {DAY_LABELS[i]}
                </span>
                <span className={cn('text-lg font-black leading-none mb-2',
                  isToday ? 'text-emerald-400' : 'text-white')}>
                  {day.getDate()}
                </span>
                <div className="flex flex-col gap-1 w-full px-0.5">
                  {daySessions.slice(0, 3).map(s => {
                    const c = teamColorMap[s.teamId] || TEAM_PALETTE[0];
                    return (
                      <div key={s.id} className={cn('rounded-md px-1.5 py-0.5 text-[7px] font-bold truncate border w-full', c.bg, c.text, c.border)}>
                        {s.title || s.type}
                      </div>
                    );
                  })}
                  {daySessions.length > 3 && (
                    <span className="text-[8px] text-slate-500 text-center">+{daySessions.length - 3} más</span>
                  )}
                  {daySessions.length === 0 && (
                    <div className="flex-1 flex items-center justify-center opacity-20 mt-1">
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Day detail panel */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div key={selectedDay}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white capitalize">
                {selectedDayDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setSelectedDay(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            {selectedDaySessions.length === 0 ? (
              <p className="text-slate-600 italic text-sm py-4 text-center">Sin sesiones este día.</p>
            ) : (
              <div className="space-y-3">
                {selectedDaySessions.map(s => {
                  const team = teams.find(t => t.id === s.teamId);
                  const c = team ? teamColorMap[team.id] : TEAM_PALETTE[0];
                  return (
                    <div key={s.id} className={cn('flex items-stretch gap-0 rounded-2xl border overflow-hidden', c.border)}>
                      <div className={cn('w-1.5 shrink-0', c.dot)} />
                      <div className={cn('flex-1 p-4', c.bg)}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={cn('text-xs font-black uppercase tracking-wide', c.text)}>
                            {team?.name || '—'}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded-full">
                            {s.type}
                          </span>
                          {s.durationMins && (
                            <span className="text-[9px] font-mono text-slate-500">{s.durationMins} min</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white">{s.title || 'Entrenamiento'}</p>
                        {s.notes && <p className="text-[10px] text-slate-400 mt-1">{s.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty week state */}
      {!loading && totalThisWeek === 0 && (
        <div className="py-14 text-center">
          <Calendar size={40} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Sin sesiones esta semana</p>
          <p className="text-slate-600 text-sm mt-1">
            Usa "Horarios recurrentes" en cada equipo para generar sesiones automáticamente.
          </p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// APP — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── App status ──
  const [appStatus, setAppStatus] = useState<'LOADING' | 'LOGIN' | 'TEAM_SELECT' | 'DASHBOARD' | 'PLAYER_DASHBOARD'>('LOADING');
  const [activeTab, setActiveTab] = useState('today');
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Subject | null>(null);
  const [viewingPlayerDetail, setViewingPlayerDetail] = useState(false);

  // ── Modal triggers ──
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [isAddingIncident, setIsAddingIncident] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isAddingTestDefinition, setIsAddingTestDefinition] = useState(false);
  const [testDefinitionForm, setTestDefinitionForm] = useState({ name: '', unit: '' });
  const [showRosterAttendance, setShowRosterAttendance] = useState(false);
  const [todaySessionTarget, setTodaySessionTarget] = useState<Session | null>(null);

  // ── Data ──
  const [teams, setTeams] = useState<Team[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [incidents, setIncidents] = useState<HealthIncident[]>([]);
  const [evaluations, setEvaluations] = useState<QualitativeReport[]>([]);
  const [wellnessReports, setWellnessReports] = useState<WellnessReport[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadRecords, setLoadRecords] = useState<LoadRecord[]>([]);
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [physicalTestResults, setPhysicalTestResults] = useState<PhysicalTestResult[]>([]);
  const [matchStats, setMatchStats] = useState<MatchStat[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [trainingSchedules, setTrainingSchedules] = useState<TrainingSchedule[]>([]);

  // ── Auth ──
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ── Toast system ──
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH INIT
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Custom coaches-table auth (no supabase.auth needed)
    const savedCoach = localStorage.getItem('sh_coach');
    if (savedCoach) {
      try {
        const coach = JSON.parse(savedCoach);
        setCurrentUser(coach);
        setAppStatus('TEAM_SELECT');
        fetchCoachData(coach.id); // pass ID directly — state not set yet
      } catch { localStorage.removeItem('sh_coach'); setAppStatus('LOGIN'); }
    } else {
      setAppStatus('LOGIN');
    }
  }, []);

  useEffect(() => {
    if (activeTeam?.id) fetchTeamData(activeTeam.id);
  }, [activeTeam?.id]);

  useEffect(() => {
    document.title = activeTeam ? `${activeTeam.name} — CoachKit` : 'CoachKit';
  }, [activeTeam]);

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  const checkUserRole = async (user: any) => {
    // Kept for compatibility — all users via coaches table are coaches
    setAppStatus('TEAM_SELECT');
    fetchCoachData();
  };

  const fetchCoachData = async (coachIdParam?: string) => {
    const id = coachIdParam || currentUser?.id;
    if (!isSupabaseConfigured || !id) return;
    // 1. Teams I own (coach_id = me)
    const { data: ownedTeams } = await supabase
      .from('teams').select('*')
      .eq('coach_id', id)
      .order('created_at', { ascending: false });
    // 2. Teams I'm a staff member of
    const { data: memberships } = await supabase
      .from('team_members').select('team_id')
      .eq('coach_id', id)
      .eq('role', 'staff');
    const memberTeamIds = (memberships || []).map((m: any) => m.team_id);
    const { data: memberTeams } = memberTeamIds.length
      ? await supabase.from('teams').select('*').in('id', memberTeamIds)
      : { data: [] };
    // Merge, deduplicate
    const all = [...(ownedTeams || []), ...(memberTeams || [])];
    const unique = all.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
    // Fetch real player counts from subjects table
    const teamIds = unique.map(t => t.id);
    const { data: subjectCounts } = teamIds.length
      ? await supabase.from('subjects').select('team_id').in('team_id', teamIds)
      : { data: [] };
    const countMap: Record<string, number> = {};
    (subjectCounts || []).forEach((s: any) => { countMap[s.team_id] = (countMap[s.team_id] || 0) + 1; });
    const mapped = unique.map(t => ({ ...mapTeam(t), playersCount: countMap[t.id] || 0 }));
    setTeams(mapped);
    if (mapped.length > 0 && !activeTeam) { setActiveTeam(mapped[0]); setAppStatus('DASHBOARD'); }
    else if (mapped.length === 0) setAppStatus('TEAM_SELECT');
  };

  const fetchTeamData = async (teamId: string) => {
    if (!isSupabaseConfigured) return;
    const [s, i, ev, w, l, m, se, td, tr, ms, att, sch] = await Promise.all([
      supabase.from('subjects').select('*').eq('team_id', teamId),
      supabase.from('health_incidents').select('*').eq('team_id', teamId),
      supabase.from('evaluations').select('*').eq('team_id', teamId),
      supabase.from('wellness_reports').select('*').eq('team_id', teamId),
      supabase.from('load_records').select('*').eq('team_id', teamId),
      supabase.from('matches').select('*').eq('team_id', teamId).order('date', { ascending: true }),
      supabase.from('sessions').select('*').eq('team_id', teamId).order('date', { ascending: true }),
      supabase.from('test_definitions').select('*').eq('team_id', teamId),
      supabase.from('physical_test_results').select('*').eq('team_id', teamId),
      supabase.from('match_stats').select('*'),
      supabase.from('attendance').select('*').eq('team_id', teamId),
      supabase.from('training_schedules').select('*').eq('team_id', teamId),
    ]);
    if (s.data) setSubjects(s.data.map(mapSubject));
    if (i.data) setIncidents(i.data.map(mapIncident));
    if (ev.data) setEvaluations(ev.data.map(mapEvaluation));
    if (w.data) setWellnessReports(w.data.map(mapWellness));
    if (l.data) setLoadRecords(l.data.map(mapLoadRecord));
    if (m.data) setMatches(m.data.map(mapMatch));
    if (se.data) setSessions(se.data.map(mapSession));
    if (td.data) setTestDefinitions(td.data.map(mapTestDefinition));
    if (tr.data) setPhysicalTestResults(tr.data.map(mapPhysicalTestResult));
    if (ms.data) setMatchStats(ms.data.map(mapMatchStat));
    if (att.data) setAttendanceRecords(att.data.map(mapAttendance));
    if (sch.data) setTrainingSchedules(sch.data.map(mapTrainingSchedule));
  };

  const fetchPlayerData = async (playerId: string) => {
    if (!isSupabaseConfigured) return;
    const [i, ev] = await Promise.all([
      supabase.from('health_incidents').select('*').eq('subject_id', playerId),
      supabase.from('evaluations').select('*').eq('subject_id', playerId),
    ]);
    if (i.data) setIncidents(i.data.map(mapIncident));
    if (ev.data) setEvaluations(ev.data.map(mapEvaluation));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogin = async (email: string, pin: string) => {
    setLoginError(null);
    // Local demo mode
    if (!isSupabaseConfigured) {
      if (email === 'admin@sports.pro' && pin === '1234') {
        const coach = { id: 'local-1', email: 'admin@sports.pro', name: 'Coach Local' };
        setCurrentUser(coach);
        localStorage.setItem('sh_coach', JSON.stringify(coach));
        setAppStatus('TEAM_SELECT');
        fetchCoachData(coach.id);
      } else setLoginError('Modo local: usa admin@sports.pro / 1234');
      return;
    }
    // Use secure bcrypt-verified RPC function
    const { data: rows, error } = await supabase.rpc('verify_coach_login', {
      p_email: email.toLowerCase().trim(),
      p_pin: pin,
    });
    const data = rows?.[0] ?? null;
    if (error || !data) {
      setLoginError('Credenciales incorrectas. Verifica tu email y contraseña.');
      return;
    }
    setCurrentUser(data);
    localStorage.setItem('sh_coach', JSON.stringify(data));
    setAppStatus('TEAM_SELECT');
    fetchCoachData(data.id);
  };

  const handleRegister = async (email: string, pin: string, name: string) => {
    setLoginError(null);
    if (!isSupabaseConfigured) { setLoginError('Modo local: registro no disponible sin Supabase'); return; }
    // Check email not already taken
    const { data: existing } = await supabase.from('coaches').select('id').eq('email', email.toLowerCase().trim()).single();
    if (existing) { setLoginError('Este email ya tiene una cuenta registrada.'); return; }
    const { data: rows2, error } = await supabase.rpc('create_coach', {
      p_email: email.toLowerCase().trim(), p_name: name, p_pin: pin,
    });
    const data = rows2?.[0] ?? null;
    if (error) { setLoginError('Error al crear la cuenta: ' + error.message); return; }
    setCurrentUser(data);
    localStorage.setItem('sh_coach', JSON.stringify(data));
    showToast('success', `¡Bienvenido ${name}! Cuenta creada correctamente.`);
    setAppStatus('TEAM_SELECT');
    fetchCoachData(data.id);
  };

  const handleForgotPin = async (email: string, newPin: string) => {
    setLoginError(null);
    if (!isSupabaseConfigured) { setLoginError('Recuperación no disponible en modo local'); return; }
    const { data: coach } = await supabase.from('coaches').select('id').eq('email', email.toLowerCase().trim()).single();
    if (!coach) { setLoginError('No se encontró ninguna cuenta con ese email.'); return; }
    const { error } = await supabase.rpc('reset_coach_pin', {
      p_email: email.toLowerCase().trim(), p_new_pin: newPin,
    });
    if (error) { setLoginError('Error al actualizar la contraseña: ' + error.message); return; }
    showToast('success', 'Contraseña actualizada. Ya puedes iniciar sesión.');
    setLoginError(null);
    // Force LoginView back to login mode via a re-render trick
    setAppStatus('LOGIN');
  };

  const handleTeamSelect = (team: Team) => { setActiveTeam(team); setAppStatus('DASHBOARD'); };
  const handleLogout = async () => {
    localStorage.removeItem('sh_coach');
    setCurrentUser(null);
    setActiveTeam(null);
    setAppStatus('LOGIN');
  };
  const handleSwitchTeam = () => { fetchCoachData(); setAppStatus('TEAM_SELECT'); };

  const handleDeleteTeam = async (teamId: string) => {
    if (!isSupabaseConfigured) return;
    // Cascade deletes all related data via FK ON DELETE CASCADE in schema
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw new Error('Error al eliminar el equipo: ' + error.message);
    setTeams(prev => prev.filter(t => t.id !== teamId));
    if (activeTeam?.id === teamId) { setActiveTeam(null); }
    showToast('success', 'Equipo eliminado correctamente');
    await fetchCoachData();
  };

  const handleInviteToTeam = async (teamId: string, email: string) => {
    if (!isSupabaseConfigured) return;
    // Find coach by email
    const { data: coach, error: findErr } = await supabase
      .from('coaches').select('id, name, email').eq('email', email).single();
    if (findErr || !coach) throw new Error('No existe ninguna cuenta con ese email. Pídele que se registre primero.');
    if (coach.id === currentUser?.id) throw new Error('No puedes invitarte a ti mismo.');
    // Check not already a member
    const { data: existing } = await supabase
      .from('team_members').select('id').eq('team_id', teamId).eq('coach_id', coach.id).single();
    if (existing) throw new Error('Este entrenador ya tiene acceso al equipo.');
    // Insert
    const { error } = await supabase.from('team_members').insert([{
      team_id: teamId, coach_id: coach.id, role: 'staff', invited_by: currentUser?.id,
    }]);
    if (error) throw new Error('Error al invitar: ' + error.message);
    const teamName = teams.find(t => t.id === teamId)?.name || 'el equipo';
    showToast('success', `✅ ${coach.name || coach.email} añadido al staff de ${teamName}`);
  };

  const handleAddTeam = async (newTeam: Partial<Team>) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('teams').insert([{
      name: newTeam.name, category: newTeam.category,
      sport: newTeam.sport || 'BASKETBALL', players_count: 0,
      coach_id: currentUser?.id,
    }]).select();
    if (error) { showToast('error', 'Error al crear el equipo: ' + error.message); return; }
    if (data?.[0]) {
      // Register creator as owner in team_members
      await supabase.from('team_members').insert([{
        team_id: data[0].id, coach_id: currentUser?.id, role: 'owner',
      }]);
      const t = mapTeam(data[0]); setTeams(prev => [t, ...prev]); setActiveTeam(t); setAppStatus('DASHBOARD');
    }
  };

  // ── Training schedule handlers ──────────────────────────────────────────
  const handleAddTrainingSchedule = async (schedule: Partial<TrainingSchedule>) => {
    if (!isSupabaseConfigured || !activeTeam?.id) return;
    const { data, error } = await supabase.from('training_schedules').insert([{
      team_id: activeTeam.id,
      day_of_week: schedule.dayOfWeek,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      session_type: schedule.sessionType || 'TRAINING',
      title: schedule.title || '',
      active: true,
    }]).select().single();
    if (error) throw error;
    if (data) setTrainingSchedules(prev => [...prev, mapTrainingSchedule(data)]);
  };

  const handleDeleteTrainingSchedule = async (id: string) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('training_schedules').delete().eq('id', id);
    setTrainingSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleGenerateSessions = async (dateFrom: string, dateTo: string) => {
    if (!isSupabaseConfigured || !activeTeam?.id) return;
    const activeSchedules = trainingSchedules.filter(s => s.active);
    if (activeSchedules.length === 0) { showToast('warning', 'No hay horarios activos'); return; }

    const from = new Date(dateFrom); from.setHours(0,0,0,0);
    const to = new Date(dateTo); to.setHours(23,59,59,999);

    const toInsert: any[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const matching = activeSchedules.filter(s => s.dayOfWeek === dow);
      for (const sched of matching) {
        const dateStr = d.toISOString().split('T')[0];
        const title = sched.title || (sched.sessionType === 'TRAINING' ? 'Entrenamiento' : sched.sessionType);
        if (sessions.some(s => s.date === dateStr && s.title === title)) continue;
        const [sh, sm] = sched.startTime.split(':').map(Number);
        const [eh, em] = sched.endTime.split(':').map(Number);
        const durationMins = (eh * 60 + em) - (sh * 60 + sm);
        toInsert.push({
          team_id: activeTeam.id, date: dateStr,
          type: sched.sessionType, title,
          notes: `${sched.startTime}–${sched.endTime}`,
          duration_mins: durationMins > 0 ? durationMins : 90,
        });
      }
    }

    if (toInsert.length === 0) { showToast('info', 'Todas las sesiones ya existen en ese rango'); return; }
    const { data, error } = await supabase.from('sessions').insert(toInsert).select();
    if (error) throw error;
    if (data) {
      setSessions(prev => [...prev, ...data.map(mapSession)]);
      showToast('success', `✓ ${data.length} sesiones generadas`);
    }
  };

  const handleAddSubject = async (newSubject: Subject) => {
    if (!isSupabaseConfigured) return;
    const payload: any = {
      team_id: activeTeam?.id, name: newSubject.name, last_name: newSubject.lastName,
      role: newSubject.role, number: newSubject.number, position: newSubject.position,
      contact: newSubject.contact || null, dna_id: newSubject.dnaId, birth_date: newSubject.birthDate,
      photo_url: newSubject.photoUrl,
    };
    if (newSubject.id) payload.id = newSubject.id;
    const { error } = await supabase.from('subjects').upsert([payload]);
    if (error) throw error;
    if (activeTeam) await fetchTeamData(activeTeam.id);
    setIsAddingSubject(false);
    setEditingSubject(null);
  };

  const handleAddSession = async (session: Partial<Session>) => {
    if (!isSupabaseConfigured) return;
    const formattedDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const { error } = await supabase.from('sessions').insert([{
      team_id: activeTeam?.id, title: session.title?.trim() || `Entrenamiento ${formattedDate}`,
      date: session.date, type: session.type, notes: session.notes, duration_mins: session.durationMins || 90,
    }]);
    if (error) throw error;
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleDeleteSession = async (id: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) throw error;
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateSession = async (id: string, data: Partial<Session>) => {
    if (!isSupabaseConfigured) return;
    const update: Record<string, any> = {};
    if (data.title !== undefined) update.title = data.title?.trim();
    if (data.date !== undefined) update.date = data.date;
    if (data.type !== undefined) update.type = data.type;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.durationMins !== undefined) update.duration_mins = data.durationMins;
    if (Object.keys(update).length === 0) return;
    const { error } = await supabase.from('sessions').update(update).eq('id', id);
    if (error) throw error;
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const handleAddIncident = async (incident: Partial<HealthIncident>) => {
    if (!isSupabaseConfigured) { showToast('warning', 'Modo local: incidencia no persistida'); return; }
    const { error } = await supabase.from('health_incidents').insert([{
      team_id: activeTeam?.id, subject_id: incident.subjectId, type: incident.type,
      severity: incident.severity, status: incident.status || 'active',
      date: incident.date, notes: incident.notes, recovery_date: incident.recoveryDate,
    }]);
    if (error) throw error;
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleUpdateIncident = async (id: string, updates: Partial<HealthIncident>) => {
    if (!isSupabaseConfigured) return;
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.recoveryDate) dbUpdates.recovery_date = updates.recoveryDate;
    if (updates.notes) dbUpdates.notes = updates.notes;
    await supabase.from('health_incidents').update(dbUpdates).eq('id', id);
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleAddEvaluation = async (evaluation: QualitativeReport) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('evaluations').insert([{
      team_id: activeTeam?.id, subject_id: evaluation.subjectId, coach_id: evaluation.coachId,
      date: evaluation.date, tactical: evaluation.evaluations.tactical, technical: evaluation.evaluations.technical,
      physical: evaluation.evaluations.physical, behavioral: evaluation.evaluations.behavioral,
      season: evaluation.season, comments: evaluation.comments, overall: evaluation.overall,
    }]);
    if (error) throw error;
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleAddWellness = async (wellness: WellnessReport) => {
    if (!isSupabaseConfigured) { setWellnessReports(prev => [...prev.filter(w => !(w.subjectId === wellness.subjectId && w.date === wellness.date)), wellness]); showToast('success', 'Wellness guardado localmente'); return; }
    const { error } = await supabase.from('wellness_reports').upsert([{
      team_id: activeTeam?.id, subject_id: wellness.subjectId, date: wellness.date,
      fatigue: wellness.fatigue, sleep_quality: wellness.sleepQuality, muscle_soreness: wellness.muscleSoreness,
      stress_level: wellness.stressLevel, mood: wellness.mood, notes: wellness.notes,
    }], { onConflict: 'subject_id,date' });
    if (error) { showToast('error', 'Error guardando wellness'); return; }
    showToast('success', 'Wellness registrado');
    if (activeTeam) fetchTeamData(activeTeam.id);
  };

  const handleAddTestDefinition = async (def: { name: string; unit: string }) => {
    if (!isSupabaseConfigured || !activeTeam) return;
    const { data, error } = await supabase.from('test_definitions').insert([{ team_id: activeTeam.id, name: def.name, unit: def.unit }]).select();
    if (error) { showToast('error', 'Error al crear el test'); return; }
    if (data) setTestDefinitions(prev => [...prev, mapTestDefinition(data[0])]);
    showToast('success', `Test "${def.name}" creado`);
  };

  const handleAddMatch = async (match: Partial<Match>) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('matches').insert([{
      team_id: activeTeam?.id, opponent: match.opponent, date: match.date,
      location: match.location, is_home: match.isHome, status: match.status,
      result_us: match.resultUs, result_them: match.resultThem,
    }]);
    if (error) throw error;
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleAddMatchStat = async (stat: any) => {
    if (!isSupabaseConfigured) return;
    await supabase.from('match_stats').upsert([{ match_id: stat.matchId, subject_id: stat.subjectId, stats: stat.stats || {} }], { onConflict: 'match_id,subject_id' });
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleBulkPhysicalTests = async (payloads: any[]) => {
    if (!isSupabaseConfigured) return;
    // FIXED: correct table name is physical_test_results
    const { error } = await supabase.from('physical_test_results').upsert(payloads);
    if (error) throw error;
    if (activeTeam) await fetchTeamData(activeTeam.id);
  };

  const handleQuickAttendance = async (attendance: Record<string, string>) => {
    if (!activeTeam || !isSupabaseConfigured) { showToast('warning', 'Necesitas Supabase para guardar asistencia'); return; }
    const { data: sessionData, error: sessionError } = await supabase.from('sessions').insert([{
      team_id: activeTeam.id, title: `Lista rápida — ${new Date().toLocaleDateString('es-ES')}`,
      date: new Date().toISOString(), type: 'TRAINING', duration_mins: 90,
    }]).select().single();
    if (sessionError) { showToast('error', 'Error creando la sesión rápida'); return; }
    const inserts = Object.entries(attendance).map(([sid, status]) => ({ team_id: activeTeam.id, session_id: sessionData.id, subject_id: sid, status }));
    if (inserts.length) await supabase.from('attendance').insert(inserts);
    showToast('success', `Lista pasada: ${inserts.filter(i => i.status === 'present').length} presentes`);
    await fetchTeamData(activeTeam.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (appStatus === 'LOADING') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="text-emerald-500 animate-spin mx-auto" size={40} />
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Conectando con Supabase...</p>
      </div>
    </div>
  );

  if (appStatus === 'LOGIN') return <LoginView onLogin={handleLogin} onRegister={handleRegister} onForgotPin={handleForgotPin} error={loginError} />;
  if (appStatus === 'TEAM_SELECT') return <TeamSelectionView teams={teams} onSelect={handleTeamSelect} onRegisterTeam={handleAddTeam} onInvite={handleInviteToTeam} onDeleteTeam={handleDeleteTeam} currentUser={currentUser} onLogout={handleLogout} />;
  if (appStatus === 'PLAYER_DASHBOARD' && currentUser) return <PlayerDashboardView player={currentUser} incidents={incidents.filter(i => i.subjectId === currentUser.id)} evaluations={evaluations.filter(e => e.subjectId === currentUser.id)} onLogout={handleLogout} />;

  const teamSubjects = subjects.filter(s => s.teamId === activeTeam?.id);

  const renderContent = () => {
    // Player detail overrides tab view
    if (viewingPlayerDetail && selectedPlayer) {
      return (
        <PlayerDetailDashboard
          player={selectedPlayer}
          incidents={incidents.filter(i => i.subjectId === selectedPlayer.id)}
          evaluations={evaluations.filter(e => e.subjectId === selectedPlayer.id)}
          testDefinitions={testDefinitions}
          testResults={physicalTestResults.filter(t => t.subjectId === selectedPlayer.id)}
          attendance={attendanceRecords}
          wellnessReports={wellnessReports}
          loadRecords={loadRecords}
          sessions={sessions}
          matches={matches}
          matchStats={matchStats}
          onBack={() => { setViewingPlayerDetail(false); setSelectedPlayer(null); }}
          onAddIncident={handleAddIncident}
          onAddEvaluation={handleAddEvaluation}
          onEditPlayer={p => { setViewingPlayerDetail(false); setSelectedPlayer(null); setActiveTab('roster'); setEditingSubject(p); }}
          currentUser={currentUser}
          showToast={showToast}
        />
      );
    }

    // Roster attendance quick modal
    if (showRosterAttendance) {
      return (
        <div>
          <button onClick={() => setShowRosterAttendance(false)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"><ChevronLeft size={16} /> Volver a plantilla</button>
          <AttendanceTool subjects={teamSubjects} onCancel={() => setShowRosterAttendance(false)}
            onSave={async (att) => { await handleQuickAttendance(att); setShowRosterAttendance(false); }} teamId={activeTeam?.id} />
        </div>
      );
    }

    switch (activeTab) {
      case 'today': return (
        <TodayView
          subjects={teamSubjects} incidents={incidents} matches={matches}
          sessions={sessions} loadRecords={loadRecords} wellnessReports={wellnessReports}
          attendanceRecords={attendanceRecords}
          onNavigate={tab => { setActiveTab(tab); setViewingPlayerDetail(false); setShowRosterAttendance(false); }}
          onOpenSession={session => { setTodaySessionTarget(session); setActiveTab('sessions'); }}
        />
      );
      case 'dashboard': return (
        <DashboardView subjects={teamSubjects} incidents={incidents} matches={matches}
          wellnessReports={wellnessReports} sessions={sessions} onNavigate={setActiveTab} loadRecords={loadRecords} coachId={currentUser?.id}
          onOpenSession={session => { setTodaySessionTarget(session); setActiveTab('sessions'); }} />
      );
      case 'agenda': return (
        <AgendaView teams={teams} />
      );
      case 'roster': return (
        <RosterView subjects={teamSubjects}
          onPlayerClick={p => { setSelectedPlayer(p); setViewingPlayerDetail(true); }}
          onAddSubject={handleAddSubject}
          onPassAttendance={() => setShowRosterAttendance(true)}
          isAddingSubject={isAddingSubject} setIsAddingSubject={setIsAddingSubject}
          editingSubject={editingSubject} setEditingSubject={setEditingSubject}
          showToast={showToast} attendanceRecords={attendanceRecords} sessions={sessions} />
      );
      case 'sessions': return (
        <SessionsView sessions={sessions} onAddSession={handleAddSession}
          onDeleteSession={handleDeleteSession} onUpdateSession={handleUpdateSession}
          subjects={teamSubjects} teamId={activeTeam?.id} onQuickAttendance={handleQuickAttendance}
          isAdding={isAddingSession} setIsAdding={setIsAddingSession}
          attendanceRecords={attendanceRecords} loadRecords={loadRecords} showToast={showToast}
          trainingSchedules={trainingSchedules}
          onAddSchedule={handleAddTrainingSchedule}
          onDeleteSchedule={handleDeleteTrainingSchedule}
          onGenerateSessions={handleGenerateSessions}
          initialSession={todaySessionTarget}
          onSessionOpened={() => setTodaySessionTarget(null)} />
      );
      case 'matches': return (
        <MatchesView matches={matches} onAddMatch={handleAddMatch} subjects={teamSubjects}
          matchStats={matchStats} onAddMatchStat={handleAddMatchStat}
          isAdding={isAddingMatch} setIsAdding={setIsAddingMatch}
          activeTeam={activeTeam} showToast={showToast} />
      );
      case 'physical_tests': return (
        <PhysicalTestsView subjects={teamSubjects} teamId={activeTeam?.id || ''}
          testDefinitions={testDefinitions} testResults={physicalTestResults}
          onSaveBulk={handleBulkPhysicalTests} showToast={showToast} />
      );
      case 'prepfisica': return (
        <PrepFisicaView
          teamId={activeTeam?.id}
          testDefinitions={testDefinitions}
          onAddTestDefinition={handleAddTestDefinition}
          showToast={showToast} />
      );
      case 'wellness': // fallthrough — Wellness ahora vive dentro de Salud
      case 'health': return (
        <HealthView subjects={teamSubjects} incidents={incidents} wellnessReports={wellnessReports}
          loadRecords={loadRecords} sessions={sessions}
          onAddIncident={handleAddIncident} onUpdateIncident={handleUpdateIncident}
          isAddingIncident={isAddingIncident} setIsAddingIncident={setIsAddingIncident}
          showToast={showToast} onSaveWellness={handleAddWellness} />
      );
      case 'reports': return (
        <ReportsView subjects={teamSubjects} incidents={incidents} evaluations={evaluations}
          wellnessReports={wellnessReports} loadRecords={loadRecords} matchStats={matchStats} showToast={showToast} />
      );
      case 'profile': return (
        <ProfileView onLogout={handleLogout} currentUser={currentUser} activeTeam={activeTeam} showToast={showToast} />
      );
      default: return <div className="py-20 text-center text-slate-600 italic">Módulo en desarrollo...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-emerald-500/30">
      <Sidebar activeTab={activeTab} setActiveTab={t => { setActiveTab(t); setViewingPlayerDetail(false); setShowRosterAttendance(false); }}
        activeTeam={activeTeam} onSwitchTeam={handleSwitchTeam} onLogout={handleLogout} currentUser={currentUser} />

      <main className="lg:ml-56 p-5 lg:p-10 min-h-screen pb-24 lg:pb-10">
        <div className="max-w-6xl mx-auto">
          <Header
            title={viewingPlayerDetail ? 'roster' : showRosterAttendance ? 'roster' : activeTab}
            onAdd={() => {
              if (activeTab === 'roster') setIsAddingSubject(true);
              if (activeTab === 'sessions') setIsAddingSession(true);
              if (activeTab === 'matches') setIsAddingMatch(true);
              if (activeTab === 'health') setIsAddingIncident(true);
              if (activeTab === 'physical_tests') setIsAddingTestDefinition(true);
            }}
          />
          <AnimatePresence mode="wait">
            <motion.div key={activeTab + (viewingPlayerDetail ? '-detail' : '') + (showRosterAttendance ? '-att' : '')}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {renderContent()}
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-3 text-[9px] font-mono text-slate-700 uppercase tracking-widest">
            <span>Sports Management Hub v2.5 © 2026</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", isSupabaseConfigured ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-yellow-500")}></span>
                {isSupabaseConfigured ? 'Supabase Activo' : 'Modo Local'}
              </span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>Gemini AI</span>
            </div>
          </footer>
        </div>
      </main>

      {/* New Test Definition Modal */}
      <AnimatePresence>
        {isAddingTestDefinition && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-[28px] w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><Dumbbell size={18} className="text-emerald-500" /> Nuevo Test</h3>
                <button onClick={() => setIsAddingTestDefinition(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                {/* Quick pick from battery */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Seleccionar de la batería estándar</label>
                  <div className="max-h-44 overflow-y-auto space-y-1 bg-slate-950 rounded-xl p-2 border border-slate-800">
                    {BASKETBALL_TEST_BATTERY.map((t: any) => {
                      const exists = testDefinitions.some((d: any) => d.name.toLowerCase() === t.name.toLowerCase());
                      return (
                        <button key={t.name} onClick={() => !exists && setTestDefinitionForm({ name: t.name, unit: t.unit })} disabled={exists}
                          className={cn('w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                            exists ? 'opacity-40 cursor-not-allowed' :
                            testDefinitionForm.name === t.name ? 'bg-emerald-500/15 border border-emerald-500/30' : 'hover:bg-slate-800')}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{t.icon}</span>
                            <div>
                              <p className={cn('text-xs font-bold', testDefinitionForm.name === t.name ? 'text-emerald-400' : 'text-white')}>{t.name}</p>
                              <p className="text-[9px] text-slate-500">{t.shortPurpose.split('—')[0].trim()}</p>
                            </div>
                          </div>
                          {exists ? <span className="text-[8px] text-emerald-400 font-bold shrink-0">✓</span>
                            : <span className="text-[9px] text-slate-600 font-mono shrink-0">{t.unit}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-[9px] uppercase font-bold">o personalizado</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Nombre del Test</label>
                  <input value={testDefinitionForm.name} onChange={e => setTestDefinitionForm({...testDefinitionForm, name: e.target.value})}
                    placeholder="Sprint 30m, Salto Vertical, CMJ..." autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Unidad</label>
                  <input value={testDefinitionForm.unit} onChange={e => setTestDefinitionForm({...testDefinitionForm, unit: e.target.value})}
                    placeholder="s, cm, kg, reps, W/kg..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50" />
                </div>
                <button onClick={async () => {
                  if (testDefinitionForm.name && testDefinitionForm.unit) {
                    await handleAddTestDefinition(testDefinitionForm);
                    setIsAddingTestDefinition(false);
                    setTestDefinitionForm({ name: '', unit: '' });
                  }
                }} className="w-full bg-emerald-500 text-slate-950 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 mt-2">
                  Crear Test
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
