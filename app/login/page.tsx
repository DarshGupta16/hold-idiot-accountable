"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: key }),
      });

      if (res.ok) {
        router.refresh(); // Update middleware state
        router.push("/");
      } else {
        setError(true);
        setKey("");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-sm flex flex-col items-center space-y-8 animate-in fade-in duration-500">
        {/* Header - Minimalist Identity */}
        <div className="text-center space-y-2">
          <h1 className="font-serif text-2xl tracking-wide text-stone-800 dark:text-stone-200">
            HIA
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            System Access
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="space-y-2">
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(false);
              }}
              placeholder="Access Key"
              className={`
                w-full bg-transparent border-b border-stone-300 dark:border-stone-700
                py-2 px-1 text-center font-mono text-sm tracking-wider outline-none
                transition-colors duration-300
                focus:border-stone-600 dark:focus:border-stone-400
                placeholder:text-stone-400 dark:placeholder:text-stone-600
                ${error ? "border-red-400 text-red-500 focus:border-red-400" : ""}
              `}
              autoFocus
            />

            {/* Minimal error feedback */}
            <div
              className={`h-4 text-center transition-opacity duration-300 ${error ? "opacity-100" : "opacity-0"}`}
            >
              <span className="text-[10px] uppercase tracking-wider text-red-500/80 font-medium">
                Invalid Key
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !key}
            className={`
              w-full py-3 text-xs uppercase tracking-[0.15em] font-medium
              transition-all duration-500
              ${
                loading || !key
                  ? "opacity-0 cursor-default"
                  : "opacity-50 hover:opacity-100 cursor-pointer text-stone-900 dark:text-stone-100"
              }
            `}
          >
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
      </main>
    </div>
  );
}
