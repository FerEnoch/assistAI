/**
 * Beta operations configuration (A-110 to A-114).
 *
 * Defines operational parameters for the AssistAI beta program:
 * - Onboarding flow steps (A-110)
 * - User recruitment criteria (A-111)
 * - Bug triage rubric (A-112)
 * - Weekly review agenda (A-113)
 * - Go/no-go decision criteria (A-114)
 */

// ── A-110: Beta Onboarding ──

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
}

export const BETA_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'accept-terms',
    title: 'Aceptar términos del programa beta',
    description: 'Revisá y aceptá los términos de uso y la política de privacidad.',
    required: true,
    order: 1,
  },
  {
    id: 'connect-drive',
    title: 'Conectar Google Drive',
    description: 'Conectá tu cuenta de Google Drive para indexar tus documentos legales.',
    required: true,
    order: 2,
  },
  {
    id: 'select-documents',
    title: 'Seleccionar documentos',
    description: 'Elegí las carpetas o archivos que querés usar como contexto para las sugerencias.',
    required: true,
    order: 3,
  },
  {
    id: 'wait-indexing',
    title: 'Esperá la indexación',
    description: 'Tus documentos se están procesando. Esto puede tomar unos minutos.',
    required: true,
    order: 4,
  },
  {
    id: 'first-completion',
    title: 'Tu primera sugerencia',
    description: 'Empezá a escribir en el editor y recibí tu primera sugerencia de IA.',
    required: false,
    order: 5,
  },
  {
    id: 'configure-provider',
    title: 'Configurar proveedor de IA (opcional)',
    description: 'Si tenés tu propia clave de API, podés configurar un proveedor personalizado.',
    required: false,
    order: 6,
  },
];

// ── A-111: Beta User Recruitment ──

export const BETA_RECRUITMENT = {
  /** Target number of beta users */
  targetUsers: 20,

  /** Target professional profiles */
  targetProfiles: [
    'Abogados/as litigantes',
    'Abogados/as corporativos',
    'Notarios/as',
    'Asistentes legales',
    'Profesores/as de derecho',
  ],

  /** Recruitment channels */
  channels: [
    { name: 'LinkedIn — grupos de abogados argentinos', priority: 'high' },
    { name: 'Colegios de abogados (CPACF, CABA)', priority: 'high' },
    { name: 'Referidos de usuarios existentes', priority: 'medium' },
    { name: 'Comunidades de legal tech', priority: 'medium' },
    { name: 'Universidades — clínicas jurídicas', priority: 'low' },
  ],

  /** Screening criteria */
  screeningCriteria: [
    'Usa Google Drive para almacenar documentos legales',
    'Escribe al menos 5 documentos legales por semana',
    'Tiene disponibilidad para dar feedback semanal',
    'Habla español como lengua principal de trabajo',
  ],

  /** Invitation email subject (Spanish) */
  invitationSubject: 'Invitación al programa beta de AssistAI — Asistente de escritura legal con IA',
} as const;

// ── A-112: Triage Rubric ──

export type BugSeverity = 'P0-critical' | 'P1-high' | 'P2-medium' | 'P3-low';

export interface TriageRule {
  severity: BugSeverity;
  sla: string;
  criteria: string[];
  examples: string[];
}

export const TRIAGE_RUBRIC: TriageRule[] = [
  {
    severity: 'P0-critical',
    sla: 'Fix within 4 hours',
    criteria: [
      'Data loss or corruption',
      'Security vulnerability (exposed credentials, SSRF bypass)',
      'Service completely down (API 5xx on all endpoints)',
      'Authentication bypass',
    ],
    examples: [
      'Tokens de Google Drive visibles en logs',
      'Documentos de un workspace visibles en otro',
      'API no responde en ningún endpoint',
    ],
  },
  {
    severity: 'P1-high',
    sla: 'Fix within 24 hours',
    criteria: [
      'Core feature broken (completions, indexing)',
      'Performance degradation >5x normal',
      'Errors affecting >20% of users',
      'Data not syncing from Drive',
    ],
    examples: [
      'Completions siempre devuelven timeout',
      'Indexación falla para todos los PDFs',
      'Editor no carga para algunos usuarios',
    ],
  },
  {
    severity: 'P2-medium',
    sla: 'Fix within 1 week',
    criteria: [
      'Feature partially broken',
      'UI/UX issues affecting usability',
      'Performance degradation <5x',
      'Non-critical error states incorrect',
    ],
    examples: [
      'Panel de evidencia no muestra deep-links',
      'Ghost-text se corta en oraciones largas',
      'Mensajes de error en inglés en vez de español',
    ],
  },
  {
    severity: 'P3-low',
    sla: 'Fix within 1 sprint',
    criteria: [
      'Cosmetic issues',
      'Minor UX improvements',
      'Documentation gaps',
      'Edge cases with workarounds',
    ],
    examples: [
      'Tooltip de botón mal posicionado',
      'Falta ícono en estado vacío',
      'Texto de placeholder podría ser más claro',
    ],
  },
];

// ── A-113: Weekly Review Agenda ──

