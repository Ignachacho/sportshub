/**
 * constants.ts
 * ────────────
 * Datos estáticos: colores de sesión, zonas metabólicas, fases de periodización,
 * batería de tests, guías de entrenamiento, prevención de lesiones y períodos de temporada.
 * Sin lógica de negocio — solo datos de referencia.
 */

// ── Períodos de temporada ─────────────────────────────────────────────────────

export type SeasonPeriod = 'preseason' | 'regular' | 'playoffs' | 'recovery';

export const PERIOD_CFG: Record<SeasonPeriod, {
  label: string; emoji: string; color: string; bg: string;
  border: string; acwrWarn: number; desc: string;
}> = {
  preseason: { label: 'Pretemporada', emoji: '🏃', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    acwrWarn: 1.5, desc: 'Cargas elevadas esperadas. ACWR >1.5 = precaución real.' },
  regular:   { label: 'Temporada',    emoji: '🏀', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', acwrWarn: 1.3, desc: 'Zona óptima 0.8–1.3. ACWR >1.3 = precaución.' },
  playoffs:  { label: 'Playoffs',     emoji: '🏆', color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  acwrWarn: 1.3, desc: 'Máxima disponibilidad. Carga conservadora antes de cada partido.' },
  recovery:  { label: 'Descanso',     emoji: '😴', color: 'text-slate-400',   bg: 'bg-slate-800',      border: 'border-slate-700',      acwrWarn: 0.5, desc: 'Recuperación activa. Sin umbrales de alerta de carga.' },
};

export const PERIOD_KEY = (coachId: string) => `ck_period_${coachId}`;

// ── Sesiones ──────────────────────────────────────────────────────────────────

export const SESSION_TYPE_COLORS = {
  TRAINING: { bg: 'bg-blue-500/15 hover:bg-blue-500/25',    text: 'text-blue-400',    border: 'border-blue-500/25',    dot: 'bg-blue-400',    label: 'Entrenamiento' },
  MATCH:    { bg: 'bg-red-500/15 hover:bg-red-500/25',      text: 'text-red-400',     border: 'border-red-500/25',     dot: 'bg-red-400',     label: 'Partido'       },
  PHYSICAL: { bg: 'bg-emerald-500/15 hover:bg-emerald-500/25', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400', label: 'Físico'     },
  OTHER:    { bg: 'bg-slate-500/15 hover:bg-slate-500/25',  text: 'text-slate-400',   border: 'border-slate-500/25',   dot: 'bg-slate-500',   label: 'Otro'          },
};

export const stc = (type: string) =>
  SESSION_TYPE_COLORS[type as keyof typeof SESSION_TYPE_COLORS] || SESSION_TYPE_COLORS.OTHER;

// ── Notas de sesión (encoding/decoding) ──────────────────────────────────────

export const MATERIAL_DELIM = '\n---MATERIAL---\n';
export const META_DELIM     = '\n---META---\n';

export const parseSessionNotes = (raw: string) => {
  const [notesBody = '', metaStr = ''] = (raw || '').split(META_DELIM);
  const parts = notesBody.split(MATERIAL_DELIM);
  const meta: Record<string, string> = {};
  metaStr.split('|').forEach(p => {
    const [k, v] = p.split(':');
    if (k && v !== undefined) meta[k] = v;
  });
  return { annotations: parts[0] || '', material: parts[1] || '', zone: meta.zone || '', phase: meta.phase || '' };
};

export const encodeSessionNotes = (annotations: string, material: string, zone = '', phase = '') => {
  const base     = material.trim() ? `${annotations}${MATERIAL_DELIM}${material}` : annotations;
  const metaParts = [zone && `zone:${zone}`, phase && `phase:${phase}`].filter(Boolean);
  return metaParts.length ? `${base}${META_DELIM}${metaParts.join('|')}` : base;
};

/** Extrae la hora de una cadena datetime ('2024-06-01T18:00:00' → '18:00') */
export const extractTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const t = dateStr.split('T')[1]?.slice(0, 5) || '';
  return t === '00:00' ? '' : t;
};

// ── Zonas metabólicas ─────────────────────────────────────────────────────────

export const METABOLIC_ZONES = [
  { id: 'alactico', label: 'Anaeróbico Aláctico', short: 'ATP-PC',
    color: { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
    duration: '6 – 20 s', rest: '2 – 3 min', hr: '185 – 195 ppm', intensity: '95 – 100%',
    description: 'Explosiones, sprints, saltos. ATP y fosfocreatina como sustrato. Recuperación total obligatoria.',
    examples: ['Sprints 6-15m', 'CMJ en serie', 'Salidas explosivas', 'Aceleraciones 1vs1'],
    workRest: '1:6 a 1:10' },
  { id: 'lactico', label: 'Anaeróbico Láctico', short: 'Glucolítico',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
    duration: '30 s – 2 min', rest: '1 – 4 min', hr: '170 – 185 ppm', intensity: '80 – 95%',
    description: 'Contraataques sostenidos, presses altas. Ácido láctico como subproducto. Semivida del lactato: 15-20 min.',
    examples: ['Series de contraataque', 'Press defensivo 45s', 'Circuitos 1 min', 'Juego reducido intenso'],
    workRest: '1:2 a 1:4' },
  { id: 'aerobico', label: 'Aeróbico', short: 'Oxidativo',
    color: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
    duration: '≥ 3 min continuo', rest: 'Activo / mínimo', hr: '125 – 175 ppm', intensity: '60 – 80%',
    description: 'Se activa a los 3-5 min. Sustenta los 40 min reales de juego. Base aeróbica = mayor recuperación entre esfuerzos.',
    examples: ['Continuo extensivo 30+ min', '5vs5 fluido', 'Circuito técnico largo', 'Course Navette'],
    workRest: 'Continuo' },
  { id: 'fuerza', label: 'Fuerza / Potencia', short: 'Neuromuscular',
    color: { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
    duration: '3 – 10 s por rep', rest: '2 – 5 min entre series', hr: 'Variable', intensity: '70 – 100% 1RM',
    description: 'F.máxima, explosiva y pliometría. Descanso completo para máxima calidad neuro-muscular.',
    examples: ['½ squat con carga', 'Cargada / arrancada', 'Multisaltos verticales', 'Balón medicinal'],
    workRest: '1:10 a 1:20' },
  { id: 'mixto', label: 'Mixto / Integrado', short: 'Integrado',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
    duration: 'Variable', rest: 'Variable', hr: '130 – 185 ppm', intensity: 'Variable',
    description: 'Sesión que combina sistemas energéticos. Típico de entrenamiento técnico-táctico de baloncesto.',
    examples: ['Calentamiento + táctico + físico', 'Tiro + aceleración', '5vs5 con transiciones'],
    workRest: 'Según diseño' },
];

// ── Fases de periodización ────────────────────────────────────────────────────

export const PERIODIZATION_PHASES = [
  { id: 'basico',      label: 'Básico',      color: 'text-slate-300',   bgColor: 'bg-slate-700/50 border-slate-600/50',           description: 'Condición general, base aeróbica, fuerza-resistencia. Pre-temporada inicial.' },
  { id: 'dirigido',    label: 'Dirigido',    color: 'text-blue-300',    bgColor: 'bg-blue-500/15 border-blue-500/25',             description: 'Fuerza máxima concentrada (5-6 sem). Hipertrofia → F.Máxima → Potencia.' },
  { id: 'especifico',  label: 'Específico',  color: 'text-emerald-300', bgColor: 'bg-emerald-500/15 border-emerald-500/25',       description: 'Transferencia al juego. Velocidad, pliometría, método complejo. Pretemporada.' },
  { id: 'competitivo', label: 'Competitivo', color: 'text-emerald-300', bgColor: 'bg-emerald-500/15 border-emerald-500/25',       description: 'Mantenimiento. 1-2 sesiones/sem de fuerza. Prioridad táctica y descanso.' },
];

// ── Ciclos de fuerza ──────────────────────────────────────────────────────────

export const FORCE_CYCLES = [
  { id: 'resistencia',   label: 'Resistencia de Fuerza',  phase: 'Básico',      phaseColor: 'text-slate-300',   series: '3 – 4', reps: '6 – 15',  percent1RM: '55 – 70%',  rest: '60 – 90 s',   weeks: '~1 sem',    freq: '2 – 3×/sem', objective: 'Acondicionamiento inicial. Prepara tendones y músculo para cargas mayores.' },
  { id: 'hipertrofia',   label: 'Hipertrofia',            phase: 'Dirigido',    phaseColor: 'text-blue-300',    series: '3 – 5', reps: '8 – 12',  percent1RM: '70 – 82%',  rest: '2 – 3 min',   weeks: '3 – 8 sem', freq: '3 – 4×/sem', objective: 'Gran volumen, intensidad moderada. Incremento progresivo. Ritmo de ejecución rápido.' },
  { id: 'fmaxima',       label: 'Fuerza Máxima',          phase: 'Dirigido',    phaseColor: 'text-blue-300',    series: '3 – 6', reps: '1 – 6',   percent1RM: '83 – 100%', rest: '3 – 5 min',   weeks: '3 – 5 sem', freq: '3 – 4×/sem', objective: 'Factores nerviosos. Máxima velocidad de ejecución. Reduce déficit de fuerza.' },
  { id: 'potencia',      label: 'F.Velocidad / Potencia', phase: 'Específico',  phaseColor: 'text-emerald-300', series: '3 – 4', reps: '6 – 10',  percent1RM: '78 – 88%',  rest: '3 – 5 min',   weeks: '3 – 5 sem', freq: '2 – 3×/sem', objective: 'Transferir F.Máxima → F.Explosiva. Alta velocidad ejecución + pliometría.' },
  { id: 'mantenimiento', label: 'Mantenimiento',           phase: 'Competitivo', phaseColor: 'text-emerald-300', series: '3 – 4', reps: '4 – 8',   percent1RM: '75 – 85%',  rest: '2 – 4 min',   weeks: 'Temporada', freq: '1 – 2×/sem', objective: 'Preservar potencia adquirida sin interferir con carga táctica y competitiva.' },
];

// ── Batería de tests de baloncesto ────────────────────────────────────────────

export const BASKETBALL_TEST_BATTERY = [
  {
    name: 'Course Navette (Léger)', unit: 'palier', category: 'resistencia', icon: '🏃',
    audioUrl: 'https://www.youtube.com/watch?v=4oH_4_zPEjI',
    audioLabel: 'Audio oficial Course Navette (Léger 20m)',
    shortPurpose: 'Resistencia aeróbica general — cuánto aguantan al ritmo del partido',
    basketballValue: 'Determina si tus jugadores llegan al cuarto cuarto al mismo ritmo que al primero. Un equipo con buen Course Navette no pierde la marca por cansancio en los últimos minutos.',
    protocol: ['Marcar dos líneas paralelas a 20 m de distancia en la pista','Reproducir el audio del Course Navette (usa el botón de audio en esta pantalla)','Todos corren a la vez de línea a línea siguiendo el ritmo de los pitidos','Cada vez que suena el pitido, el pie debe haber pisado o cruzado la línea','Cuando un jugador no llega dos veces consecutivas, anota su palier actual y número de idas','El último palier completo es la puntuación'],
    playerBriefing: '"Corres de línea a línea al ritmo de los pitidos. El ritmo va subiendo cada minuto. Para cuando no llegues dos veces seguidas. Sin trampas — si no llegas, para."',
    scoring: { poor: '< 5', average: '5 – 7', good: '7 – 9', excellent: '> 9' },
    ref: 'Palier ≥ 8 recomendado', lowerIsBetter: false,
    improveTip: 'Continuo extensivo 30-45 min (3×/sem 6 semanas) + Interval corto 15-30s. Con 8 semanas de trabajo aeróbico se sube 1-2 paliers.',
  },
  {
    name: 'CMJ (Salto con Contramovimiento)', unit: 'cm', category: 'explosividad', icon: '⬆️',
    shortPurpose: 'Potencia explosiva de piernas — capacidad de salto real en partido',
    basketballValue: 'Es el salto que hacen en partido: rebote, tapón, entrada a canasta. Mide cuánta potencia transfieren del impulso hacia abajo al salto.',
    protocol: ['El jugador se coloca de pie, manos en caderas (o libres según protocolo)','Flexiona las rodillas rápidamente y salta lo más alto posible','El movimiento es continuo: bajar y subir sin pausa','Medir con plataforma de salto, sensor de contacto o app de video (My Jump 2)','Realizar 3 intentos con 1 min de recuperación entre ellos','Anotar el mejor de los tres intentos'],
    playerBriefing: '"Salta lo más alto que puedas. Dobla las rodillas rápido y explota hacia arriba. No hay pausa entre el bajón y el salto. 3 intentos, guardamos el mejor."',
    scoring: { poor: '< 30 cm', average: '30 – 38 cm', good: '38 – 45 cm', excellent: '> 45 cm' },
    ref: '> 40 cm buen nivel', lowerIsBetter: false,
    improveTip: 'Ciclo F.Máxima (6 sem) seguido de Potencia + Pliometría (4 sem). Multisaltos verticales 3×/sem. Mejoras de 3-6 cm por ciclo son habituales.',
  },
  {
    name: 'SJ (Squat Jump)', unit: 'cm', category: 'explosividad', icon: '🦵',
    shortPurpose: 'Fuerza concéntrica pura — motor sin efecto elástico',
    basketballValue: 'Mide solo la fuerza "pura" de las piernas, sin trampa elástica. Comparar CMJ - SJ da el índice de elasticidad.',
    protocol: ['El jugador se coloca en posición de sentadilla (90° de flexión de rodilla), manos en caderas','Mantiene 2-3 segundos en esa posición para anular el efecto elástico','Salta lo más alto posible DESDE esa posición, sin contramovimiento previo','Si se detecta cualquier movimiento descendente antes del salto, el intento no es válido','Medir igual que CMJ (plataforma o app)','3 intentos, mejor resultado'],
    playerBriefing: '"Ponte en cuclillas (90 grados), cuenta tres, y salta. Nada de coger impulso bajando antes. Solo desde abajo hacia arriba."',
    scoring: { poor: '< 25 cm', average: '25 – 33 cm', good: '33 – 40 cm', excellent: '> 40 cm' },
    ref: '> 35 cm buen nivel', lowerIsBetter: false,
    improveTip: 'Trabajo de fuerza máxima de piernas (½ squat, sentadilla profunda). El SJ mejora directamente con carga.',
  },
  {
    name: 'Drop Jump (DJ)', unit: 'cm', category: 'explosividad', icon: '📦',
    shortPurpose: 'Fuerza reactiva — respuesta explosiva a un aterrizaje',
    basketballValue: 'Simula los rebotes ofensivos: caes y explota hacia arriba inmediatamente. Índice de Reactividad (IR = altura / tiempo de contacto).',
    protocol: ['Colocar un banco o cajón a 30-40 cm de altura','El jugador cae de pie desde el cajón (no salta — solo cae)','Inmediatamente al tocar el suelo, salta lo más alto posible con el menor tiempo de contacto posible','El objetivo es mínimo contacto en suelo + máxima altura','Medir con plataforma de contacto o app que mida tiempo de contacto y altura','3-5 intentos, anotar IR = altura(cm) / tiempo contacto(s)'],
    playerBriefing: '"Cae del cajón y salta inmediatamente — como si el suelo quemara. Queremos contacto mínimo en el suelo."',
    scoring: { poor: 'IR < 1.5', average: 'IR 1.5 – 2.0', good: 'IR 2.0 – 2.5', excellent: 'IR > 2.5' },
    ref: 'IR > 2.0 óptimo', lowerIsBetter: false,
    improveTip: 'Pliometría: saltos sobre vallas, depth jumps, rebotes en cuerda. 4-5 series × 8-10 rep.',
  },
  {
    name: 'Sprint 20m', unit: 's', category: 'velocidad', icon: '⚡',
    shortPurpose: 'Velocidad de aceleración — primeros pasos decisivos en pista',
    basketballValue: 'El 90% de los sprints en baloncesto son menores de 20m. Mide lo que pasa en la primera pasada, la recuperación defensiva, la transición rápida.',
    protocol: ['Marcar inicio y llegada a 20 metros, con fotocélulas o cronómetro manual','El jugador parte desde parado, posición libre (no bloqueada)','Cronometrar desde el primer movimiento hasta cruzar los 20m','Si es manual: dos personas controlan salida y llegada','3 intentos con 3-5 min de recuperación completa entre ellos','Anotar el mejor tiempo'],
    playerBriefing: '"Corre lo más rápido que puedas desde aquí hasta allí. 3 intentos — deja 3 minutos entre cada uno."',
    scoring: { poor: '> 3.5 s', average: '3.1 – 3.5 s', good: '2.8 – 3.1 s', excellent: '< 2.8 s' },
    ref: '< 3.0 s buen nivel', lowerIsBetter: true,
    improveTip: 'Velocidad máxima (95-100%, 3-10s, 1-2 min rec.) + Fuerza explosiva de piernas.',
  },
  {
    name: 'Test Mouche (28m × 12min)', unit: 'rep', category: 'resistencia', icon: '🔄',
    shortPurpose: 'Resistencia específica de baloncesto — aguantar sprints a lo largo del partido',
    basketballValue: 'Imita exactamente lo que pasa en un partido: ir y volver corriendo, una y otra vez, con las medidas reales de la pista (28m).',
    protocol: ['Marcar los dos fondos de la pista (28 metros reales de canasta a canasta)','Configurar un cronómetro visible para 12 minutos','Al señal, el jugador corre de línea a línea sin parar durante 12 minutos','Cada vez que toca o cruza una línea, cuenta como 1 repetición','No se puede caminar — si para o camina, el test termina','Anotar el total de repeticiones al finalizar los 12 minutos'],
    playerBriefing: '"Tienes 12 minutos. Vas y vuelves de pared a pared. Cada vez que llegas, cuenta una. No puedes caminar."',
    scoring: { poor: '< 16', average: '16 – 20', good: '20 – 24', excellent: '> 24' },
    ref: '> 22 rep buen nivel', lowerIsBetter: false,
    improveTip: 'Método interválico corto (30s trabajo / 30s descanso × 10-15 rep, 3 series).',
  },
  {
    name: 'Lanzamiento Balón Medicinal 3 kg', unit: 'm', category: 'fuerza', icon: '🏀',
    shortPurpose: 'Potencia de tren superior — fuerza de pase, entrada y contacto',
    basketballValue: 'Cuanta más potencia de tren superior, más fuerza en los pases largos, más resistencia al contacto en entrada a canasta.',
    protocol: ['El jugador se sienta en el suelo con la espalda apoyada en la pared','Sujeta el balón medicinal de 3 kg a la altura del pecho, codos hacia fuera','Lanza el balón hacia adelante lo más lejos posible con las dos manos','No puede levantarse del sitio ni dar un paso antes de lanzar','Medir la distancia desde la pared hasta el primer punto de impacto del balón','3 intentos, mejor resultado'],
    playerBriefing: '"Siéntate con la espalda en la pared. Balón en el pecho. Lánzalo lo más lejos que puedas con las dos manos. No te levantes del suelo."',
    scoring: { poor: '< 4.5 m', average: '4.5 – 6 m', good: '6 – 7.5 m', excellent: '> 7.5 m' },
    ref: '> 6 m nivel aceptable', lowerIsBetter: false,
    improveTip: 'Fuerza de tren superior (press banca, dominadas, fondos), trabajo de core y lanzamientos con balón medicinal.',
  },
  {
    name: '½ Squat 6 segundos (70% PC)', unit: 'rep', category: 'fuerza', icon: '🏋️',
    shortPurpose: 'Fuerza-velocidad de piernas — potencia explosiva sostenida',
    basketballValue: 'Mide qué tan rápido generan fuerza con las piernas en condiciones de fatiga parcial.',
    protocol: ['Colocar la barra a la altura de los hombros del jugador con carga = 70% de su peso corporal','El jugador realiza medias sentadillas (90° máximo) tan rápido como sea posible durante 6 segundos exactos','Contar cada repetición completa (abajo y arriba = 1 repetición)','El tempo es máximo — se busca velocidad, no profundidad','3 intentos con 5 min de recuperación entre ellos','Anotar el mayor número de repeticiones en los 6 segundos'],
    playerBriefing: '"Carga = 70% de tu peso. Medias sentadillas tan rápido como puedas durante 6 segundos. Máxima velocidad todo el rato."',
    scoring: { poor: '< 7 rep', average: '7 – 10 rep', good: '10 – 13 rep', excellent: '> 13 rep' },
    ref: '> 10 rep buen nivel', lowerIsBetter: false,
    improveTip: 'Fuerza máxima de piernas + trabajo de potencia con cargas altas y alta velocidad de ejecución.',
  },
  {
    name: '½ Squat 45 segundos (40% PC)', unit: 'rep', category: 'fuerza', icon: '⏱️',
    shortPurpose: 'Fuerza-resistencia de piernas — aguantar la intensidad a lo largo del partido',
    basketballValue: 'Mide si las piernas aguantan la intensidad sostenida. Un jugador con buen ½ Squat 45s no pierde potencia en los sprints del tercer y cuarto cuarto.',
    protocol: ['Carga = 40% del peso corporal del jugador (barra en hombros)','Medias sentadillas (90° máximo) en modo continuo durante 45 segundos','Ritmo alto pero sostenible','Contar repeticiones completas durante los 45 segundos','2-3 intentos con 8-10 min de recuperación','Anotar el mejor resultado'],
    playerBriefing: '"40% de tu peso, 45 segundos. Medias sentadillas continuas a buen ritmo. No pares."',
    scoring: { poor: '< 28 rep', average: '28 – 38 rep', good: '38 – 48 rep', excellent: '> 48 rep' },
    ref: '> 40 rep buen nivel', lowerIsBetter: false,
    improveTip: 'Ciclo de Resistencia de Fuerza (3-4×6-15, 55-70% 1RM, 3-4×/sem). Circuitos de sentadilla por tiempo.',
  },
  {
    name: 'TIVRE (Test Intermitente)', unit: 'nivel', category: 'resistencia', icon: '🔋',
    audioUrl: 'https://www.youtube.com/watch?v=evqvF9NEYXM',
    audioLabel: 'Audio oficial TIVRE (Test Intermitente 15-15)',
    shortPurpose: 'Potencia aeróbica específica — resistencia al esfuerzo intermitente real de partido',
    basketballValue: 'El más específico de los tests de resistencia para baloncesto. En un partido, no corres 12 minutos seguidos — corres, paras, corres, paras.',
    protocol: ['Marcar un circuito de 30m (o usar el protocolo específico del TIVRE)','El test alterna esfuerzos de 15s a ritmo alto con recuperaciones activas de 15s a ritmo bajo','Cada nivel incrementa la velocidad del esfuerzo en 0.5 km/h','El jugador para cuando no puede mantener el ritmo del nivel actual','Anotar el nivel alcanzado y calcular la VAM correspondiente','Requiere audio del TIVRE o sistema de cronometraje preciso'],
    playerBriefing: '"Es como el Course Navette pero con recuperaciones. 15 segundos fuerte, 15 segundos suave. El ritmo va subiendo. Para cuando no puedas más."',
    scoring: { poor: 'VAM < 13', average: 'VAM 13 – 15', good: 'VAM 15 – 17', excellent: 'VAM > 17' },
    ref: 'VAM > 16 km/h óptimo', lowerIsBetter: false,
    improveTip: 'Método interválico corto al 100-110% VAM (15s trabajo / 15s recuperación).',
  },
];

// ── Objetivos de entrenamiento ────────────────────────────────────────────────

export const TRAINING_GOALS = [
  {
    id: 'explosivo', emoji: '💥', title: 'Más explosivos',
    subtitle: 'Saltar más alto · Primera pasada ganada · Mejor en 1vs1',
    description: 'Trabajar la explosividad significa que tus jugadores llegarán antes al balón en disputa, ganarán metros en la primera aceleración y saltarán por encima de sus rivales.',
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
        { time: '5 min',  content: 'Vuelta a la calma + estiramientos' },
      ],
      keyPrinciple: 'Descanso COMPLETO entre series. La calidad de cada repetición es más importante que el volumen.',
      mistake: 'Error frecuente: hacer demasiadas repeticiones. Con explosividad menos es más — 4 series perfectas valen más que 8 mediocres.',
    },
  },
  {
    id: 'resistencia_sprint', emoji: '🔄', title: 'Aguantar más sprints',
    subtitle: 'Sin bajada de rendimiento en el 4º cuarto · Presión alta sostenida',
    description: 'El equipo que mantiene la intensidad en los últimos minutos gana los partidos igualados.',
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
        { time: '5 min',  content: 'Estiramientos' },
      ],
      keyPrinciple: 'La recuperación entre series es fundamental. Empieza con más descanso (1:4) e ir reduciéndolo semana a semana.',
      mistake: 'Error frecuente: hacer todo demasiado lento. Si el sprint no es al menos al 85% de la velocidad máxima, estás entrenando resistencia aeróbica, no resistencia al sprint.',
    },
  },
  {
    id: 'velocidad', emoji: '⚡', title: 'Más velocidad',
    subtitle: 'Ganar la primera pasada · Recuperación defensiva · Contraataque',
    description: 'La velocidad en baloncesto no es solo correr rápido — es reaccionar, acelerar en 2-3 pasos y llegar antes.',
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
        { time: '5 min',  content: 'Estiramientos y reflexión técnica' },
      ],
      keyPrinciple: 'La velocidad SOLO se mejora al 95-100% de intensidad. Y necesita recuperación COMPLETA entre repeticiones (1.5-2 min).',
      mistake: 'Error frecuente: entrenar velocidad cuando los jugadores están cansados (final de sesión). La velocidad va siempre AL PRINCIPIO de la sesión.',
    },
  },
  {
    id: 'fuerza', emoji: '💪', title: 'Más fuertes',
    subtitle: 'Ganar contactos · Aguantar defensas físicas · Mejorar salto a largo plazo',
    description: 'La fuerza es la base de todo: la velocidad, la explosividad y la resistencia mejoran más si primero hay una buena base de fuerza.',
    color: { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400', badge: 'bg-purple-500/20' },
    zone: 'fuerza', zoneName: 'Neuromuscular (Fuerza/Potencia)',
    keyTests: ['½ Squat 6 segundos (70% PC)', '½ Squat 45 segundos (40% PC)', 'Lanzamiento Balón Medicinal 3 kg'],
    prescription: {
      frequency: '3-4 sesiones/semana de fuerza (bloque pretemporada)',
      duration: 'Bloque concentrado: 5-6 semanas antes de temporada + 1-2×/sem durante temporada',
      structure: [
        { time: '10 min', content: 'Calentamiento específico: movilidad articular, activación muscular' },
        { time: '25 min', content: 'Fuerza piernas: ½ squat o sentadilla (principal). Series y carga según fase.' },
        { time: '15 min', content: 'Fuerza brazos/core: press banca, remo, cargadas. 3-4 series.' },
        { time: '10 min', content: 'Ejercicios transferencia: lanzamientos de balón medicinal, saltos con carga ligera' },
        { time: '10 min', content: 'Estiramientos completos — OBLIGATORIOS después de sesión de fuerza' },
      ],
      keyPrinciple: 'Secuencia: Resistencia de Fuerza → Hipertrofia → Fuerza Máxima → Potencia. No saltar fases.',
      mistake: 'Error frecuente: trabajar fuerza y pliometría el mismo día de partido o el día anterior. Dejar mínimo 48h.',
    },
  },
  {
    id: 'aerobico', emoji: '🫁', title: 'Mejor fondo aeróbico',
    subtitle: 'Base para todo lo demás · Recuperación más rápida · Más minutos de rendimiento',
    description: 'El fondo aeróbico es la "batería" del jugador. Con buena base aeróbica, el jugador se recupera más rápido entre esfuerzos.',
    color: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400', badge: 'bg-blue-500/20' },
    zone: 'aerobico', zoneName: 'Aeróbico (Sistema Oxidativo)',
    keyTests: ['Course Navette (Léger)', 'Test Mouche (28m × 12min)', 'TIVRE (Test Intermitente)'],
    prescription: {
      frequency: '2-3 sesiones aeróbicas/semana + trabajo técnico-táctico a ritmo elevado',
      duration: 'Base aeróbica: 6-8 semanas pretemporada. Mantener durante la temporada con 1-2 sesiones.',
      structure: [
        { time: '5 min',  content: 'Calentamiento suave' },
        { time: '35 min', content: 'OPCIÓN A — Continuo extensivo: carrera continua a 65-75% de la FCmáx (125-155 ppm).' },
        { time: '35 min', content: 'OPCIÓN B — Fartlek: carrera continua alternando 2 min suave / 1 min fuerte.' },
        { time: '5 min',  content: 'Vuelta a la calma + estiramientos' },
      ],
      keyPrinciple: 'La FC nunca debe bajar de 110 ppm en el entrenamiento. Zona óptima: 125-160 ppm.',
      mistake: 'Error frecuente: confundir "correr" con "entrenar aeróbico". Un jugador que trota 20 min muy suave no está desarrollando su potencia aeróbica.',
    },
  },
  {
    id: 'recuperacion', emoji: '🔋', title: 'Mejor recuperación',
    subtitle: 'Aguantar partidos seguidos · Reducir lesiones por fatiga · Segundas partes mejores',
    description: 'La capacidad de recuperación es lo que permite jugar bien el jueves después de ganar el martes.',
    color: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', badge: 'bg-emerald-500/20' },
    zone: 'mixto', zoneName: 'Aeróbico + Gestión de carga',
    keyTests: ['Course Navette (Léger)', 'TIVRE (Test Intermitente)'],
    prescription: {
      frequency: '1 sesión de recuperación activa/semana + monitorización de carga (RPE)',
      duration: 'Durante toda la temporada, especialmente en semanas de doble partido',
      structure: [
        { time: '30 min', content: 'SESIÓN DE RECUPERACIÓN ACTIVA: natación, bici estática o carrera muy suave (FC < 120 ppm).' },
        { time: '15 min', content: 'Estiramientos estáticos profundos. PNF si hay fisioterapeuta. Foam roller.' },
        { time: 'Diario', content: 'Registro de Wellness (Hooper Index): fatiga, dolor muscular, calidad de sueño.' },
      ],
      keyPrinciple: 'La ACWR debe estar entre 0.8 y 1.3. Por encima de 1.5 hay riesgo de lesión.',
      mistake: 'Error frecuente: creer que "descansar" es no hacer nada. La recuperación activa acelera la eliminación de lactato.',
    },
  },
];

