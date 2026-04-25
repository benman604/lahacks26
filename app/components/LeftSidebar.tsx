export default function LeftSidebar() {
  return (
    <aside className="w-48 shrink-0 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold"
          style={{ backgroundColor: "#7B5230" }}
        >
          A
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm">Andrew Suh</p>
          <p className="text-xs text-gray-500">@andreww</p>
        </div>
      </div>

      <div className="flex justify-around text-center border-t border-b border-gray-200 py-3">
        {[
          { value: "12", label: "FOLLOWERS" },
          { value: "8", label: "FOLLOWING" },
          { value: "47", label: "SESSIONS" },
        ].map(({ value, label }) => (
          <div key={label}>
            <p className="font-bold text-sm">{value}</p>
            <p className="text-[10px] text-gray-500 tracking-wide">{label}</p>
          </div>
        ))}
      </div>

    </aside>
  );
}
