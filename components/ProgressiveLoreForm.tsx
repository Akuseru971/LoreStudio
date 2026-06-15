"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MagicalBackground from "@/components/MagicalBackground";
import SequentialField from "@/components/SequentialField";
import type { BookFormInput } from "@/lib/types";
import { characterTypes, genders, runeterraRegions } from "@/lib/utils";

type ProgressiveLoreFormProps = {
  onSubmit: (input: BookFormInput) => void;
  disabled?: boolean;
};

type FormValues = Record<keyof BookFormInput, string>;

type RandomizedFields = Pick<FormValues, "gender" | "characterType" | "runeterraRegion">;

const initialValues: FormValues = {
  name: "",
  gender: "",
  characterType: "",
  runeterraRegion: "",
};

const fieldOrder: Array<keyof BookFormInput> = [
  "name",
  "gender",
  "characterType",
  "runeterraRegion",
];

const ROLL_ANIMATION_MS = 620;
const GLOW_DURATION_MS = 1400;
const FATE_MESSAGE_MS = 2600;

function labelize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isMeaningfulText(value: string) {
  return value.trim().length >= 2;
}

function isFieldComplete(key: keyof BookFormInput, values: FormValues) {
  if (key === "name") {
    return isMeaningfulText(values[key]);
  }

  return Boolean(values[key]);
}

function getRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function rollRandomFields(previous?: RandomizedFields | null): RandomizedFields {
  let next: RandomizedFields = {
    gender: getRandomItem(genders),
    characterType: getRandomItem(characterTypes),
    runeterraRegion: getRandomItem(runeterraRegions),
  };

  if (!previous) {
    return next;
  }

  let attempts = 0;
  while (
    attempts < 16 &&
    next.gender === previous.gender &&
    next.characterType === previous.characterType &&
    next.runeterraRegion === previous.runeterraRegion
  ) {
    next = {
      gender: getRandomItem(genders),
      characterType: getRandomItem(characterTypes),
      runeterraRegion: getRandomItem(runeterraRegions),
    };
    attempts += 1;
  }

  return next;
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm2.2 4.4a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zm5.3 3.1a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zm4.5 4.5a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zM7.3 14.9a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ProgressiveLoreForm({ onSubmit, disabled = false }: ProgressiveLoreFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [visibleCount, setVisibleCount] = useState(1);
  const [hasRandomized, setHasRandomized] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [fateMessage, setFateMessage] = useState("");
  const [glowingFields, setGlowingFields] = useState<Set<keyof BookFormInput>>(() => new Set());

  const lastRollRef = useRef<RandomizedFields | null>(null);
  const glowTimerRef = useRef<number | undefined>(undefined);
  const fateTimerRef = useRef<number | undefined>(undefined);

  const completedCount = useMemo(() => {
    let count = 0;
    for (const key of fieldOrder) {
      if (!isFieldComplete(key, values)) {
        break;
      }
      count += 1;
    }
    return count;
  }, [values]);

  const targetVisibleCount = useMemo(() => {
    if (hasRandomized) {
      return isFieldComplete("name", values) ? fieldOrder.length + 1 : fieldOrder.length;
    }

    return Math.min(fieldOrder.length + 1, completedCount + 1);
  }, [completedCount, hasRandomized, values]);

  const allComplete = completedCount === fieldOrder.length;

  useEffect(() => {
    if (targetVisibleCount < visibleCount) {
      const timer = window.setTimeout(() => {
        setVisibleCount(targetVisibleCount);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    if (targetVisibleCount > visibleCount) {
      const timer = window.setTimeout(() => {
        setVisibleCount(targetVisibleCount);
      }, 260);

      return () => window.clearTimeout(timer);
    }
  }, [targetVisibleCount, visibleCount]);

  useEffect(() => {
    return () => {
      if (glowTimerRef.current) {
        window.clearTimeout(glowTimerRef.current);
      }
      if (fateTimerRef.current) {
        window.clearTimeout(fateTimerRef.current);
      }
    };
  }, []);

  function updateValue(key: keyof BookFormInput, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleRollFate() {
    if (disabled || isRolling) {
      return;
    }

    setIsRolling(true);
    setFateMessage("");

    window.setTimeout(() => {
      const rolled = rollRandomFields(lastRollRef.current);
      lastRollRef.current = rolled;

      setValues((current) => ({
        ...current,
        name: current.name,
        gender: rolled.gender,
        characterType: rolled.characterType,
        runeterraRegion: rolled.runeterraRegion,
      }));

      setHasRandomized(true);
      setGlowingFields(new Set(["gender", "characterType", "runeterraRegion"]));
      setFateMessage("Fate has chosen…");
      setIsRolling(false);

      if (glowTimerRef.current) {
        window.clearTimeout(glowTimerRef.current);
      }
      glowTimerRef.current = window.setTimeout(() => {
        setGlowingFields(new Set());
      }, GLOW_DURATION_MS);

      if (fateTimerRef.current) {
        window.clearTimeout(fateTimerRef.current);
      }
      fateTimerRef.current = window.setTimeout(() => {
        setFateMessage("");
      }, FATE_MESSAGE_MS);
    }, ROLL_ANIMATION_MS);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allComplete || disabled) {
      return;
    }

    onSubmit({
      name: values.name.trim().slice(0, 40),
      gender: values.gender as BookFormInput["gender"],
      characterType: values.characterType,
      runeterraRegion: values.runeterraRegion as BookFormInput["runeterraRegion"],
    });
  }

  function isFieldGlowing(key: keyof BookFormInput) {
    return glowingFields.has(key);
  }

  return (
    <main className="archive-shell relative min-h-screen overflow-y-auto px-5 py-10 md:px-8">
      <MagicalBackground intensity="form" />
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 32, scale: 0.98, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(12px)" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glass-panel relative w-full overflow-hidden rounded-[2rem] p-5 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#7eb6ff]/70 to-transparent" />
          <div className="mb-8 text-center">
            <p className="font-title text-xs uppercase tracking-[0.42em] text-[#7eb6ff]">The archive opens</p>
            <h1 className="font-title mt-4 text-4xl leading-tight text-[#f7ebce] sm:text-6xl">
              The Book of Your Legend
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#b8c9dd]">
              Enter your name. Let the myth unfold.
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleRollFate}
                disabled={disabled || isRolling}
                aria-label="Roll fate to randomize character fields"
                className="group inline-flex items-center gap-2 rounded-full border border-[#7eb6ff]/30 bg-[#07101c]/70 px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#d8e8ff] shadow-[0_0_22px_rgba(71,132,211,0.12)] backdrop-blur-sm transition hover:border-[#7eb6ff]/55 hover:bg-[#0a1524]/85 hover:text-[#f4f8ff] hover:shadow-[0_0_28px_rgba(71,132,211,0.22)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#7eb6ff]/25 bg-[#0b1422]/80 text-[#9ec8ff] transition group-hover:border-[#7eb6ff]/45 group-hover:text-[#d8ecff] ${
                    isRolling ? "animate-[spin_0.62s_ease-in-out]" : "group-hover:scale-105"
                  }`}
                >
                  <DiceIcon className="h-4 w-4" />
                </span>
                Roll fate
              </button>
              <p className="max-w-xs text-xs leading-5 text-[#7eb6ff]/65">
                Let fate choose your path through Runeterra.
              </p>
            </div>

            <AnimatePresence>
              {fateMessage ? (
                <motion.p
                  key="fate-message"
                  initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="mt-4 font-title text-sm tracking-[0.18em] text-[#c9a858]"
                >
                  {fateMessage}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <AnimatePresence initial={false}>
              {visibleCount >= 1 ? (
                <SequentialField key="name" isActive={visibleCount === 1}>
                  <TextInput
                    label="Name / Pseudo"
                    value={values.name}
                    placeholder="Aurel, Nyx, Marrow..."
                    maxLength={40}
                    onChange={(value) => updateValue("name", value)}
                  />
                </SequentialField>
              ) : null}

              {visibleCount >= 2 ? (
                <SequentialField
                  key="gender"
                  isActive={visibleCount === 2 || isFieldGlowing("gender")}
                >
                  <SelectInput
                    label="Gender"
                    value={values.gender}
                    options={genders}
                    glowing={isFieldGlowing("gender")}
                    onChange={(value) => updateValue("gender", value)}
                  />
                </SequentialField>
              ) : null}

              {visibleCount >= 3 ? (
                <SequentialField
                  key="characterType"
                  isActive={visibleCount === 3 || isFieldGlowing("characterType")}
                >
                  <SelectInput
                    label="Character type"
                    value={values.characterType}
                    options={characterTypes}
                    glowing={isFieldGlowing("characterType")}
                    onChange={(value) => updateValue("characterType", value)}
                  />
                </SequentialField>
              ) : null}

              {visibleCount >= 4 ? (
                <SequentialField
                  key="runeterraRegion"
                  isActive={visibleCount === 4 || isFieldGlowing("runeterraRegion")}
                >
                  <SelectInput
                    label="Runeterra Region"
                    value={values.runeterraRegion}
                    options={runeterraRegions}
                    glowing={isFieldGlowing("runeterraRegion")}
                    onChange={(value) => updateValue("runeterraRegion", value)}
                  />
                </SequentialField>
              ) : null}
              {visibleCount >= 5 ? (
                <motion.button
                  key="submit"
                  type="submit"
                  disabled={!allComplete || disabled}
                  initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="gold-button mt-2 w-full rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-[0.24em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generate my legend
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.form>
      </section>
    </main>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-[#7eb6ff]">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition placeholder:text-[#6f8198] focus:border-[#7eb6ff]/65 focus:bg-black/50 focus:shadow-[0_0_28px_rgba(71,132,211,0.14)]"
      />
    </label>
  );
}

function SelectInput<T extends readonly string[]>({
  label,
  value,
  options,
  glowing = false,
  onChange,
}: {
  label: string;
  value: string;
  options: T;
  glowing?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-[#7eb6ff]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-2xl border bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition focus:border-[#7eb6ff]/65 focus:bg-black/50 focus:shadow-[0_0_28px_rgba(71,132,211,0.14)] ${
          glowing
            ? "border-[#c9a858]/55 shadow-[0_0_26px_rgba(201,168,88,0.22)] animate-pulse"
            : "border-white/10"
        }`}
      >
        <option value="" disabled className="bg-[#090d16] text-[#9baabd]">
          Choose...
        </option>
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#090d16] text-[#f8ecd0]">
            {labelize(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
