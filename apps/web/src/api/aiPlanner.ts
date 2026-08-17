import { apiRequest } from "./client";

import type {
  AIPlanAction,
  AIPlannerApplyResponse,
  AIPlannerResponse,
} from "../types/aiPlanner";


export async function generateHouseholdPlan(
  householdId: number,
  requestText: string,
  maxActions: number,
): Promise<AIPlannerResponse> {
  return apiRequest<AIPlannerResponse>(
    "/api/v1/ai/household-plan",
    {
      method: "POST",
      body: JSON.stringify({
        household_id: householdId,
        request_text: requestText,
        max_actions: maxActions,
      }),
    },
  );
}


export async function applyHouseholdPlan(
  householdId: number,
  actions: AIPlanAction[],
): Promise<AIPlannerApplyResponse> {
  return apiRequest<AIPlannerApplyResponse>(
    "/api/v1/ai/household-plan/apply",
    {
      method: "POST",
      body: JSON.stringify({
        household_id: householdId,
        actions,
      }),
    },
  );
}
