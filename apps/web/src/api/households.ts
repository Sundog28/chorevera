import { apiRequest } from "./client";

import type {
  Household,
  HouseholdActivity,
  HouseholdDeleteResponse,
  HouseholdInvitation,
  HouseholdInvitationActionResponse,
  InvitationDeleteResponse,
} from "../types/household";


export async function getMyHousehold():
Promise<Household | null> {
  return apiRequest<Household | null>(
    "/api/v1/households/mine",
  );
}


export async function createHousehold(
  name: string,
): Promise<Household> {
  return apiRequest<Household>(
    "/api/v1/households",
    {
      method: "POST",
      body: JSON.stringify({
        name,
      }),
    },
  );
}


export async function updateHousehold(
  householdId: number,
  name: string,
): Promise<Household> {
  return apiRequest<Household>(
    `/api/v1/households/${householdId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name,
      }),
    },
  );
}


export async function deleteHousehold(
  householdId: number,
): Promise<HouseholdDeleteResponse> {
  return apiRequest<HouseholdDeleteResponse>(
    `/api/v1/households/${householdId}`,
    {
      method: "DELETE",
    },
  );
}


export async function leaveHousehold(
  householdId: number,
): Promise<HouseholdDeleteResponse> {
  return apiRequest<HouseholdDeleteResponse>(
    `/api/v1/households/${householdId}/leave`,
    {
      method: "POST",
    },
  );
}


export async function inviteHouseholdMember(
  email: string,
): Promise<HouseholdInvitation> {
  return apiRequest<HouseholdInvitation>(
    "/api/v1/household-invitations",
    {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    },
  );
}


export async function getSentInvitations():
Promise<HouseholdInvitation[]> {
  return apiRequest<HouseholdInvitation[]>(
    "/api/v1/household-invitations/sent",
  );
}


export async function getMyInvitations():
Promise<HouseholdInvitation[]> {
  return apiRequest<HouseholdInvitation[]>(
    "/api/v1/household-invitations/mine",
  );
}


export async function acceptInvitation(
  invitationId: number,
): Promise<HouseholdInvitationActionResponse> {
  return apiRequest<HouseholdInvitationActionResponse>(
    `/api/v1/household-invitations/${invitationId}/accept`,
    {
      method: "POST",
    },
  );
}


export async function declineInvitation(
  invitationId: number,
): Promise<HouseholdInvitationActionResponse> {
  return apiRequest<HouseholdInvitationActionResponse>(
    `/api/v1/household-invitations/${invitationId}/decline`,
    {
      method: "POST",
    },
  );
}


export async function cancelInvitation(
  invitationId: number,
): Promise<InvitationDeleteResponse> {
  return apiRequest<InvitationDeleteResponse>(
    `/api/v1/household-invitations/${invitationId}`,
    {
      method: "DELETE",
    },
  );
}


export async function getHouseholdActivities(
  limit = 50,
): Promise<HouseholdActivity[]> {
  const parameters =
    new URLSearchParams({
      limit: String(limit),
    });

  return apiRequest<HouseholdActivity[]>(
    `/api/v1/household-activities?${parameters.toString()}`,
  );
}
