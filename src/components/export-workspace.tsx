"use client";

import { useMemo, useState } from "react";

type ExportSection = "concepts" | "quiz" | "flashcards" | "plan" | "resources";

const SECTION_OPTIONS: Array<{ id: ExportSection; label: string }> = [
  { id: "concepts", label: "Concept summaries" },
  { id: "quiz", label: "Quiz booklet" },
  { id: "flashcards", label: "Flashcard sheet" },
  { id: "plan", label: "Plan tracker" },
  { id: "resources", label: "Resources" }
];

const buildPacketUrl = (sections: ExportSection[], includeAnswerKey: boolean, compact: boolean) => {
  const params = new URLSearchParams();
  sections.forEach((section) => {
    params.append("sections", section);
  });
  params.set("includeAnswerKey", includeAnswerKey ? "1" : "0");
  params.set("compact", compact ? "1" : "0");
  return `/api/export/study-packet?${params.toString()}`;
};

export function ExportWorkspace() {
  const [sections, setSections] = useState<ExportSection[]>(["concepts", "quiz", "flashcards", "plan"]);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [compact, setCompact] = useState(false);

  const packetUrl = useMemo(
    () => buildPacketUrl(sections, includeAnswerKey, compact),
    [sections, includeAnswerKey, compact]
  );

  const toggleSection = (section: ExportSection) => {
    setSections((previous) => {
      if (previous.includes(section)) {
        return previous.filter((item) => item !== section);
      }
      return [...previous, section];
    });
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <h2>Export study packet</h2>
        <p>Choose sections and formatting, then open a print-ready packet for browser print/PDF.</p>
        <div className="row">
          {SECTION_OPTIONS.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={sections.includes(option.id)}
                onChange={() => toggleSection(option.id)}
              />{" "}
              {option.label}
            </label>
          ))}
        </div>
        <div className="row">
          <label>
            <input
              type="checkbox"
              checked={includeAnswerKey}
              onChange={(event) => setIncludeAnswerKey(event.target.checked)}
            />{" "}
            Include answer key
          </label>
          <label>
            <input
              type="checkbox"
              checked={compact}
              onChange={(event) => setCompact(event.target.checked)}
            />{" "}
            Compact mode
          </label>
        </div>
        <div className="row">
          <a className="button" href={packetUrl} target="_blank" rel="noreferrer">
            Open print-ready packet
          </a>
        </div>
      </section>

      <section className="panel">
        <h3>Preview</h3>
        <iframe
          title="Study packet preview"
          src={packetUrl}
          style={{ width: "100%", minHeight: "70vh", border: "1px solid rgba(255,255,255,0.2)" }}
        />
      </section>
    </div>
  );
}