export const WEEKLY_REVIEW_AGENDA = {
  cadence: 'Every Monday, 10:00 AM ART',
  duration: '45 minutes',
  participants: ['Product lead', 'Engineering lead', 'Beta liaison'],
  sections: [
    {
      name: '1. KPI Review (10 min)',
      items: [
        'WAU trend (target: ≥10)',
        'Completion acceptance rate (target: ≥30%)',
        'Evidence grounding rate (target: ≥50%)',
        'P95 latency (target: ≤3s)',
        'Error rate (target: ≤5%)',
      ],
    },
    {
      name: '2. User Feedback (10 min)',
      items: [
        'NPS/CSAT scores if available',
        'Top 3 user complaints this week',
        'Top 3 feature requests',
        'Any churned users (reason)',
      ],
    },
    {
      name: '3. Bug Review (10 min)',
      items: [
        'P0/P1 bugs open and resolved',
        'P2 bugs trending up',
        'New bugs reported this week',
        'SLA compliance',
      ],
    },
    {
      name: '4. Infrastructure (5 min)',
      items: [
        'Uptime %',
        'Provider spend / budget',
        'Queue backlog trends',
        'Any scaling concerns',
      ],
    },
    {
      name: '5. Actions & Decisions (10 min)',
      items: [
        'Action items from last week — status',
        'New action items',
        'Go/no-go checkpoint if applicable',
      ],
    },
  ],
} as const;

// ── A-114: Go/No-Go Criteria ──

export interface GoNoGoCriterion {
  id: string;
  category: 'product' | 'technical' | 'operational';
  criterion: string;
  threshold: string;
  weight: 'must-have' | 'nice-to-have';
}

export const GO_NOGO_CRITERIA: GoNoGoCriterion[] = [
  // Product criteria
  {
    id: 'GNG-01',
    category: 'product',
    criterion: 'Weekly Active Users',
    threshold: '≥ 10 users with ≥ 3 completions/week',
    weight: 'must-have',
  },
  {
    id: 'GNG-02',
    category: 'product',
    criterion: 'Completion Acceptance Rate',
    threshold: '≥ 30% of completions accepted (Tab)',
    weight: 'must-have',
  },
  {
    id: 'GNG-03',
    category: 'product',
    criterion: 'Evidence Grounding Rate',
    threshold: '≥ 50% of completions include document evidence',
    weight: 'must-have',
  },
  {
    id: 'GNG-04',
    category: 'product',
    criterion: 'User Satisfaction',
    threshold: 'NPS ≥ 20 or qualitative positive feedback from ≥ 60% of users',
    weight: 'nice-to-have',
  },

  // Technical criteria
  {
    id: 'GNG-05',
    category: 'technical',
    criterion: 'P95 Completion Latency',
    threshold: '≤ 3 seconds end-to-end',
    weight: 'must-have',
  },
  {
    id: 'GNG-06',
    category: 'technical',
    criterion: 'Error Rate',
    threshold: '≤ 5% of completion requests result in errors',
    weight: 'must-have',
  },
  {
    id: 'GNG-07',
    category: 'technical',
    criterion: 'Uptime',
    threshold: '≥ 99% uptime over 2-week rolling window',
    weight: 'must-have',
  },
  {
    id: 'GNG-08',
    category: 'technical',
    criterion: 'Zero P0 Bugs',
    threshold: 'No open P0-critical bugs for ≥ 7 consecutive days',
    weight: 'must-have',
  },

  // Operational criteria
  {
    id: 'GNG-09',
    category: 'operational',
    criterion: 'Monitoring Coverage',
    threshold: 'All KPI dashboard panels active and alerting',
    weight: 'must-have',
  },
  {
    id: 'GNG-10',
    category: 'operational',
    criterion: 'Deletion Flow Verified',
    threshold: 'Workspace and account deletion tested and working',
    weight: 'must-have',
  },
  {
    id: 'GNG-11',
    category: 'operational',
    criterion: 'Privacy Disclosures Published',
    threshold: 'All privacy text reviewed by legal and displayed in UI',
    weight: 'must-have',
  },
  {
    id: 'GNG-12',
    category: 'operational',
    criterion: 'Runbook Documented',
    threshold: 'Common operations documented for on-call',
    weight: 'nice-to-have',
  },
];

/**
 * Evaluate go/no-go readiness.
 *
 * @returns Object with pass/fail for each criterion and overall verdict
 */
export function evaluateGoNoGo(
  results: Record<string, boolean>,
): {
  passed: boolean;
  mustHavesPassed: number;
  mustHavesTotal: number;
  details: Array<{ id: string; criterion: string; weight: string; passed: boolean }>;
} {
  const details = GO_NOGO_CRITERIA.map((c) => ({
    id: c.id,
    criterion: c.criterion,
    weight: c.weight,
    passed: results[c.id] ?? false,
  }));

  const mustHaves = details.filter((d) => d.weight === 'must-have');
  const mustHavesPassed = mustHaves.filter((d) => d.passed).length;

  return {
    passed: mustHavesPassed === mustHaves.length,
    mustHavesPassed,
    mustHavesTotal: mustHaves.length,
    details,
  };
}
