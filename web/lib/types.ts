export type Matchup = {
  name: string;
  bats?: string; // batter handedness (on a pitcher's lineup entry)
  throws?: string; // pitcher handedness (on a batter's vs entry)
  lean: "K" | "H" | "NEU";
  prob: number; // headline probability for the lean
  k_prob: number;
  hit_prob: number;
};

export type HrRow = {
  player: string;
  team: string;
  park: string;
  matchup?: string; // "AWAY @ HOME"
  probability: number;
  wind_out_mph: number;
  weather_mult: number;
  park_mult: number;
  recent_form_mult: number;
  temp_f?: number;
  precip_pct?: number;
  wind_mph?: number; // true wind speed
  wind_dir?: number; // direction of travel relative to center field (0=out to CF, 90=to RF, 180=in, 270=to LF)
  bats?: string; // L / R / S
  vs?: Matchup; // the pitcher this batter faces
  player_id?: number;
  game_id?: number;
  matchup_mult?: number; // platoon adjustment vs this starter
  pitcher_mult?: number; // opposing starter's HR quality
};

export type KRow = {
  player: string;
  team: string;
  matchup?: string; // "AWAY @ HOME"
  expected_ks: number;
  line: number;
  over_prob: number;
  wind_out_mph?: number;
  temp_f?: number;
  precip_pct?: number;
  wind_mph?: number;
  wind_dir?: number;
  throws?: string; // L / R
  matchups?: Matchup[]; // the opposing lineup this pitcher faces
  player_id?: number;
  game_id?: number;
};

export type Game = {
  game_id: number;
  matchup: string;
  park: string;
  park_mult: number;
  weather_mult: number;
  env: number; // park_mult * weather_mult (1.0 = neutral)
  wind_out_mph?: number;
  wind_mph?: number;
  wind_dir?: number;
  temp_f?: number;
  precip_pct?: number;
};

export type Projections = {
  date: string;
  updated: string;
  hr: HrRow[];
  strikeouts: KRow[];
  games?: Game[];
};