// ── Categorías por edad ───────────────────────────────────────────────────────

export const PLAYER_CATEGORIES = [
  {
    id: 'minibasket', label: 'Mini / Alevín', ages: '8 – 11 años', icon: '🌱',
    color: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
    priority: 'Coordinación y hábito de movimiento',
    summary: 'Esta es la edad de ORO para la coordinación y el aprendizaje motor. No se trata de ganar partidos ni de hacer más fuertes a los jugadores — se trata de enseñarles a moverse bien.',
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
    warning: 'No especialices demasiado pronto. Un mini que juega a otros deportes se convierte en mejor jugador de baloncesto a los 16 años.',
  },
  {
    id: 'infantil', label: 'Infantil', ages: '12 – 13 años', icon: '🌿',
    color: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
    priority: 'Primer contacto con fuerza y resistencia aeróbica',
    summary: 'Edad de transición. Empiezan los cambios físicos y con ellos nuevas posibilidades de entrenamiento. Se puede empezar con trabajo de fuerza CON PESO CORPORAL.',
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
      { cap: 'Resistencia lática intensa (chicos)', note: '❌ Esperar a los 14-16 años.' },
    ],
    sessionStructure: [
      { block: 'Calentamiento', time: '15 min', content: 'Movilidad, coordinación, 3-4 progresivos de velocidad' },
      { block: 'Técnico/Táctico', time: '30-35 min', content: 'Trabajo técnico con balón y situaciones de juego' },
      { block: 'Físico', time: '15 min', content: 'Circuito de peso corporal (3 rondas): saltos, fondos, abdominales, desplazamientos laterales' },
      { block: 'Vuelta calma', time: '10 min', content: 'Estiramientos estáticos, feedback del entrenamiento' },
    ],
    warning: 'Cuidado con los períodos de crecimiento acelerado (picos de altura). Durante el "estirón" el jugador puede perder coordinación temporalmente.',
  },
  {
    id: 'cadete', label: 'Cadete', ages: '14 – 15 años', icon: '🌳',
    color: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
    priority: 'Inicio de trabajo de fuerza real + todas las capacidades',
    summary: 'El punto de inflexión. Con 14-15 años ya se puede entrenar prácticamente todo con las cargas adecuadas.',
    canTrain: [
      { cap: 'Fuerza resistencia con barra', note: '✅ Base para el trabajo de fuerza. Comenzar con cargas bajas y técnica perfecta.' },
      { cap: 'Resistencia lática (chicos)', note: '✅ Desde los 14-16 años en varones.' },
      { cap: 'Velocidad avanzada', note: '✅ Sprint, reacción, velocidad gestual.' },
      { cap: 'Resistencia aeróbica estructurada', note: '✅ Course Navette, Test Mouche, interválico corto.' },
      { cap: 'Pliometría básica', note: '✅ Multisaltos, saltos sobre vallas de altura baja.' },
      { cap: 'Todos los tests de la batería', note: '✅ Primer año de evaluación sistemática.' },
    ],
    cannotTrain: [
      { cap: 'Fuerza máxima a alta intensidad (>85% 1RM)', note: '⚠️ Solo si el desarrollo físico está completo.' },
    ],
    sessionStructure: [
      { block: 'Calentamiento', time: '15 min', content: 'Movilidad, activación, 3-4 aceleraciones progresivas' },
      { block: 'Técnico/Táctico', time: '35-40 min', content: 'Trabajo con balón, situaciones de partido' },
      { block: 'Físico', time: '20-25 min', content: 'Fuerza (2-3 ejercicios principales con barra/peso corporal) + 1 bloque de resistencia específica' },
      { block: 'Vuelta calma', time: '10 min', content: 'Estiramientos completos. Registro de carga (RPE).' },
    ],
    warning: 'Es la edad con mayor riesgo de sobreentrenamiento por el entusiasmo. Monitorizar el bienestar semana a semana.',
  },
  {
    id: 'junior', label: 'Junior / Senior', ages: '16+ años', icon: '🏆',
    color: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25' },
    priority: 'Desarrollo completo + Periodización avanzada',
    summary: 'Todas las capacidades disponibles. La limitación ya no es biológica sino de tiempo y planificación.',
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
    warning: 'Con jugadores senior ya formados, lo más importante es la gestión de la fatiga acumulada. El descanso es parte del entrenamiento.',
  },
];

