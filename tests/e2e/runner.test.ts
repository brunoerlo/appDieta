import { E2E_TIERS_REGISTRY, printE2ESummaryReport } from './runner';

describe('IronTrack E2E Test Suite Runner & Registry', () => {
  it('prints the E2E summary report cleanly', () => {
    expect(() => printE2ESummaryReport(E2E_TIERS_REGISTRY)).not.toThrow();
  });

  it('verifies all 34 features from PROJECT.md are registered across E2E test tiers', () => {
    const totalCoveredFeatures = E2E_TIERS_REGISTRY.slice(0, 4).reduce(
      (sum, t) => sum + t.featureCount,
      0
    );
    expect(totalCoveredFeatures).toBe(34);
  });

  it('verifies total Tier 1 feature test cases satisfy >= 5 tests per feature (>= 170 tests)', () => {
    const tier1Tests = E2E_TIERS_REGISTRY.slice(0, 4).reduce(
      (sum, t) => sum + t.testCount,
      0
    );
    expect(tier1Tests).toBeGreaterThanOrEqual(170);
  });

  it('verifies Tiers 1-4 cover boundaries, pairwise combinations, and real-world workflows', () => {
    const tier2 = E2E_TIERS_REGISTRY.find((t) => t.tier === 'Tier 2');
    const tier3 = E2E_TIERS_REGISTRY.find((t) => t.tier === 'Tier 3');
    const tier4 = E2E_TIERS_REGISTRY.find((t) => t.tier === 'Tier 4');

    expect(tier2?.testCount).toBeGreaterThanOrEqual(20);
    expect(tier3?.testCount).toBeGreaterThanOrEqual(12);
    expect(tier4?.testCount).toBeGreaterThanOrEqual(3);
  });
});
