/**
 * Public surface of the analytical data layer.
 *
 * Application code imports from here and nowhere deeper. That keeps one seam to
 * change when the hand-rolled validator is replaced by Zod, and one place to
 * audit for the rule that the presentation layer never computes a statistic.
 *
 * The Node filesystem loader is intentionally NOT re-exported: importing it
 * would pull `node:fs` into any bundle that touches this module. Import
 * `./load-node.ts` directly from tests and build scripts instead.
 */

export type {
  AnalyticalConfiguration,
  ArtifactBundle,
  ArtifactName,
  CategoryReview,
  CategoryVerdict,
  CaveatCode,
  Claim,
  ClaimDisposition,
  ClaimsArtifact,
  ClaimsSummary,
  ClaimStatus,
  Classification,
  Comparability,
  CorrelationBundle,
  CountriesArtifact,
  CountryId,
  Coverage,
  DataSource,
  Direction,
  EvidenceGroup,
  GlobalMetrics,
  InterestProfile,
  InterpretationVocabulary,
  Interval,
  IsoDate,
  LagPoint,
  LeaveOneOut,
  LeaveOneOutObservation,
  LinearFit,
  ManifestArtifact,
  MetricsArtifact,
  OilStatistics,
  OilWeek,
  PanelArtifact,
  PanelRow,
  PeakDispersion,
  Regime,
  RegimeSummary,
  Robustness,
  ScaleFreeProfile,
  SensitivityVariantId,
  SeriesId,
  SeriesLocalProfile,
  SeriesMetrics,
  SeriesRegistryEntry,
  Significance,
  Specification,
  SpecificationAgreement,
  SpecificationId,
  StrengthLabel,
} from "./artifact-types.ts";

export { ARTIFACT_FILENAMES, COUNTRY_IDS, SERIES_IDS } from "./artifact-types.ts";

export { ContractError } from "./validate.ts";

export {
  assertComparableAcrossSeries,
  assertCrossArtifactIntegrity,
  createArtifactBundle,
  getAllCountryMetrics,
  getCategoryReviews,
  getClaim,
  getClaims,
  getClaimsRequiringCitation,
  getComparability,
  getCountryMetrics,
  getEvidenceGroup,
  getGlobalMetrics,
  getPanelRow,
  getPanelRows,
  getPanelRowsWithOil,
  getPublishableClaims,
  getRegistryEntry,
  getSeriesLabel,
  getSeriesMetrics,
  getWorldwideMetrics,
  type RawArtifacts,
} from "./artifacts.ts";
