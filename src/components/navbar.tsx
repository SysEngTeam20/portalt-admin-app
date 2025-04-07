'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Home", href: "/" },
  { name: "Asset Library", href: "/library" },
  // { name: "Log Center", href: "/logs" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <>
      <div className=" font-bold px-10 top-0 left-0 right-0 bg-blue-600 text-white text-center py-2 text-sm">
        Ubiq VR Activities server deployed on [Incoming]. Please enter this value in visitor VR client to join multiplayer & AI server.
      </div>
      <nav className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center">
                {/* <span className="text-xl font-bold text-blue-700">Portalt</span> */}
                <img src="/logo.png" alt="logo" className=" h-7" />
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:block">
              <div className="flex items-center space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <OrganizationSwitcher 
                afterSelectOrganizationUrl="/"
                afterCreateOrganizationUrl="/"
                afterLeaveOrganizationUrl="/"
              />
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}