"use client";

import { motion } from "framer-motion";
import { type LucideIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  actionIcon: ActionIcon = Plus,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
    >
      <div className="flex items-start gap-4 min-w-0">
        {Icon && (
          <div className="relative shrink-0">
            {/* Soft glow */}
            <div className="absolute inset-0 rounded-2xl gradient-primary opacity-20 blur-lg" />
            <div className="relative w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-md">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />
              <Icon className="w-[22px] h-[22px] text-white relative" />
            </div>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="gradient-primary text-white hover-glow shadow-md group relative overflow-hidden shrink-0"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <ActionIcon className="w-4 h-4 mr-2 relative group-hover:rotate-90 transition-transform duration-300" />
          <span className="relative">{actionLabel}</span>
        </Button>
      )}
    </motion.div>
  );
}
