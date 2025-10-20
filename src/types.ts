export enum Impact {
  NOIMPACT,
  PATCH,
  MINOR,
  MAJOR,
}

export const TypeToImpactMapping = {
  docs: Impact.NOIMPACT,
  style: Impact.NOIMPACT,
  test: Impact.NOIMPACT,
  chore: Impact.NOIMPACT,
  build: Impact.NOIMPACT,
  ci: Impact.NOIMPACT,
  refactor: Impact.PATCH,
  fix: Impact.PATCH,
  perf: Impact.PATCH,
  feat: Impact.MINOR,
};

export type ConventionalCommitType = keyof typeof TypeToImpactMapping;

export type ImpactResult = {
  prImpact?: ParsedCommitInfo;
  commitImpacts: ParsedCommitInfo[];
  maxCommitImpact?: Impact;
  finalImpact?: ParsedCommitInfo;
  warning?: string;
};

export interface ParsedCommitInfo {
  type: ConventionalCommitType;
  impact: Impact;
}
