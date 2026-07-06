/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype. Content is filled in by later tasks.
 */
"use client";

import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";

export interface BoardsViewProps {
  lens: BoardsLens;
}

export function BoardsView({ lens }: BoardsViewProps) {
  return (
    <div className="sp-wrap" style={{ padding: "24px 0" }}>
      <h2 className="sp-iristext" style={{ fontSize: 22, marginBottom: 8 }}>
        Boards
      </h2>
      <p style={{ opacity: 0.7 }}>Lens: {lens}</p>
    </div>
  );
}

export default BoardsView;
