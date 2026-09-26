import { cn } from "@/lib/utils";

type Tone = "idle" | "ok" | "error" | "pending";

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <span
        className={cn(
          "size-2 rounded-full",
          tone === "ok" && "bg-success shadow-[0_0_8px_var(--success)]",
          tone === "error" && "bg-destructive",
          tone === "pending" && "animate-pulse bg-warning",
          tone === "idle" && "bg-border",
        )}
      />
      {label}
    </span>
  );
}
