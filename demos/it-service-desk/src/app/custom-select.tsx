"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

export type SelectOption = {
  value: string;
  label: string;
};

export function CustomSelect({
  defaultValue,
  id,
  name,
  options,
}: {
  defaultValue: string;
  id: string;
  name: string;
  options: SelectOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef({ text: "", timestamp: 0 });
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setValue(options[activeIndex].value);
        setIsOpen(false);
        searchRef.current.text = "";
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, options, activeIndex]);

  useEffect(() => {
    if (isOpen) {
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({
        block: "nearest",
      });
    }
  }, [isOpen, activeIndex, id]);

  function open(index = selectedIndex) {
    setActiveIndex(index);
    searchRef.current.text = "";
    setIsOpen(true);
  }

  function close(commit = false) {
    if (commit) setValue(options[activeIndex].value);
    setIsOpen(false);
    searchRef.current.text = "";
  }

  function select(index: number) {
    setValue(options[index].value);
    close();
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      searchRef.current.text = "";
      const offset = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(Math.max(0, Math.min(options.length - 1, activeIndex + offset)));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      open(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab" && isOpen) {
      close(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) close(true);
      else open();
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      const now = event.timeStamp;
      const previous = now - searchRef.current.timestamp < 700 ? searchRef.current.text : "";
      const text = previous + event.key.toLowerCase();
      searchRef.current = { text, timestamp: now };
      const prefix = [...text].every((character) => character === text[0]) ? text[0] : text;
      const current = isOpen ? activeIndex : selectedIndex;
      const start = prefix.length === 1 ? current + 1 : current;
      const match = options.findIndex((_, offset) => {
        const index = (start + offset) % options.length;
        return options[index].label.toLowerCase().startsWith(prefix);
      });
      if (match !== -1) setActiveIndex((start + match) % options.length);
      else if (!isOpen) setActiveIndex(selectedIndex);
      setIsOpen(true);
    }
  }

  return (
    <div
      className={`custom-select${isOpen ? " custom-select-open" : ""}`}
      onBlur={(event) => {
        if (isOpen && !rootRef.current?.contains(event.relatedTarget)) close(true);
      }}
      ref={rootRef}
    >
      <input name={name} type="hidden" value={value} />
      <button
        aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
        aria-controls={isOpen ? `${id}-options` : undefined}
        aria-describedby={`${id}-value`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="custom-select-trigger"
        id={id}
        onClick={() => {
          if (isOpen) close(true);
          else open();
        }}
        onKeyDown={handleKeyDown}
        ref={buttonRef}
        role="combobox"
        type="button"
      >
        <span id={`${id}-value`}>{selected.label}</span>
        <ChevronDownIcon />
      </button>
      {isOpen ? (
        <div
          aria-labelledby={id}
          className="custom-select-options"
          id={`${id}-options`}
          role="listbox"
        >
          {options.map((option, index) => (
            <div
              aria-selected={option.value === value}
              className="custom-select-option"
              data-active={index === activeIndex}
              id={`${id}-option-${index}`}
              key={option.value || "all"}
              onClick={() => select(index)}
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => setActiveIndex(index)}
              role="option"
            >
              <span>{option.label}</span>
              {option.value === value ? <CheckIcon /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
