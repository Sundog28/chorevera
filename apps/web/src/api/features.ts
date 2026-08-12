import { apiRequest } from "./client";

import type {
  FeatureAccess,
} from "../types/features";


export async function getFeatureAccess():
Promise<FeatureAccess> {
  return apiRequest<FeatureAccess>(
    "/api/v1/features",
  );
}