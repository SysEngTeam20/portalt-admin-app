import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">
          Welcome Back
        </h1>
        <SignIn />
      </div>
    </main>
  );
}