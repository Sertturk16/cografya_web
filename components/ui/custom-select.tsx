"use client";

import * as React from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Seçiniz...",
  searchPlaceholder = "Ara...",
  searchable = false,
  className,
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)) ||
        opt.value.toLowerCase().includes(query),
    );
  }, [options, searchQuery, searchable]);

  // Outside click listener
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, searchable]);

  // Keyboard navigation
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const reactId = React.useId();
  const selectId = id || reactId;
  const listboxId = `${selectId}-listbox`;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full h-10 px-3.5 rounded-xl border bg-card text-xs text-left transition-all duration-150 flex items-center justify-between gap-2 select-none shadow-2xs cursor-pointer focus-visible:outline-none",
          isOpen
            ? "border-primary ring-3 ring-primary/20"
            : "border-border hover:border-primary/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
        <span
          className={cn(
            "truncate",
            selectedOption ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-primary",
          )}
        />
      </button>

      {/* Dropdown Popup Menu */}
      {isOpen && (
        <div
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              triggerRef.current?.focus();
            }
          }}
          className="absolute top-full left-0 mt-1.5 w-full z-50 rounded-2xl border border-border bg-white dark:bg-card text-foreground shadow-2xl overflow-hidden py-1"
        >
          {searchable && (
            <div className="p-2 border-b border-border/80">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder || "Seçeneklerde ara"}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-150"
                />
              </div>
            </div>
          )}

          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            className="max-h-56 overflow-y-auto p-1 space-y-0.5 scrollbar-thin"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Sonuç bulunamadı.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    id={`${selectId}-opt-${opt.value}`}
                    role="option"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors duration-100 font-medium select-none outline-none focus-visible:bg-primary/15 focus-visible:text-primary",
                      isSelected
                        ? "bg-primary/15 text-primary font-bold"
                        : "text-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
