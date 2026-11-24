// Anonimna statistika obiska s PostHog (strežniki v EU), brez piškotkov.
//
// Pravila zasebnosti (stran je namenjena tudi otrokom):
// - nikoli posthog.identify(), brez osebnih profilov (person_profiles: 'never')
// - v dogodke ne pošiljamo imen, e-naslovov, lokacije uporabnika ali podatkov o astmi
// - cookieless_mode: 'always' → PostHog ne uporablja piškotkov, localStorage ali sessionStorage
// - samodejno zajemanje klikov je izklopljeno: besedilo kliknjenega gumba bi lahko vsebovalo
//   naslov, ki ga je uporabnik poiskal na strani Moj zrak, ali stanje polja »astma«
//
// Ogledi strani: z defaults '2026-05-30' PostHog sam zabeleži $pageview ob prvem odprtju in ob vsaki
// spremembi poti (capture_pageview: 'history_change'), tudi ob prehodih v Vue routerju.
//
// Ključ je v VITE_POSTHOG_KEY (frontend/.env, ni v gitu). Če ga ni, se PostHog ne zažene in stran
// deluje naprej brez statistike. Na localhost ne štejemo, da razvoj ne pokvari statistike.
// Knjižnica se naloži šele tu (ločen paket), zato brez ključa ne upočasni prvega prikaza strani.
import type { PostHog } from 'posthog-js'

let ph: PostHog | null = null

export async function initAnalytics(): Promise<void> {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key || typeof window === 'undefined') return
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return

  let posthog: PostHog
  try {
    posthog = (await import('posthog-js')).default
  } catch {
    return // paketa ni bilo mogoče naložiti (npr. brez povezave) – stran deluje naprej
  }
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    defaults: '2026-05-30',
    cookieless_mode: 'always',
    respect_dnt: true,
    disable_session_recording: true,
    // dodatno, zaradi pravil zasebnosti zgoraj
    person_profiles: 'never',
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    disable_surveys: true,
  })
  ph = posthog
}

type Vrednost = string | number | boolean

/** Pošlje dogodek brez osebnih podatkov. Če PostHog ni zagnan, ne naredi nič. */
export function zabelezi(dogodek: string, lastnosti?: Record<string, Vrednost>): void {
  ph?.capture(dogodek, lastnosti)
}
