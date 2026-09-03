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
  const [highlightedIndex, setHighlightedIndex] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const reactId = React.useId();
  const selectId = id || reactId;
  const listboxId = `${selectId}-listbox`;

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

  // Derived highlighted index without setState in effect
  const activeIndex =
    highlightedIndex !== null
      ? highlightedIndex
      : filteredOptions.findIndex((opt) => opt.value === value);
  const resolvedIndex = activeIndex >= 0 ? activeIndex : filteredOptions.length > 0 ? 0 : -1;

  // Scroll active option into view
  React.useEffect(() => {
    if (isOpen && resolvedIndex >= 0 && filteredOptions[resolvedIndex]) {
      const optId = `${selectId}-opt-${filteredOptions[resolvedIndex].value}`;
      const el = document.getElementById(optId);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, resolvedIndex, filteredOptions, selectId]);

  // Outside click listener
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(null);
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

  // Selection handler with focus restoration (FU125A11Y-I2, WCAG 2.4.3)
  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(null);
    triggerRef.current?.focus();
  };

  // Keyboard navigation for WAI-ARIA APG Combobox pattern (FU125A11Y-I1)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(null);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const current = prev !== null ? prev : resolvedIndex;
        if (filteredOptions.length === 0) return 0;
        return current < filteredOptions.length - 1 ? current + 1 : 0;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const current = prev !== null ? prev : resolvedIndex;
        if (filteredOptions.length === 0) return 0;
        return current > 0 ? current - 1 : filteredOptions.length - 1;
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      if (filteredOptions.length > 0) setHighlightedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      if (filteredOptions.length > 0) setHighlightedIndex(filteredOptions.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resolvedIndex >= 0 && resolvedIndex < filteredOptions.length) {
        const option = filteredOptions[resolvedIndex];
        if (option) {
          handleSelect(option.value);
        }
      }
    }
  };

  const activeDescendantId =
    isOpen && resolvedIndex >= 0 && filteredOptions[resolvedIndex]
      ? `${selectId}-opt-${filteredOptions[resolvedIndex].value}`
      : undefined;

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
        aria-activedescendant={activeDescendantId}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
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
          onKeyDown={handleKeyDown}
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
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder || "Seçeneklerde ara"}
                  aria-controls={listboxId}
                  aria-activedescendant={activeDescendantId}
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
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === resolvedIndex;
                return (
                  <div
                    key={opt.value}
                    id={`${selectId}-opt-${opt.value}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors duration-100 font-medium select-none outline-none",
                      isSelected
                        ? "bg-primary/15 text-primary font-bold"
                        : isHighlighted
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-primary/5 hover:text-primary",
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
