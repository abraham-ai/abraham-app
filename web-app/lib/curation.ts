// Client-safe configuration for curation/blessing limits
// You can override these via NEXT_PUBLIC_* environment variables.

export const BLESS_TOKENS_PER_UNIT: number = Number(
  process.env.NEXT_PUBLIC_BLESS_TOKENS_PER_UNIT ?? 100
);

export const BLESS_WINDOW_MS: number = Number(
  process.env.NEXT_PUBLIC_BLESS_WINDOW_MS ?? 5 * 60 * 1000
);
