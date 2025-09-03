import posthog from 'posthog-js'

export const onFeatureFlagsReady = (cb: () => void) => {
  try { posthog.onFeatureFlags(cb) } catch {}
}

export const getFlagVariant = (key: string, fallback = 'control'): Promise<string> =>
  new Promise((resolve) => {
    // 1) instant read (if already loaded)
    const v = posthog.getFeatureFlag?.(key) as string | undefined
    if (v) return resolve(v)
    // 2) wait for flags
    let settled = false
    const done = (val: string) => { if (!settled) { settled = true; resolve(val || fallback) } }
    onFeatureFlagsReady(() => done((posthog.getFeatureFlag?.(key) as string) || fallback))
    // 3) timeout fallback
    setTimeout(() => done(fallback), 800)
  })
