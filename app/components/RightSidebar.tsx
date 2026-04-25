const buddies = [
  { initials: "M", color: "#7B5EA7", name: "Maya K.", status: "studying now · 42m" },
  { initials: "J", color: "#3A7D44", name: "Jordan T.", status: "studying now · 1h 12m" },
  { initials: "E", color: "#BF4800", name: "Esther E.", status: "started 8m ago" },
];

const suggested = [
  { initials: "L", color: "#C0792A", name: "Lena G.", subject: "Organic Chem" },
  { initials: "R", color: "#C04040", name: "Rachel N.", subject: "Linear Algebra" },
];

function Avatar({
  initials,
  color,
  size = "sm",
}: {
  initials: string;
  color: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export default function RightSidebar() {
  return (
    <aside className="w-56 shrink-0 flex flex-col gap-6 pt-2">
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">Study buddies</h3>
          <a
            href="#"
            className="text-xs hover:underline"
            style={{ color: "var(--p2p-accent)" }}
          >
            view all
          </a>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          people studying at the same time as you
        </p>
        <ul className="flex flex-col gap-3">
          {buddies.map(({ initials, color, name, status }) => (
            <li key={name} className="flex items-center gap-2">
              <Avatar initials={initials} color={color} />
              <div>
                <p className="text-xs font-medium leading-tight">{name}</p>
                <p className="text-[11px] text-gray-500">{status}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">Suggested</h3>
        <p className="text-[11px] text-gray-500 mb-3">Classmates from your subjects</p>
        <ul className="flex flex-col gap-3">
          {suggested.map(({ initials, color, name, subject }) => (
            <li key={name} className="flex items-center gap-2">
              <Avatar initials={initials} color={color} />
              <div className="flex-1">
                <p className="text-xs font-medium leading-tight">{name}</p>
                <p className="text-[11px] text-gray-500">{subject}</p>
              </div>
              <button className="text-xs border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50">
                Follow
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