// ── Planes semanales ──────────────────────────────────────────────────────────

export const WEEKLY_PLANS: Record<string, Record<number, { day: string; focus: string; details: string; intensity: 'alta' | 'media' | 'baja' | 'libre' }[]>> = {
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

// ── Prevención de lesiones ────────────────────────────────────────────────────

export const INJURY_PREVENTION = [
  {
    id: 'tobillo', area: 'Tobillo', icon: '🦶', risk: 'Muy alto', riskColor: 'text-red-400',
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
    id: 'rodilla', area: 'Rodilla (LCA + Rotuliano)', icon: '🦵', risk: 'Alto', riskColor: 'text-emerald-400',
    prevalence: '15-20% de las lesiones. El LCA es la lesión más temida por su impacto en la carrera.',
    mechanism: 'Valgo dinámico de rodilla (rodilla hacia dentro) en aterrizajes y cambios de dirección. Mayor riesgo en chicas jóvenes.',
    methods: [
      { name: 'Programa FIFA 11+ Basketball / PEP Protocol', dose: '15-20 min · Antes de cada sesión · Todo el año', effect: 'Reduce lesiones de LCA hasta un 62% en deportes de equipo', phase: 'Calentamiento OBLIGATORIO' },
      { name: 'Nórdicos de isquiotibiales', dose: '3x6-8 reps con progresión semanal', effect: 'El ejercicio con mayor evidencia para prevenir lesiones musculares del tren inferior', phase: 'Bloque físico' },
      { name: 'Sentadilla monopodal (pistol squat)', dose: '3x8 por pierna · Controlado y lento', effect: 'Detecta y corrige asimetrías. Fortalece glúteo medio y vasto medial', phase: 'Fuerza' },
      { name: 'Aterrizajes con retroalimentación visual (espejo/vídeo)', dose: '10 min · 2 veces/semana', effect: 'El feedback visual corrige el valgo de rodilla en aterrizajes', phase: 'Técnico' },
    ],
    tip: 'Analiza siempre los aterrizajes en saltos. Si ves rodillas hacia dentro, PARA y corrige.',
  },
  {
    id: 'espalda', area: 'Zona lumbar', icon: '🏋️', risk: 'Medio', riskColor: 'text-yellow-400',
    prevalence: '10-15% de los jugadores en categoría cadete-junior-senior.',
    mechanism: 'Debilidad del core, fatiga muscular acumulada y sobrecarga de extensión lumbar.',
    methods: [
      { name: 'Plancha frontal + lateral', dose: '3x30-45s · Sin compensaciones', effect: 'Base de la estabilidad lumbo-pélvica. Reduce la presión discal en movimientos explosivos', phase: 'Core / Post-sesión' },
      { name: 'Dead bug', dose: '3x10 por lado · Lento y controlado', effect: 'Activa el transverso abdominal sin sobrecargar la columna', phase: 'Core' },
      { name: 'Bird dog', dose: '3x10 por lado', effect: 'Estabilidad lumbar con disociación cadera-columna', phase: 'Core' },
      { name: 'Hip hinge (bisagra de cadera)', dose: '3x10 · Enseñar el patrón motor correcto', effect: 'Corrige la tendencia a flexionar la columna en lugar de la cadera', phase: 'Técnico / Fuerza' },
    ],
    tip: 'Dedica 10 minutos al core al final de CADA sesión física.',
  },
  {
    id: 'hombro', area: 'Hombro y manguito rotador', icon: '💪', risk: 'Medio', riskColor: 'text-yellow-400',
    prevalence: '8-12%. Más frecuente en lanzadores frecuentes (bases, escoltas).',
    mechanism: 'Desequilibrio entre rotadores internos (potentes) y rotadores externos (débiles).',
    methods: [
      { name: "Rotación externa con banda (Thrower's Ten)", dose: '3x15 reps · A velocidad media · Diario', effect: 'El protocolo más validado para equilibrar la musculatura del hombro en deportes de lanzamiento', phase: 'Pre/Post sesión' },
      { name: 'Face pull con banda elástica', dose: '3x15-20 reps', effect: 'Activa deltoides posterior y manguito rotador externo', phase: 'Post-sesión' },
      { name: 'Sleeping stretch (estiramiento cápsula posterior)', dose: '3x30s por brazo', effect: 'Aumenta la rotación interna y reduce la tensión posterior del hombro', phase: 'Vuelta a la calma' },
    ],
    tip: 'Cada 10 minutos de tiro = 1 set de rotación externa.',
  },
  {
    id: 'sobrecarga', area: 'Gestión de la carga (overtraining)', icon: '📊', risk: 'Transversal', riskColor: 'text-purple-400',
    prevalence: 'No es una lesión, es la causa raíz del 60-70% de las lesiones en temporada.',
    mechanism: 'La carga aguda supera la capacidad de recuperación del jugador. ACWR > 1.5.',
    methods: [
      { name: 'Ratio Carga Aguda:Crónica (ACWR) ≤ 1.3', dose: 'Monitorización semanal del RPE x duración', effect: 'Zona verde: 0.8-1.3. Zona roja: >1.5.', phase: 'Planificación' },
      { name: 'Regla del 10%', dose: 'No aumentar la carga semanal más del 10% respecto a la semana anterior', effect: 'Permite una adaptación gradual del tejido conectivo', phase: 'Planificación' },
      { name: 'Sesiones de recuperación activa', dose: '1-2 sesiones/semana de baja intensidad (RPE 3-4)', effect: 'Mejoran la recuperación sin añadir fatiga', phase: 'Semanal' },
      { name: 'Wellness matutino (calidad sueño, fatiga, dolor muscular)', dose: 'Encuesta de 1 min antes del entrenamiento', effect: 'El mejor predictor de lesión inminente.', phase: 'Diario (módulo Wellness)' },
    ],
    tip: 'La lesión más fácil de tratar es la que no ocurre. Los 10 minutos de prevención que haces HOY son los 3 meses de baja que no tendrás en febrero.',
  },
];
