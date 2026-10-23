"use client";

import React from "react";

// Shared chrome for the roguelike hangar picker: run start and resupply
// both use this so the cost readout, filters, and ship cards stay the same.

export function RoguelikeFleetSelectScreen({
  title,
  headerAction,
  briefing,
  extra,
  filterToolbar,
  countHeading,
  pagination,
  list,
}: {
  title: string;
  headerAction: React.ReactNode;
  briefing?: React.ReactNode;
  extra?: React.ReactNode;
  filterToolbar: React.ReactNode;
  countHeading: React.ReactNode;
  pagination?: React.ReactNode;
  list: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-2 border-cyan p-3 font-mono md:p-6" style={{ borderRadius: 0 }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-bold text-cyan">{title}</h3>
        <div className="flex flex-wrap gap-2.5 sm:justify-end">{headerAction}</div>
      </div>

      {briefing}

      {extra}

      <div
        className="border border-solid p-3 sm:p-4"
        style={{
          backgroundColor: "var(--color-slate)",
          borderColor: "var(--color-gunmetal)",
          borderTopColor: "var(--color-steel)",
          borderLeftColor: "var(--color-steel)",
          borderRadius: 0,
        }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
          {filterToolbar}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {countHeading}
        {pagination}
      </div>

      {list}
    </div>
  );
}
