import { SignUp } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8">
        <SignUp />
      </div>
    </main>
  );
}