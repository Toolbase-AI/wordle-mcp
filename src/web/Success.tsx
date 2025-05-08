import { Logo } from "./Logo";
import { Link } from "./Link";

export function Success() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F4E6C3]">
      <div className="container flex flex-col items-center mx-auto">
        <Logo className="mb-12 logo-animation" />
        <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6 text-center">
          <h1 className="text-4xl md:text-2xl font-bold mb-4">Success!</h1>
          <p className="text-gray-600 mb-6">
            You may now retrieve the hint from the Wordle MCP by calling the
            same tool again.
          </p>
          <Link href="/" className="text-primary hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
