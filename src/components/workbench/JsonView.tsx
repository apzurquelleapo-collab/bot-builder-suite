import { cn } from "@/lib/utils";

export function JsonView({
  value,
  className,
  maxHeight = "max-h-80",
}: {
  value: unknown;
  className?: string;
  maxHeight?: string;
}) {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }

  return (
    <pre
      className={cn(
        "overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-muted-foreground",
        maxHeight,
        className,
      )}
    >
      {text}
    </pre>
  );
}
