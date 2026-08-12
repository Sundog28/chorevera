import { apiRequest } from "./client";

import type {
  HouseholdActivity,
} from "../types/householdActivity";


export async function getHouseholdActivities():
Promise<HouseholdActivity[]> {
  return apiRequest<HouseholdActivity[]>(
    "/api/v1/household-activities",
  );
}