"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// import { useAuth } from "./auth-provider";
import { AuthNav } from "./auth-nav";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

const components: { title: string; href: string; description: string }[] = [
  {
    title: "Persona Natural",
    href: "/submit/natural",
    description:
      "Persona Natural...",
  },
  {
    title: "Persona Jurídica",
    href: "#",
    description:
      "Persona Jurídica...",
  },
]

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3 sm:px-10 lg:px-12">
        <Link
          href="/"
          className={`shrink-0 text-lg font-semibold tracking-tight ${
            pathname === "/" ? "text-slate-950" : "text-slate-700"
          }`}
        >
          CapstoneHUB
        </Link>

        <NavigationMenu className="min-w-0 max-w-none">
          <NavigationMenuList>

            <NavigationMenuItem>
              <NavigationMenuLink
                render={<Link href="/projects">Proyectos</Link>}
              />
            </NavigationMenuItem>

            <NavigationMenuItem className="hidden md:flex">
              <NavigationMenuTrigger>Proponer</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-400px gap-2 md:w-500px md:grid-cols-2 lg:w-600px">
                  {components.map((component) => (
                    <ListItem
                      key={component.title}
                      title={component.title}
                      href={component.href}
                    >
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <AuthNav />
      </div>
    </nav>
  )
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink render={<Link href={href}><div className="flex flex-col gap-1 text-sm">
          <div className="leading-none font-medium">{title}</div>
          <div className="line-clamp-2 text-muted-foreground">{children}</div>
        </div></Link>} />
    </li>
  )
}
