import * as React from "react";
import { cn } from "@/lib/utils";

/** Liste déroulante native stylée (accessibilité clavier et lecteurs d'écran natives). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
