import { Command } from "lucide-react";
import { BreadcrumbBar } from "./BreadcrumbBar";

export function Header() {
    return (
        <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="flex h-full items-center justify-between px-4">
                <div className="flex-1">
                    <BreadcrumbBar />
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <button 
                        className="w-64 h-9 rounded-xl border border-border bg-card text-sm text-muted-foreground px-3 flex items-center gap-2 cursor-default"
                    >
                        <Command size={16} />
                        Search...
                        <span className="ml-auto text-xs">⌘K</span>
                    </button>
                </div>
                <div className="flex-1" />
            </div>
        </header>
    )
}
