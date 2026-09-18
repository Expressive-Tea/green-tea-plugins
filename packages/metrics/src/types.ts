/** One labelled series and its accumulated value. */
export interface Series {
  route: string;
  method: string;
  status?: number;
  value: number;
}

/** What the collector holds, for a consumer that wants numbers rather than text. */
export interface MetricsSnapshot {
  requests: Series[];
  errors: Series[];
  duration: Array<{ route: string; method: string; sum: number; count: number }>;
}

export interface MetricsOptions {
  /** Graph name the collector is published under, and the plugin's name. Defaults to `metrics`. */
  provides?: string;
}
