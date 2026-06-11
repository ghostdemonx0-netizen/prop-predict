"use client";

import Link from "next/link";
import type { ViewMode } from "./ViewSwitcher";
import { pct, strengthLabel } from "../lib/format";

export type BoardRow = {
  player: string;
  team: string;
  prob: number; // probability or over_prob
  detail: string; // e.g. "vs COL" or "5.5 line"
  context?: string; // e.g. wind label
  href: string;
};

function colorFor(prob: number): string {
  if (prob >= 0.25) return "border-green-500";
  if (prob >= 0.12) return "border-green-300";
  return "border-gray-200 opacity-70";
}

export function PropBoard({ rows, mode }: { rows: BoardRow[]; mode: ViewMode }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 py-6">No plays yet — lineups may not be posted.</p>;
  }

  const Card = (r: BoardRow) => (
    <Link
      href={r.href}
      key={r.player}
      className={`block rounded-lg border-l-4 ${colorFor(r.prob)} border border-gray-200 p-3 hover:bg-gray-50`}
    >
      <div className="flex justify-between">
        <span className="font-semibold">{r.player}</span>
        <span className="text-green-700 font-bold">{pct(r.prob)}</span>
      </div>
      <div className="text-sm text-gray-600">
        {r.detail} · {strengthLabel(r.prob)}
        {r.context ? ` · ${r.context}` : ""}
      </div>
    </Link>
  );

  const Table = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-1">Player</th>
          <th>Team</th>
          <th>Detail</th>
          <th className="text-right">Chance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.player} className="border-b hover:bg-gray-50">
            <td className="py-1">
              <Link href={r.href} className="text-blue-700 hover:underline">{r.player}</Link>
            </td>
            <td>{r.team}</td>
            <td className="text-gray-600">{r.detail}</td>
            <td className="text-right font-medium">{pct(r.prob)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const List = () => (
    <div className="divide-y">
      {rows.map((r) => (
        <Link key={r.player} href={r.href} className="flex justify-between py-2 hover:bg-gray-50">
          <span>{r.player} <span className="text-gray-500">{r.detail}</span></span>
          <span className="font-medium">{pct(r.prob)}</span>
        </Link>
      ))}
    </div>
  );

  if (mode === "table") return <Table />;
  if (mode === "list") return <List />;
  if (mode === "cards") return <div className="grid gap-2 sm:grid-cols-2">{rows.map(Card)}</div>;

  // hybrid: top 3 as cards, the rest as a table
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">{top.map(Card)}</div>
      {rest.length > 0 && <Table />}
    </div>
  );
}
