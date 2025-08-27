import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { getSupabase } from './supabaseClient';
import { getSessionId } from './session';

type MetricName = 'CLS' | 'FCP' | 'LCP' | 'TTFB' | 'INP';

interface VitalsPayload {
  session_id: string | null;
  route: string;
  metric: MetricName;
  value: number;
  nav_type?: string | null;
  device_mem?: number | null;
  hardware_concurrency?: number | null;
  effective_connection_type?: string | null;
}

// Track if we've already reported vitals for this route
const reportedVitals = new Set<string>();

// Create a unique key for this route and metric
function getVitalsKey(route: string, metric: string): string {
  return `${route}:${metric}`;
}

async function insertWebVital(payload: VitalsPayload) {
  // Try to include optional device context, but don't break if DB doesn't have those columns
  const extras: Record<string, unknown> = {};
  
  if (typeof navigator !== 'undefined') {
    const dm = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof dm === 'number') extras.device_mem = dm;

    const hc = navigator?.hardwareConcurrency;
    if (typeof hc === 'number') extras.hardware_concurrency = hc;

    const ect = (navigator as { connection?: { effectiveType?: string } })?.connection?.effectiveType;
    if (typeof ect === 'string') extras.effective_connection_type = ect;
  }

  const base = {
    session_id: payload.session_id,
    route: payload.route,
    metric: payload.metric,
    value: payload.value,
    nav_type: payload.nav_type,
  };

  const supabase = getSupabase();
  // 1st attempt: base + extras
  let { error } = await supabase.from('web_vitals').insert({ ...base, ...extras });

  // If Supabase complains about unknown columns, retry with base only
  if (error && (error.code === 'PGRST204' || /column .* does not exist/i.test(error.message))) {
    ({ error } = await supabase.from('web_vitals').insert(base));
  }

  if (error && process.env.NODE_ENV === 'development') {
    console.info('Web vitals report failed:', error);
    console.info('Data that failed to insert:', { ...base, ...extras });
  }
}

// Report a single web vital metric
function reportMetric(metric: MetricName, value: number, route: string) {
  const key = getVitalsKey(route, metric);
  
  // Only report once per route per metric
  if (reportedVitals.has(key)) {
    return;
  }

  const sessionId = typeof window !== 'undefined' ? getSessionId() : null;
  const navType = typeof performance !== 'undefined' && performance.getEntriesByType ? 
    performance.getEntriesByType('navigation')[0]?.type || null : null;

  // Mark as reported
  reportedVitals.add(key);

  // Report asynchronously without blocking
  insertWebVital({ session_id: sessionId, route, metric, value, nav_type: navType });
}

// Initialize web vitals tracking for a route
export function initWebVitals(route: string) {
  if (typeof window === 'undefined') return;

  // Clear any existing reports for this route
  const routeKeys = Array.from(reportedVitals.keys()).filter(key => key.startsWith(route + ':'));
  routeKeys.forEach(key => reportedVitals.delete(key));

  // Track Core Web Vitals
  onCLS((metric: Metric) => reportMetric('CLS', metric.value, route));
  onFCP((metric: Metric) => reportMetric('FCP', metric.value, route));
  onLCP((metric: Metric) => reportMetric('LCP', metric.value, route));
  onTTFB((metric: Metric) => reportMetric('TTFB', metric.value, route));
  onINP((metric: Metric) => reportMetric('INP', metric.value, route));
}
