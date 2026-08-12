import {
  apiRequest,
} from "./client";

import type {
  Chore,
  ChoreApiResponse,
  ChoreCreateInput,
  ChoreQuery,
  ChoreUpdateInput,
} from "../types/chore";


export type AutoAssignMode =
  | "unassigned_only"
  | "rebalance_incomplete";


export type ChoreAutoAssignment = {
  chore_id: number;
  chore_title: string;

  previous_assigned_user_id:
    | number
    | null;

  assigned_user_id: number;
  assigned_user_name: string;

  changed: boolean;
};


export type ChoreAutoAssignResponse = {
  household_id: number;
  mode: AutoAssignMode;

  applied: boolean;

  eligible_chore_count: number;
  changed_chore_count: number;

  assignments:
    ChoreAutoAssignment[];
};


function mapChoreResponse(
  chore: ChoreApiResponse,
): Chore {
  return {
    id: chore.id,
    title: chore.title,

    reminderTime:
      chore.reminder_time ?? "",

    completed:
      chore.completed,

    ownerId:
      chore.owner_id,

    householdId:
      chore.household_id,

    assignedUserId:
      chore.assigned_user_id,

    createdAt:
      chore.created_at,

    updatedAt:
      chore.updated_at,
  };
}


function buildChoreQuery(
  query: ChoreQuery = {},
): string {
  const parameters =
    new URLSearchParams();

  if (query.scope) {
    parameters.set(
      "scope",
      query.scope,
    );
  }

  if (
    query.householdId !==
      undefined &&
    query.householdId !== null
  ) {
    parameters.set(
      "household_id",
      String(
        query.householdId,
      ),
    );
  }

  if (
    query.assignedUserId !==
      undefined &&
    query.assignedUserId !== null
  ) {
    parameters.set(
      "assigned_user_id",
      String(
        query.assignedUserId,
      ),
    );
  }

  const queryString =
    parameters.toString();

  return queryString
    ? `?${queryString}`
    : "";
}


export async function getChores(
  query: ChoreQuery = {},
): Promise<Chore[]> {
  const chores =
    await apiRequest<
      ChoreApiResponse[]
    >(
      `/api/v1/chores${buildChoreQuery(
        query,
      )}`,
    );

  return chores.map(
    mapChoreResponse,
  );
}


export async function createChore(
  input: ChoreCreateInput,
): Promise<Chore> {
  const chore =
    await apiRequest<
      ChoreApiResponse
    >(
      "/api/v1/chores",
      {
        method: "POST",

        body: JSON.stringify({
          title:
            input.title,

          reminder_time:
            input.reminderTime ||
            null,

          household_id:
            input.householdId ??
            null,

          assigned_user_id:
            input.assignedUserId ??
            null,
        }),
      },
    );

  return mapChoreResponse(
    chore,
  );
}


export async function updateChore(
  choreId: number,
  input: ChoreUpdateInput,
): Promise<Chore> {
  const requestBody: {
    title?: string;

    reminder_time?:
      | string
      | null;

    completed?: boolean;

    assigned_user_id?:
      | number
      | null;
  } = {};


  if (
    input.title !==
    undefined
  ) {
    requestBody.title =
      input.title;
  }


  if (
    input.reminderTime !==
    undefined
  ) {
    requestBody.reminder_time =
      input.reminderTime ||
      null;
  }


  if (
    input.completed !==
    undefined
  ) {
    requestBody.completed =
      input.completed;
  }


  if (
    input.assignedUserId !==
    undefined
  ) {
    requestBody.assigned_user_id =
      input.assignedUserId;
  }


  const chore =
    await apiRequest<
      ChoreApiResponse
    >(
      `/api/v1/chores/${choreId}`,
      {
        method: "PATCH",

        body:
          JSON.stringify(
            requestBody,
          ),
      },
    );

  return mapChoreResponse(
    chore,
  );
}


export async function toggleChore(
  choreId: number,
): Promise<Chore> {
  const chore =
    await apiRequest<
      ChoreApiResponse
    >(
      `/api/v1/chores/${choreId}/toggle`,
      {
        method: "PATCH",
      },
    );

  return mapChoreResponse(
    chore,
  );
}


export async function deleteChore(
  choreId: number,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/chores/${choreId}`,
    {
      method: "DELETE",
    },
  );
}


export async function previewAutoAssignChores(
  householdId: number,
  mode: AutoAssignMode,
): Promise<ChoreAutoAssignResponse> {
  return apiRequest<
    ChoreAutoAssignResponse
  >(
    "/api/v1/chores/auto-assign/preview",
    {
      method: "POST",

      body: JSON.stringify({
        household_id:
          householdId,

        mode,
      }),
    },
  );
}


export async function autoAssignChores(
  householdId: number,
  mode: AutoAssignMode,
): Promise<ChoreAutoAssignResponse> {
  return apiRequest<
    ChoreAutoAssignResponse
  >(
    "/api/v1/chores/auto-assign",
    {
      method: "POST",

      body: JSON.stringify({
        household_id:
          householdId,

        mode,
      }),
    },
  );
}
