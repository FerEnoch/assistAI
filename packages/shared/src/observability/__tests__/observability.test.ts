import { describe, it, expect } from 'vitest';
import {
  REDACTED_PATHS,
  OBSERVABILITY_CONFIG,
  BETA_KPIS,
  PRIVACY_DISCLOSURES,
  BETA_ONBOARDING_STEPS,
  BETA_RECRUITMENT,
  TRIAGE_RUBRIC,
  WEEKLY_REVIEW_AGENDA,
  GO_NOGO_CRITERIA,
  evaluateGoNoGo,
  createAnalyticsEvent,
  initTracing,
  createSpanContext,
} from '../../index';

/**
 * Sprint 6 — Observability & Beta Operations tests.
 * Covers A-093, A-096, A-100, A-102, A-103, A-104, A-110 to A-114.
 */
describe('Observability', () => {
  describe('Secret Redaction (A-093)', () => {
    it('should define redaction paths for all sensitive fields', () => {
      expect(REDACTED_PATHS).toBeDefined();
      expect(REDACTED_PATHS.length).toBeGreaterThan(10);

      // Must redact auth headers
      expect(REDACTED_PATHS).toContain('req.headers.authorization');
      expect(REDACTED_PATHS).toContain('req.headers.cookie');

      // Must redact tokens
      expect(REDACTED_PATHS).toContain('token');
      expect(REDACTED_PATHS).toContain('refreshToken');
      expect(REDACTED_PATHS).toContain('accessToken');
      expect(REDACTED_PATHS).toContain('apiKey');

      // Must redact encrypted fields
      expect(REDACTED_PATHS).toContain('googleRefreshTokenEnc');

      // Must redact secrets
      expect(REDACTED_PATHS).toContain('password');
      expect(REDACTED_PATHS).toContain('secret');
    });

    it('should include wildcard patterns for nested objects', () => {
      const wildcards = REDACTED_PATHS.filter((p) => p.startsWith('*.'));
      expect(wildcards.length).toBeGreaterThan(5);
      expect(wildcards).toContain('*.password');
      expect(wildcards).toContain('*.apiKey');
    });
  });

  describe('Observability Config (A-100)', () => {
    it('should define standard paths and settings', () => {
      expect(OBSERVABILITY_CONFIG.metricsPath).toBe('/metrics');
      expect(OBSERVABILITY_CONFIG.healthPath).toBe('/health');
      expect(OBSERVABILITY_CONFIG.traceSampleRate).toBe(0.1);
      expect(OBSERVABILITY_CONFIG.serviceNamePrefix).toBe('assistai');
    });
  });

  describe('OpenTelemetry Tracing (A-102)', () => {
    it('should return false when OTLP endpoint is not set', () => {
      const original = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

      const result = initTracing({ serviceName: 'test' });
      expect(result).toBe(false);

      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = original;
    });

    it('should return true when OTLP endpoint is configured', () => {
      const result = initTracing({
        serviceName: 'test',
        otlpEndpoint: 'http://localhost:4318',
      });
      expect(result).toBe(true);
    });

    it('should create span context with timing', async () => {
      const span = createSpanContext('test.operation', { key: 'value' });
      expect(span.operationName).toBe('test.operation');
      expect(span.attributes.key).toBe('value');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = span.end({ outcome: 'success' });
      expect(result.operationName).toBe('test.operation');
      expect(result.durationMs).toBeGreaterThanOrEqual(5);
      expect(result.attributes.outcome).toBe('success');
      expect(result.attributes.key).toBe('value');
    });
  });

  describe('Product Analytics (A-103)', () => {
    it('should create analytics events with timestamp', () => {
      const event = createAnalyticsEvent(
        'completion.requested',
        'ws-123',
        { latencyMs: 500, isGrounded: true },
        'user-456',
      );

      expect(event.name).toBe('completion.requested');
      expect(event.workspaceId).toBe('ws-123');
      expect(event.userId).toBe('user-456');
      expect(event.properties.latencyMs).toBe(500);
      expect(event.timestamp).toBeDefined();
      expect(new Date(event.timestamp).getTime()).not.toBeNaN();
    });

    it('should work without userId for system events', () => {
      const event = createAnalyticsEvent('document.indexed', 'ws-123', { count: 5 });
      expect(event.userId).toBeUndefined();
    });
  });

  describe('Beta KPIs (A-104)', () => {
    it('should define all required KPIs', () => {
      expect(BETA_KPIS.WAU).toBeDefined();
      expect(BETA_KPIS.acceptanceRate).toBeDefined();
      expect(BETA_KPIS.groundingRate).toBeDefined();
      expect(BETA_KPIS.p95Latency).toBeDefined();
      expect(BETA_KPIS.docsPerWorkspace).toBeDefined();
      expect(BETA_KPIS.errorRate).toBeDefined();
    });

    it('should have targets for all KPIs', () => {
      for (const [, kpi] of Object.entries(BETA_KPIS)) {
        expect(kpi.name).toBeDefined();
        expect(kpi.target).toBeDefined();
        expect(kpi.query).toBeDefined();
      }
    });
  });
});

