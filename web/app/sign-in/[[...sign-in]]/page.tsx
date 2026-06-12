import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
      <SignIn />
    </main>
  );
}
