export default function Home() {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: "2rem"
      }}
    >
      <section
        style={{
          maxWidth: "720px",
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px",
          padding: "2rem"
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: "2rem" }}>AetherForge</h1>
        <p style={{ lineHeight: 1.6 }}>
          Learn any topic through structured concepts, interactive examples,
          adaptive quizzes, spaced repetition flashcards, and personalized
          study plans.
        </p>
      </section>
    </main>
  );
}
