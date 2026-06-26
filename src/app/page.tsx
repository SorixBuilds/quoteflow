import { CheckCircle2, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const foundationChecklist = [
  "Next.js (App Router) + TypeScript",
  "Tailwind CSS v4 with QuoteFlow design tokens",
  "ESLint + Prettier + Vitest",
  "Scalable feature-sliced folder structure",
];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="bg-card w-full max-w-xl rounded-xl border p-8 shadow-sm">
        <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-lg">
          <Workflow className="size-6" />
        </div>

        <h1 className="text-foreground mt-6 text-2xl font-semibold tracking-tight">
          {siteConfig.name}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {siteConfig.description}
        </p>

        <div className="bg-muted/60 mt-6 rounded-lg p-4">
          <p className="text-foreground text-sm font-medium">
            Phase 1 · Project foundation ready
          </p>
          <ul className="mt-3 space-y-2">
            {foundationChecklist.map((item) => (
              <li
                key={item}
                className="text-muted-foreground flex items-center gap-2 text-sm"
              >
                <CheckCircle2 className="text-success size-4" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="cta">Build the pipeline</Button>
          <Button variant="outline">View docs</Button>
        </div>
      </div>
    </main>
  );
}