describe('Beta Operations', () => {
  describe('Privacy Disclosures (A-096)', () => {
    it('should provide all required disclosure sections', () => {
      expect(PRIVACY_DISCLOSURES.dataCollection).toBeDefined();
      expect(PRIVACY_DISCLOSURES.driveConnection).toBeDefined();
      expect(PRIVACY_DISCLOSURES.aiUsage).toBeDefined();
      expect(PRIVACY_DISCLOSURES.cookies).toBeDefined();
      expect(PRIVACY_DISCLOSURES.deletion).toBeDefined();
      expect(PRIVACY_DISCLOSURES.betaTerms).toBeDefined();
    });

    it('should have all text in Spanish', () => {
      // Check for Spanish content markers
      expect(PRIVACY_DISCLOSURES.dataCollection.title).toContain('datos');
      expect(PRIVACY_DISCLOSURES.driveConnection.title).toContain('Google Drive');
      expect(PRIVACY_DISCLOSURES.cookies.body).toContain('cookies');
      expect(PRIVACY_DISCLOSURES.deletion.body).toContain('derecho');
    });

    it('should include consent checkbox text', () => {
      expect(PRIVACY_DISCLOSURES.consentCheckbox).toBeDefined();
      expect(PRIVACY_DISCLOSURES.consentCheckbox).toContain('Acepto');
    });

    it('should include short summary', () => {
      expect(PRIVACY_DISCLOSURES.shortSummary).toBeDefined();
      expect(PRIVACY_DISCLOSURES.shortSummary).toContain('encripta');
    });
  });

  describe('Beta Onboarding (A-110)', () => {
    it('should define ordered onboarding steps', () => {
      expect(BETA_ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(5);

      // Check ordering
      for (let i = 1; i < BETA_ONBOARDING_STEPS.length; i++) {
        expect(BETA_ONBOARDING_STEPS[i].order).toBeGreaterThan(
          BETA_ONBOARDING_STEPS[i - 1].order,
        );
      }
    });

    it('should have required steps for core flow', () => {
      const requiredSteps = BETA_ONBOARDING_STEPS.filter((s) => s.required);
      expect(requiredSteps.length).toBeGreaterThanOrEqual(4);

      const requiredIds = requiredSteps.map((s) => s.id);
      expect(requiredIds).toContain('accept-terms');
      expect(requiredIds).toContain('connect-drive');
      expect(requiredIds).toContain('select-documents');
    });
  });

  describe('Beta Recruitment (A-111)', () => {
    it('should define target users and profiles', () => {
      expect(BETA_RECRUITMENT.targetUsers).toBeGreaterThanOrEqual(10);
      expect(BETA_RECRUITMENT.targetProfiles.length).toBeGreaterThanOrEqual(3);
    });

    it('should have recruitment channels with priorities', () => {
      expect(BETA_RECRUITMENT.channels.length).toBeGreaterThanOrEqual(3);
      const priorities = BETA_RECRUITMENT.channels.map((c) => c.priority);
      expect(priorities).toContain('high');
    });

    it('should have screening criteria', () => {
      expect(BETA_RECRUITMENT.screeningCriteria.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Triage Rubric (A-112)', () => {
    it('should define all severity levels', () => {
      const severities = TRIAGE_RUBRIC.map((r) => r.severity);
      expect(severities).toContain('P0-critical');
      expect(severities).toContain('P1-high');
      expect(severities).toContain('P2-medium');
      expect(severities).toContain('P3-low');
    });

    it('should have SLAs for each severity', () => {
      for (const rule of TRIAGE_RUBRIC) {
        expect(rule.sla).toBeDefined();
        expect(rule.sla.length).toBeGreaterThan(0);
      }
    });

    it('should have criteria and examples for each severity', () => {
      for (const rule of TRIAGE_RUBRIC) {
        expect(rule.criteria.length).toBeGreaterThanOrEqual(3);
        expect(rule.examples.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Weekly Review (A-113)', () => {
    it('should define review cadence and participants', () => {
      expect(WEEKLY_REVIEW_AGENDA.cadence).toBeDefined();
      expect(WEEKLY_REVIEW_AGENDA.duration).toBeDefined();
      expect(WEEKLY_REVIEW_AGENDA.participants.length).toBeGreaterThanOrEqual(2);
    });

    it('should have structured sections', () => {
      expect(WEEKLY_REVIEW_AGENDA.sections.length).toBeGreaterThanOrEqual(4);

      for (const section of WEEKLY_REVIEW_AGENDA.sections) {
        expect(section.name).toBeDefined();
        expect(section.items.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('Go/No-Go Criteria (A-114)', () => {
    it('should define criteria across all categories', () => {
      const categories = [...new Set(GO_NOGO_CRITERIA.map((c) => c.category))];
      expect(categories).toContain('product');
      expect(categories).toContain('technical');
      expect(categories).toContain('operational');
    });

    it('should have must-have criteria for each category', () => {
      const mustHaves = GO_NOGO_CRITERIA.filter((c) => c.weight === 'must-have');
      expect(mustHaves.length).toBeGreaterThanOrEqual(8);
    });

    it('should evaluate go/no-go correctly — all pass', () => {
      const allPass: Record<string, boolean> = {};
      for (const c of GO_NOGO_CRITERIA) {
        allPass[c.id] = true;
      }

      const result = evaluateGoNoGo(allPass);
      expect(result.passed).toBe(true);
      expect(result.mustHavesPassed).toBe(result.mustHavesTotal);
    });

    it('should evaluate go/no-go correctly — must-have fails', () => {
      const partial: Record<string, boolean> = {};
      for (const c of GO_NOGO_CRITERIA) {
        partial[c.id] = c.weight === 'nice-to-have';
      }

      const result = evaluateGoNoGo(partial);
      expect(result.passed).toBe(false);
      expect(result.mustHavesPassed).toBe(0);
    });

    it('should pass when all must-haves pass but nice-to-haves fail', () => {
      const results: Record<string, boolean> = {};
      for (const c of GO_NOGO_CRITERIA) {
        results[c.id] = c.weight === 'must-have';
      }

      const result = evaluateGoNoGo(results);
      expect(result.passed).toBe(true);
    });
  });
});
