import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ToasterProvider } from "../../components/providers/toaster-provider";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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