import { Navbar } from "@/components/navbar";
import { ToasterProvider } from "@/components/providers/toaster-provider";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <ToasterProvider />
    </div>
  );
} 