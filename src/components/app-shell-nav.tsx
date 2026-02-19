import Link from "next/link";

const appLinks = [
  { href: "/onboarding", label: "Onboarding" },
  { href: "/learn", label: "Learn" },
  { href: "/quiz", label: "Quiz" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/plan", label: "Plan" },
  { href: "/resources", label: "Resources" },
  { href: "/export", label: "Export" },
  { href: "/collab", label: "Collaborate" }
] as const;

export function AppShellNav() {
  return (
    <nav aria-label="Primary app navigation" className="app-shell-nav">
      {appLinks.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
