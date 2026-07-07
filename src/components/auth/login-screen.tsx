"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, Users, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/types";

const demoAccounts = [
  { role: "school_admin", email: "admin@greenwood.edu", password: "admin123" },
  { role: "teacher", email: "anita.verma@greenwood.edu", password: "teacher123" },
  { role: "student", email: "diya.das@student.greenwood.edu", password: "student123" },
  { role: "parent", email: "parent.diya@gmail.com", password: "parent123" },
  { role: "accountant", email: "deepak.mehta@greenwood.edu", password: "account123" },
  { role: "librarian", email: "lakshmi.iyer@greenwood.edu", password: "library123" },
  { role: "transport_manager", email: "ramesh.yadav@greenwood.edu", password: "transport123" },
  { role: "hr", email: "sunita.joshi@greenwood.edu", password: "hr123" },
] as const;

export function LoginScreen() {
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen w-full mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating decorative orbs */}
      <motion.div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: "oklch(0.55 0.20 265)" }}
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-25"
        style={{ background: "oklch(0.60 0.18 305)" }}
        animate={{ y: [0, -30, 0], x: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left: Branding */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-col gap-8 px-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">EduFlow ERP</h1>
              <p className="text-sm text-muted-foreground">Advanced School Management</p>
            </div>
          </div>

          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-bold leading-tight"
            >
              One platform to run your <span className="gradient-text">entire school</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-muted-foreground"
            >
              Manage admissions, attendance, fees, exams, library, transport and HR — all in a premium, modern interface trusted by educators.
            </motion.p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Users, label: "9 Role Portals", value: "Multi-role" },
              { icon: ShieldCheck, label: "Secure RBAC", value: "Role-scoped" },
              { icon: TrendingUp, label: "Live Analytics", value: "Real-time" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
              >
                <Card className="glass-card p-4 h-full">
                  <item.icon className="w-6 h-6 text-primary mb-2" />
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-sm font-semibold">{item.value}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right: Login form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="glass-card p-8 max-w-md mx-auto">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">EduFlow ERP</h1>
                <p className="text-xs text-muted-foreground">School Management</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to access your dashboard
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 h-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
                ) : (
                  <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
                Quick demo login — click a role to autofill
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.role}
                    onClick={() => quickLogin(acc.email, acc.password)}
                    className="text-left px-3 py-2 rounded-lg border border-border bg-background/50 hover:bg-accent hover:border-primary/30 transition-all text-xs"
                  >
                    <div className="font-medium text-primary">{ROLE_LABELS[acc.role]}</div>
                    <div className="text-muted-foreground truncate">{acc.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
