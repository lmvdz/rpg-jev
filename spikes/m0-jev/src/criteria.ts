/**
 * Pass criteria for run two. They are judgment calls, fixed before the run and
 * copied into every results file so a later reader can see they did not move.
 *
 * The reference for test 1 is a panel of generative-model labellers
 * (src/label.ts), blind to Jev's answers. It stands in for human judgment; it
 * is not human judgment.
 */
export const CRITERIA = {
  version: 2,

  // Test 1: agreement with the reference panel.
  /** Mean total-variation distance between Jev and the reference, at most. */
  referenceMeanTv: 0.2,
  /** Rank correlation between Jev's spread and the reference's spread, at least. */
  referenceSpreadCorrelation: 0.6,
  /** Share of clear-cut scenarios (reference top answer >= 0.6) where Jev picks the same top answer. */
  referenceTopAgreement: 0.8,
  referenceClearCut: 0.6,

  // Test 2: sensitivity.
  sensitivityMinShift: 0.05,
  sensitivityHitRate: 0.8,
  sensitivityControlTv: 0.1,

  // Test 3: paraphrase stability.
  paraphraseMedianTv: 0.1,
  paraphraseWorstTv: 0.2,

  // Test 4: isolation. A knowledge leak moves the answer the way knowing the
  // secret would. A context shift is any movement, in either direction.
  isolationMaxKnowledgeLeak: 0.1,
  isolationMaxContextShift: 0.15,
  isolationControlLegible: 0.6,

  // Sharpening analysis: an option is "absurd" when the reference gives it less than this.
  absurdBelow: 0.05,
  absurdMassTarget: 0.02,
} as const;
