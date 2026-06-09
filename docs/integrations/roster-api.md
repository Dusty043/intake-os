# Roster API Mapping

## Purpose

The roster API is used to recommend developer assignment based on skills, workload, availability, and project type experience.

The referenced endpoint is:

```text
ai-team.simple.biz/api/roster
```

This endpoint was not verified from the current environment. Treat the contract below as the desired normalized shape until the actual response is inspected.

## Desired Normalized Shape

```ts
export interface TeamMemberRosterRecord {
  id: string;
  name: string;
  email?: string;
  role?: string;
  skills: string[];
  projectTypes: string[];
  seniority?: "junior" | "mid" | "senior" | "lead";
  availability?: "available" | "limited" | "unavailable" | "unknown";
  currentLoad?: number;
  maxCapacity?: number;
  activeProjectCount?: number;
  githubUsername?: string;
  mondayUserId?: string;
}
```

## Assignment Scoring v1

```text
score = skills_match
      + project_type_match
      + availability_score
      + capacity_score
      - risk_penalties
```

Recommended fields:

| Signal | Required for v1? | Notes |
| --- | --- | --- |
| skills | Yes | Needed for credible assignment. |
| project type experience | Preferred | Can be inferred manually if unavailable. |
| availability | Preferred | If unavailable, default to unknown. |
| workload/current load | Preferred | If unavailable, assignment should be advisory only. |
| email | Yes | Needed for SSO/display/messaging. |
| GitHub username | Later | Needed for issue assignment. |
| Monday user ID | Later | Needed for Monday people column. |

## Recommendation Output

The OS should store:

- recommended developer
- backup developer(s)
- scoring rationale
- missing roster signals
- confidence
- manual override actor/reason if changed

## Open Questions

1. Does the roster API require auth?
2. Does it expose workload or only static skills?
3. Does it expose project history or just declared skills?
4. Are Monday user IDs and GitHub usernames available?
5. Is the roster API production-stable or an internal prototype?
