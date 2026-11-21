// Skupni tipi – ujemajo se z odgovori Python API-ja (backend/app/schemas.py).

export type Source = 'meritev' | 'model' | 'ocena'

export interface StationNow {
  id: string
  ime: string
  lat: number
  lon: number
  pm25: number | null
  pm10: number | null
  vir: Source
  cas_utc: string
}

export interface NowResponse {
  cas_utc: string
  postaje: StationNow[]
}

export interface ForecastHour {
  cas_utc: string
  pm25: number
  pm10: number
}

export interface ForecastResponse {
  izdano_utc: string
  lat: number
  lon: number
  ure: ForecastHour[]
  najboljsa_ura: string
}

export interface SceneHour {
  cas_utc: string
  visina_megle_m: number // nadmorska višina zgornjega roba megle / onesnaženja
  pm25: number
  inverzija: boolean
  megla?: boolean // prava megla (vodne kapljice), ne smog
}

export interface SceneResponse {
  ure: SceneHour[]
}

export interface DailyGame {
  datum: string
  vprasanje: string
  moznosti: string[]
  vceraj?: { vprasanje: string; pravilen_odgovor: string }
}

export interface Fact {
  besedilo: string
  stevilka?: string
  vir: string
}

export interface Place {
  ime: string
  tip: 'vrtec' | 'sola' | 'bolnisnica' | string
  lat: number
  lon: number
}
