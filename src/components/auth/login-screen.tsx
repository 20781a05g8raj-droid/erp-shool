"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap, Mail, Lock, ArrowRight, Eye, EyeOff, Loader2,
  ShieldCheck, Users, TrendingUp, Sparkles, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const features = [
  { icon: Users, title: "9 Role Portals", desc: "Purpose-built dashboards for every stakeholder" },
  { icon: ShieldCheck, title: "Secure RBAC", desc: "Granular, role-scoped access control" },
  { icon: TrendingUp, title: "Live Analytics", desc: "Real-time insights & reporting" },
];

export function LoginScreen() {
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupName, setSignupName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      const msg = "Please enter both email and password";
      setError(msg);
      toast.error(msg);
      return;
    }

    // Signup-specific validations
    if (mode === "signup") {
      if (password.length < 6) {
        const msg = "Password must be at least 6 characters";
        setError(msg);
        toast.error(msg);
        return;
      }
      if (password !== confirmPassword) {
        const msg = "Passwords do not match";
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body: Record<string, string> = { email, password };
      if (mode === "signup" && signupName.trim()) {
        body.name = signupName.trim();
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || `${mode === "login" ? "Login" : "Signup"} failed`;
        setError(msg);
        toast.error(msg);
        return;
      }
      // Store user ID in localStorage for iframe/preview compatibility (third-party cookie workaround)
      localStorage.setItem("erp_user_id", data.user.id);
      setUser(data.user);
      if (mode === "signup") {
        toast.success(data.message || `Account created! Welcome, ${data.user.name}!`);
      } else {
        toast.success(`Welcome back, ${data.user.name}!`);
      }
    } catch {
      const msg = "Network error. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode: "login" | "signup") => {
    setMode(newMode);
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen w-full flex items-stretch justify-center relative overflow-hidden bg-background">
      {/* ===================== LEFT — BRANDED IMMERSIVE PANEL ===================== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex relative w-1/2 flex-col justify-between p-12 xl:p-16 overflow-hidden"
      >
        {/* Animated mesh background */}
        <div className="absolute inset-0 gradient-mesh-bg" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />

        {/* Floating glass orbs */}
        <motion.div
          className="absolute top-1/4 -left-20 w-72 h-72 rounded-full blur-3xl"
          style={{ background: "oklch(0.85 0.10 200 / 0.35)" }}
          animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-16 w-80 h-80 rounded-full blur-3xl"
          style={{ background: "oklch(0.90 0.10 60 / 0.30)" }}
          animate={{ y: [0, -36, 0], x: [0, -22, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-48 h-48 rounded-full blur-2xl"
          style={{ background: "oklch(0.95 0.08 320 / 0.30)" }}
          animate={{ y: [0, 24, 0], x: [0, -16, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Top — Logo + brand */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shadow-glow">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-white tracking-tight">EduFlow ERP</div>
            <div className="text-xs text-white/70 font-medium">Advanced School Management</div>
          </div>
        </motion.div>

        {/* Middle — Tagline + features */}
        <motion.div
          variants={containerStagger}
          initial="hidden"
          animate="show"
          className="relative z-10 space-y-8 max-w-xl"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Trusted by 500+ schools worldwide
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight text-white"
          >
            One platform to run your{" "}
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              entire school.
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-base xl:text-lg text-white/80 leading-relaxed"
          >
            Manage admissions, attendance, fees, exams, library, transport and HR — all in
            a premium, modern interface trusted by educators.
          </motion.p>

          {/* Feature cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3 pt-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-4 rounded-2xl bg-white/8 backdrop-blur-xl border border-white/15 hover:bg-white/12 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center mb-3 group-hover:bg-white/25 transition-colors">
                  <f.icon className="w-[18px] h-[18px] text-white" />
                </div>
                <div className="text-sm font-semibold text-white">{f.title}</div>
                <div className="text-[11px] text-white/70 mt-0.5 leading-snug">{f.desc}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Bottom — Stats / testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="relative z-10 flex items-center gap-6 text-white"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["A", "S", "K", "M"].map((c, i) => (
                <div
                  key={c}
                  className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: `oklch(0.85 0.08 ${260 + i * 30})`,
                    color: "oklch(0.30 0.10 268)",
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
            <div className="text-xs">
              <div className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                500+ Schools
              </div>
              <div className="text-white/60">Onboarded this year</div>
            </div>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="text-xs">
            <div className="font-semibold">99.9% Uptime</div>
            <div className="text-white/60">Enterprise SLA</div>
          </div>
        </motion.div>
      </motion.div>

      {/* ===================== RIGHT — LOGIN FORM ===================== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        {/* Subtle mesh for the right side (light) */}
        <div className="absolute inset-0 mesh-bg opacity-60 lg:hidden" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-10"
        >
          <Card className="glass-card p-7 sm:p-8 rounded-2xl">
            {/* Mobile-only brand header */}
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">EduFlow ERP</h1>
                <p className="text-[11px] text-muted-foreground">School Management</p>
              </div>
            </div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <h2 className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "login"
                  ? "Sign in to access your dashboard"
                  : "Sign up using the email your school registered for you"}
              </p>
            </motion.div>

            {/* Signup info banner */}
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground leading-relaxed"
              >
                <strong className="text-foreground">How it works:</strong> Your school admin
                adds you as a student, parent, teacher, or staff member with your email. Then
                you sign up here using that same email — we'll automatically detect your role
                and show you the right dashboard.
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.28 }}
                  className="space-y-1.5"
                >
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                    Full Name <span className="text-muted-foreground/60">(optional)</span>
                  </Label>
                  <div className="relative group">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your full name"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-background/60 border-border/70 transition-all focus-visible:bg-background"
                      autoComplete="name"
                    />
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.32 }}
                className="space-y-1.5"
              >
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-10 h-11 rounded-xl bg-background/60 border-border/70 transition-all focus-visible:bg-background"
                    autoComplete="email"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                    Password
                  </Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "signup" ? "Min 6 characters" : "Enter your password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    className="pl-10 pr-10 h-11 rounded-xl bg-background/60 border-border/70 transition-all focus-visible:bg-background"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </motion.div>

              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.44 }}
                  className="space-y-1.5"
                >
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      className="pl-10 h-11 rounded-xl bg-background/60 border-border/70 transition-all focus-visible:bg-background"
                      autoComplete="new-password"
                    />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.48 }}
              >
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl gradient-primary text-white font-medium hover-glow transition-all relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {mode === "login" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : (
                    <>
                      {mode === "login" ? "Sign in" : "Create account"}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Login / Signup toggle */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.52 }}
              className="mt-5 text-center text-sm"
            >
              {mode === "login" ? (
                <p className="text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </motion.div>
          </Card>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="text-center text-[11px] text-muted-foreground mt-6"
          >
            By signing in, you agree to our{" "}
            <span className="text-foreground/70 hover:text-foreground cursor-pointer">Terms</span> and{" "}
            <span className="text-foreground/70 hover:text-foreground cursor-pointer">Privacy Policy</span>.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
