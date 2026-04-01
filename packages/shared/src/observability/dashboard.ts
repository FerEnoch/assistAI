/**
 * KPI Dashboard configuration (A-104).
 *
 * Defines Grafana dashboard panels, queries, and alert thresholds
 * for the beta monitoring dashboard. Uses Prometheus as data source.
 *
 * Dashboard sections:
 * 1. System Health — uptime, latency, error rate
 * 2. Product Usage — completions, acceptance rate, WAU
 * 3. Infrastructure — queue depth, DB connections, memory
 * 4. Business KPIs — grounding rate, docs indexed, provider spend
 */

export interface DashboardPanel {
  title: string;
  type: 'gauge' | 'timeseries' | 'stat' | 'table' | 'heatmap';
  promQL: string;
  thresholds?: { warning: number; critical: number };
  unit?: string;
  description: string;
}

export const KPI_DASHBOARD: Record<string, DashboardPanel[]> = {
  /** System Health panels */
  systemHealth: [
    {
      title: 'API Uptime',
      type: 'stat',
      promQL: 'up{service="assistai-api"}',
      thresholds: { warning: 0.99, critical: 0.95 },
      unit: 'percentunit',
      description: 'Porcentaje de uptime del servicio API',
    },
    {
      title: 'P95 Request Latency',
      type: 'timeseries',
      promQL: 'histogram_quantile(0.95, rate(assistai_http_request_duration_seconds_bucket[5m]))',
      thresholds: { warning: 1, critical: 3 },
      unit: 's',
      description: 'Latencia P95 de todas las requests HTTP',
    },
    {
      title: 'Error Rate (5xx)',
      type: 'timeseries',
      promQL: 'sum(rate(assistai_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(assistai_http_requests_total[5m])) * 100',
      thresholds: { warning: 1, critical: 5 },
      unit: 'percent',
      description: 'Porcentaje de respuestas 5xx en los últimos 5 minutos',
    },
    {
      title: 'Health Check Status',
      type: 'table',
      promQL: 'assistai_health_check_status',
      description: 'Estado de dependencias (PostgreSQL, Redis)',
    },
  ],

  /** Product Usage panels */
  productUsage: [
    {
      title: 'Completions per Minute',
      type: 'timeseries',
      promQL: 'sum(rate(assistai_completions_total[1m])) * 60',
      unit: 'cpm',
      description: 'Completions solicitadas por minuto',
    },
    {
      title: 'Acceptance Rate',
      type: 'gauge',
      promQL: 'sum(rate(assistai_completions_total{outcome="accepted"}[1h])) / sum(rate(assistai_completions_total{outcome=~"accepted|rejected"}[1h])) * 100',
      thresholds: { warning: 30, critical: 15 },
      unit: 'percent',
      description: 'Porcentaje de completions aceptadas por el usuario',
    },
    {
      title: 'P95 Completion Latency',
      type: 'timeseries',
      promQL: 'histogram_quantile(0.95, rate(assistai_completion_latency_seconds_bucket[5m]))',
      thresholds: { warning: 3, critical: 5 },
      unit: 's',
      description: 'Latencia P95 del pipeline completo de completion',
    },
    {
      title: 'Active Editor Sessions',
      type: 'stat',
      promQL: 'assistai_active_connections{type="sse"}',
      description: 'Sesiones de editor activas en este momento',
    },
    {
      title: 'Evidence Grounding Rate',
      type: 'gauge',
      promQL: 'sum(rate(assistai_completions_total{is_grounded="true"}[1h])) / sum(rate(assistai_completions_total[1h])) * 100',
      thresholds: { warning: 50, critical: 25 },
      unit: 'percent',
      description: 'Porcentaje de completions con evidencia documental',
    },
  ],

  /** Infrastructure panels */
  infrastructure: [
    {
      title: 'Queue Depth — Ingestion',
      type: 'timeseries',
      promQL: 'assistai_queue_depth{queue_name=~"ingestion.*"}',
      thresholds: { warning: 100, critical: 500 },
      description: 'Jobs pendientes en las colas de ingestion',
    },
    {
      title: 'Job Processing Time',
      type: 'heatmap',
      promQL: 'rate(assistai_job_duration_seconds_bucket[5m])',
      unit: 's',
      description: 'Distribución de tiempo de procesamiento de jobs',
    },
    {
      title: 'Database Connections',
      type: 'timeseries',
      promQL: 'pg_stat_activity_count{datname="assistai"}',
      thresholds: { warning: 80, critical: 95 },
      description: 'Conexiones activas a PostgreSQL',
    },
    {
      title: 'Memory Usage',
      type: 'timeseries',
      promQL: 'process_resident_memory_bytes{service=~"assistai.*"} / 1024 / 1024',
      thresholds: { warning: 512, critical: 1024 },
      unit: 'MB',
      description: 'Uso de memoria RSS por servicio',
    },
  ],

  /** Business KPIs — for weekly review */
  businessKpis: [
    {
      title: 'Weekly Active Users',
      type: 'stat',
      promQL: 'count(count by (userId) (assistai_completions_total offset 0s))',
      thresholds: { warning: 10, critical: 5 },
      description: 'Usuarios únicos con al menos 1 completion en los últimos 7 días',
    },
    {
      title: 'Documents Indexed',
      type: 'stat',
      promQL: 'sum(assistai_documents_indexed_total)',
      description: 'Total de documentos indexados en el sistema',
    },
    {
      title: 'Provider Error Rate',
      type: 'timeseries',
      promQL: 'sum(rate(assistai_provider_errors_total[1h]))',
      thresholds: { warning: 0.01, critical: 0.05 },
      unit: 'errors/s',
      description: 'Errores del proveedor de IA por segundo',
    },
  ],
} as const;
