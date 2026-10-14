export type BasisType = 
  | "official"
  | "verified"
  | "rule"
  | "community"
  | "model"
  | "estimate"
  | "unknown";

export interface Fact<T = unknown> {
  value: T | null;
  basis: BasisType;
  confidence: number; // 0 to 3
  source?: string | null;
  url?: string | null;
  as_of?: string | null;
  note?: string | null;
}

export interface CampsiteFacts {
  dog_friendly: Fact<boolean>;
  campfires: Fact<boolean>;
  toilets: Fact<string>;
  water: Fact<string>;
  vehicle_access: Fact<string>;
  telco: Fact<string>;
  fees: Fact<string>;
  fire_status: Fact<string>;
  driving_time: Fact<number>;
  known_facts_count?: number;
  total_facts_count?: number;
  official_or_verified_count?: number;
}
