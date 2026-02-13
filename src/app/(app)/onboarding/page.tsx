import { DIFFICULTY_LEVELS, type LearningGoalInput } from "@/lib/contracts/domain";

const starterGoals: LearningGoalInput[] = [
  { id: "goal-1", label: "Understand the core terminology" },
  { id: "goal-2", label: "Practice with mixed-difficulty quizzes" },
  { id: "goal-3", label: "Build a durable review habit" }
];

export default function OnboardingPage() {
  return (
    <section className="panel">
      <h2>Topic onboarding (Phase 0 placeholder)</h2>
      <p>
        Topic setup, objective capture, and assistant-guided planning will be
        implemented in upcoming phases.
      </p>

      <h3>Difficulty options</h3>
      <ul>
        {DIFFICULTY_LEVELS.map((difficulty) => (
          <li key={difficulty}>{difficulty}</li>
        ))}
      </ul>

      <h3>Starter goals</h3>
      <ul>
        {starterGoals.map((goal) => (
          <li key={goal.id}>{goal.label}</li>
        ))}
      </ul>
    </section>
  );
}
