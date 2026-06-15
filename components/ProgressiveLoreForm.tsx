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

type RollableField = "gender" | "characterType" | "runeterraRegion";

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

const fieldOptions: Record<RollableField, readonly string[]> = {
  gender: genders,
  characterType: characterTypes,
  runeterraRegion: runeterraRegions,
};

const ROLL_ANIMATION_MS = 420;
const GLOW_DURATION_MS = 1200;

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

function rollRandomItem<T extends string>(items: readonly T[], current?: string): T {
  if (items.length <= 1) {
    return items[0]!;
  }

  let next = getRandomItem(items);
  let attempts = 0;

  while (current && next === current && attempts < 12) {
    next = getRandomItem(items);
    attempts += 1;
  }

  return next;
}

function RandomDiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3.5"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8.25" cy="8.25" r="1.85" fill="currentColor" />
      <circle cx="15.75" cy="8.25" r="1.85" fill="currentColor" />
      <circle cx="8.25" cy="12" r="1.85" fill="currentColor" />
      <circle cx="15.75" cy="12" r="1.85" fill="currentColor" />
      <circle cx="8.25" cy="15.75" r="1.85" fill="currentColor" />
      <circle cx="15.75" cy="15.75" r="1.85" fill="currentColor" />
    </svg>
  );
}

function FieldDiceButton({
  label,
  rolling,
  disabled,
  onClick,
}: {
  label: string;
  rolling: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Randomiser ${label}`}
      title={`Lancer le dé — ${label}`}
      className="inline-flex h-[3.05rem] w-[3.05rem] shrink-0 items-center justify-center rounded-2xl border border-[#7eb6ff]/28 bg-[#07101c]/75 text-[#9ec8ff] shadow-[0_0_18px_rgba(71,132,211,0.1)] transition hover:border-[#7eb6ff]/50 hover:bg-[#0a1524]/90 hover:text-[#d8ecff] hover:shadow-[0_0_24px_rgba(71,132,211,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RandomDiceIcon className={`h-[1.35rem] w-[1.35rem] ${rolling ? "animate-[spin_0.42s_ease-in-out]" : ""}`} />
    </button>
  );
}

export default function ProgressiveLoreForm({ onSubmit, disabled = false }: ProgressiveLoreFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [visibleCount, setVisibleCount] = useState(1);
  const [rollingField, setRollingField] = useState<RollableField | null>(null);
  const [glowingFields, setGlowingFields] = useState<Set<keyof BookFormInput>>(() => new Set());

  const glowTimerRef = useRef<number | undefined>(undefined);

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

  const targetVisibleCount = Math.min(fieldOrder.length + 1, completedCount + 1);
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
    };
  }, []);

  function updateValue(key: keyof BookFormInput, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function pulseFieldGlow(key: RollableField) {
    setGlowingFields(new Set([key]));

    if (glowTimerRef.current) {
      window.clearTimeout(glowTimerRef.current);
    }

    glowTimerRef.current = window.setTimeout(() => {
      setGlowingFields(new Set());
    }, GLOW_DURATION_MS);
  }

  function handleRollField(key: RollableField) {
    if (disabled || rollingField) {
      return;
    }

    setRollingField(key);

    window.setTimeout(() => {
      setValues((current) => ({
        ...current,
        [key]: rollRandomItem(fieldOptions[key], current[key]),
      }));

      pulseFieldGlow(key);
      setRollingField(null);
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
            <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-[#7eb6ff]/60">
              Lancez le dé à côté d&apos;un champ pour laisser le hasard décider.
            </p>
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
                    rolling={rollingField === "gender"}
                    rollDisabled={disabled || Boolean(rollingField)}
                    onChange={(value) => updateValue("gender", value)}
                    onRoll={() => handleRollField("gender")}
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
                    rolling={rollingField === "characterType"}
                    rollDisabled={disabled || Boolean(rollingField)}
                    onChange={(value) => updateValue("characterType", value)}
                    onRoll={() => handleRollField("characterType")}
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
                    rolling={rollingField === "runeterraRegion"}
                    rollDisabled={disabled || Boolean(rollingField)}
                    onChange={(value) => updateValue("runeterraRegion", value)}
                    onRoll={() => handleRollField("runeterraRegion")}
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
  rolling = false,
  rollDisabled = false,
  onChange,
  onRoll,
}: {
  label: string;
  value: string;
  options: T;
  glowing?: boolean;
  rolling?: boolean;
  rollDisabled?: boolean;
  onChange: (value: string) => void;
  onRoll: () => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-[#7eb6ff]">{label}</span>
      <div className="flex items-stretch gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-w-0 flex-1 rounded-2xl border bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition focus:border-[#7eb6ff]/65 focus:bg-black/50 focus:shadow-[0_0_28px_rgba(71,132,211,0.14)] ${
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
        <FieldDiceButton label={label} rolling={rolling} disabled={rollDisabled} onClick={onRoll} />
      </div>
    </div>
  );
}
