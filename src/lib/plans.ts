// Limites de stockage par offre (en octets).
export const PLAN_LIMITS: Record<string, number> = {
  free: 100 * 1024 * 1024, // 100 Mo
};

export const DEFAULT_PLAN = "free";

export function limitForPlan(plan: string | null | undefined): number {
  return PLAN_LIMITS[plan ?? DEFAULT_PLAN] ?? PLAN_LIMITS[DEFAULT_PLAN];
}
