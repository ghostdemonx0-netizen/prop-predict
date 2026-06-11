export type HrRow = {
  player: string;
  team: string;
  park: string;
  probability: number;
  wind_out_mph: number;
  weather_mult: number;
  park_mult: number;
  recent_form_mult: number;
  temp_f?: number;
  precip_pct?: number;
  wind_mph?: number; // true wind speed
  wind_dir?: number; // direction of travel relative to center field (0=out to CF, 90=to RF, 180=in, 270=to LF)
};

export type KRow = {
  player: string;
  team: string;
  expected_ks: number;
  line: number;
  over_prob: number;
  wind_out_mph?: number;
  temp_f?: number;
  precip_pct?: number;
  wind_mph?: number;
  wind_dir?: number;
};

export type Projections = {
  date: string;
  updated: string;
  hr: HrRow[];
  strikeouts: KRow[];
};
