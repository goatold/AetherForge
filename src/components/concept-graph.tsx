import Link from "next/link";

interface ConceptGraphNode {
  id: string;
  title: string;
}

interface ConceptGraphProps {
  artifactLabel: string;
  nodes: ConceptGraphNode[];
}

export function ConceptGraph({ artifactLabel, nodes }: ConceptGraphProps) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <section className="panel concept-graph-panel">
      <h3>Concept graph</h3>
      <p className="concept-graph-subtitle">
        Visual path for {artifactLabel} (ordered by generation sequence).
      </p>
      <div className="concept-graph-canvas" role="list" aria-label="Concept graph">
        {nodes.map((node, index) => (
          <div className="concept-graph-node-wrap" key={node.id} role="listitem">
            <Link className="concept-graph-node" href={`/learn/${node.id}`}>
              {node.title}
            </Link>
            {index < nodes.length - 1 ? (
              <span aria-hidden="true" className="concept-graph-arrow">
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
