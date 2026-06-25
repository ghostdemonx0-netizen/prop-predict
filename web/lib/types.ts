export type Matchup = {
  name: string;
  bats?: string; // batter handedness (on a pitcher's lineup entry)
  throws?: string; // pitcher handedness (on a batter's vs entry)
  lean: "K" | "H" | "NEU";
  prob: number; // headline probability for the lean
  k_prob: number;
  hit_prob: number;
  player_id?: number;
  bvp?: { pa: number; ab: number; hits: number; hr: number; k: number; avg: string } | null;
  lineup_status?: string;
  pitcher_status?: string;
  k_prob_hist?: number;
  hit_prob_hist?: number;
  lean_hist?: "K" | "H" | "NEU";
  prob_hist?: number;
};

export type HrRow = {
  player: string;
  game_time?: string; // ISO start time
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
  bvp_mult?: number; // career batter-vs-pitcher history dial (capped ±10%)
  lineup_status?: string;
  probability_hist?: number;
};

export type KRow = {
  player: string;
  game_time?: string; // ISO start time
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
  pitcher_status?: string;
  over_prob_hist?: number;
  expected_ks_hist?: number;
};

export type Game = {
  game_id: number;
  game_time?: string; // ISO start time
  matchup: string;
  park: string;
  park_name?: string; // e.g. "Coors Field"
  park_mult: number;
  weather_mult: number;
  env: number; // park_mult * weather_mult (1.0 = neutral)
  wind_out_mph?: number;
  wind_mph?: number;
  wind_dir?: number;
  temp_f?: number;
  precip_pct?: number;
  home_lineup_status?: string;
  away_lineup_status?: string;
};

export type HitsRow = {
  player: string;
  team: string;
  matchup?: string;
  game_time?: string;
  player_id?: number;
  game_id?: number;
  bats?: string;
  vs?: Matchup;
  lineup_status?: string;
  wind_out_mph?: number;
  wind_mph?: number;
  wind_dir?: number;
  temp_f?: number;
  precip_pct?: number;
  recent_form_mult?: number;
  pitcher_factor?: number;
  recent_form_mult_hist?: number;
  pitcher_factor_hist?: number;
  p_ge1: number;
  p_ge2: number;
  p_ge3: number;
  p_ge1_hist?: number;
  p_ge2_hist?: number;
  p_ge3_hist?: number;
};

export type TbRow = Omit<HitsRow, "p_ge1" | "p_ge2" | "p_ge3" | "p_ge1_hist" | "p_ge2_hist" | "p_ge3_hist"> & {
  p_ge2: number;
  p_ge3: number;
  p_ge4: number;
  p_ge2_hist?: number;
  p_ge3_hist?: number;
  p_ge4_hist?: number;
  park_weather_factor?: number;
  park_weather_factor_hist?: number;
};

export type RunsRow = Omit<HitsRow, "p_ge1" | "p_ge2" | "p_ge3" | "p_ge1_hist" | "p_ge2_hist" | "p_ge3_hist"> & {
  p_ge1: number;
  p_ge2: number;
  p_ge1_hist?: number;
  p_ge2_hist?: number;
  park_weather_factor?: number;
  park_weather_factor_hist?: number;
};

export type RbiRow = RunsRow;

export type HrrRow = Omit<HitsRow, "p_ge1" | "p_ge2" | "p_ge3" | "p_ge1_hist" | "p_ge2_hist" | "p_ge3_hist"> & {
  p_ge2: number;
  p_ge3: number;
  p_ge4: number;
  p_ge2_hist?: number;
  p_ge3_hist?: number;
  p_ge4_hist?: number;
  park_weather_factor?: number;
  park_weather_factor_hist?: number;
};

export type Projections = {
  date: string;
  updated: string;
  hr: HrRow[];
  strikeouts: KRow[];
  games?: Game[];
  hits?: HitsRow[];
  total_bases?: TbRow[];
  runs?: RunsRow[];
  rbi?: RbiRow[];
  hrr?: HrrRow[];
};
