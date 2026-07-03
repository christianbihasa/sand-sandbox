import React from "react";

export default function SandControls({
  activeElement,
  setActiveElement,
  onClear,
}) {
  const elements = [
    ["SAND", 1, "text-yellow-400 border-yellow-500/20 bg-yellow-500/5"],
    ["WATER", 2, "text-blue-400 border-blue-500/20 bg-blue-500/5"],
    ["WALL", 3, "text-slate-400 border-slate-500/20 bg-slate-500/5"],
    ["ERASER", 0, "text-rose-400 border-rose-500/20 bg-rose-500/5"],
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-4 bg-gray-900/50 p-2 rounded border border-gray-800/60 text-xs justify-center select-none">
      {elements.map(([name, id, style]) => (
        <button
          key={id}
          onClick={() => setActiveElement(id)}
          className={`px-4 py-2 border rounded tracking-widest transition-all active:scale-95 cursor-pointer font-bold ${style} ${
            activeElement === id
              ? "ring-1 ring-offset-2 ring-offset-slate-950 ring-emerald-500 opacity-100"
              : "opacity-40"
          }`}
        >
          {name}
        </button>
      ))}
      <button
        onClick={onClear}
        className="px-4 py-2 border rounded tracking-widest transition-all active:scale-95 cursor-pointer font-bold text-gray-400 border-gray-500/20 bg-gray-500/5 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30"
      >
        RESET
      </button>
    </div>
  );
}
