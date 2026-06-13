import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-200 focus:border-indigo-400/50 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-indigo-500/15";

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-4 py-8">
      <div className="animate-scale-in w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600">
            <BookOpen size={22} strokeWidth={2} className="text-white" />
          </span>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Welcome back</h1>
            <p className="mt-1 text-sm text-zinc-500">Sign in to your study notes.</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 shadow-2xl shadow-black/40 backdrop-blur"
        >
          {error && (
            <div className="animate-fade-in rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <label className="block text-[13px] font-medium text-zinc-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block text-[13px] font-medium text-zinc-300">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          No account?{" "}
          <Link
            to="/register"
            className="font-medium text-indigo-400 transition-colors duration-150 hover:text-indigo-300"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
