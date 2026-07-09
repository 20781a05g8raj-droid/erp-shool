"use client";

import { motion } from "framer-motion";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: string;
  delay?: number;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = "text-primary",
  delay = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group"
    >
      <Card className="glass-card p-5 rounded-2xl hover-lift relative overflow-hidden">
        {/* Gradient border on hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, var(--grad-from), var(--grad-via), var(--grad-to))",
            padding: "1px",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Subtle radial glow on hover */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500 pointer-events-none" />

        <div className="flex items-start justify-between mb-4 relative">
          {/* Icon — tinted square with soft glow */}
          <div className="relative">
            <div
              className={cn(
                "absolute inset-0 rounded-xl blur-md opacity-25 group-hover:opacity-45 transition-opacity duration-300",
                color
              )}
              style={{ background: "currentColor" }}
            />
            <div
              className={cn(
                "relative w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15",
                color
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          </div>

          {trend !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full tabular-nums",
                trend >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div className="space-y-1 relative">
          <div className="text-[28px] leading-tight font-bold tracking-tight tabular-nums">
            {value}
          </div>
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          {trendLabel && (
            <div className="text-xs text-muted-foreground/70 pt-1">{trendLabel}</div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
