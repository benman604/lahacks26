export default function NavBar() {
  const navLinks = ["Feed", "Sessions", "Subjects", "Friends"];
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();

  return (
    <header className="w-full bg-white border-b border-gray-200 px-8 py-3 flex items-center">
      <span
        className="text-xl font-bold mr-10 tracking-tight"
        style={{ color: "var(--p2p-accent)" }}
      >
        P2P.
      </span>

      <nav className="flex gap-6 flex-1">
        {navLinks.map((link) => (
          <a
            key={link}
            href="#"
            className="text-sm font-medium pb-0.5 text-gray-700 hover:text-gray-900"
            style={
              link === "Feed"
                ? {
                    color: "var(--p2p-accent)",
                    borderBottom: "2px solid var(--p2p-accent)",
                  }
                : {}
            }
          >
            {link}
          </a>
        ))}
      </nav>

      <span className="text-xs font-semibold tracking-widest uppercase text-gray-500">
        {todayLabel}{" "}&middot; ANDREW SUH
      </span>
    </header>
  );
}
