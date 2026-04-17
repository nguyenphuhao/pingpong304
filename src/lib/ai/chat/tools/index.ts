export { findEntityTool } from "./find-entity";
export { getEntityStatsTool } from "./get-entity-stats";
export { getStandingsTool } from "./get-standings";
export { getUpcomingMatchesTool } from "./get-upcoming-matches";
export { computeQualificationOddsTool } from "./compute-qualification-odds";
export { comparePairsTool } from "./compare-pairs";
export { analyzeFormTool } from "./analyze-form";

import { findEntityTool } from "./find-entity";
import { getEntityStatsTool } from "./get-entity-stats";
import { getStandingsTool } from "./get-standings";
import { getUpcomingMatchesTool } from "./get-upcoming-matches";
import { computeQualificationOddsTool } from "./compute-qualification-odds";
import { comparePairsTool } from "./compare-pairs";
import { analyzeFormTool } from "./analyze-form";

export const chatTools = {
  findEntity: findEntityTool,
  getEntityStats: getEntityStatsTool,
  getStandings: getStandingsTool,
  getUpcomingMatches: getUpcomingMatchesTool,
  computeQualificationOdds: computeQualificationOddsTool,
  comparePairs: comparePairsTool,
  analyzeForm: analyzeFormTool,
};
