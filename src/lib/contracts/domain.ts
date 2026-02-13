export const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export interface LearningGoalInput {
  id: string;
  label: string;
}

export interface WorkspaceSummary {
  id: string;
  topic: string;
  difficulty: DifficultyLevel;
  goals: LearningGoalInput[];
  createdAtIso: string;
}

export interface WorkspaceSummaryResponse {
  workspace: WorkspaceSummary;
}
