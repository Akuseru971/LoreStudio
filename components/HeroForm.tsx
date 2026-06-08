"use client";

import { motion } from "framer-motion";
import type { BookFormInput } from "@/lib/types";
import { archetypes, genders, tones, universeStyles } from "@/lib/utils";

type HeroFormProps = {
  onSubmit: (input: BookFormInput) => void;
  disabled?: boolean;
};

const defaultInput: BookFormInput = {
  name: "",
  gender: "unknown",
  archetype: "wanderer",
  tone: "mysterious",
  universeStyle: "dark fantasy",
  strength: "",
  weakness: "",
};

function labelize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function HeroForm({ onSubmit, disabled = false }: HeroFormProps) {
  function handleSubmit(formData: FormData) {
    onSubmit({
      name: String(formData.get("name") || "").trim().slice(0, 40),
      gender: String(formData.get("gender") || "unknown") as BookFormInput["gender"],
      archetype: String(formData.get("archetype") || "wanderer"),
      tone: String(formData.get("tone") || "mysterious"),
      universeStyle: String(formData.get("universeStyle") || "dark fantasy"),
      strength: String(formData.get("strength") || "").trim().slice(0, 80),
      weakness: String(formData.get("weakness") || "").trim().slice(0, 80),
    });
  }

  return (
    <main className="archive-shell relative flex min-h-screen items-center justify-center px-5 py-12 md:px-8">
      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="text-center lg:text-left"
        >
          <p className="mb-5 inline-flex rounded-full border border-[#d9bd78]/25 bg-[#d9bd78]/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-[#d9bd78]">
            Forgotten archive
          </p>
          <h1 className="font-title text-5xl leading-[0.95] text-[#f8ecd0] drop-shadow-2xl sm:text-6xl lg:text-7xl">
            The Book of Your Legend
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#c9d3df] lg:mx-0">
            Enter your name. Open the myth written for you.
          </p>
          <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3 text-left lg:mx-0">
            {["Illustrated", "Narrated", "Interactive"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="font-title text-sm tracking-[0.18em] text-[#d9bd78]">{item}</p>
                <p className="mt-2 text-xs leading-5 text-[#93a3b8]">A relic-grade scene woven into your story.</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.form
          action={handleSubmit}
          initial={{ opacity: 0, y: 34, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.1, ease: "easeOut" }}
          className="glass-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#d9bd78]/70 to-transparent" />
          <div className="mb-6">
            <p className="font-title text-2xl text-[#f7ebce]">Bind your name to the archive</p>
            <p className="mt-2 text-sm leading-6 text-[#9baabd]">
              Your answers become the spine of an eight-page dark fantasy relic.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#d9bd78]">Name or pseudo</span>
              <input
                name="name"
                required
                maxLength={40}
                placeholder="Aurel, Nyx, Marrow..."
                className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition focus:border-[#d9bd78]/60 focus:bg-black/50"
                defaultValue={defaultInput.name}
              />
            </label>

            <SelectField name="gender" label="Gender" values={genders} defaultValue={defaultInput.gender} />
            <SelectField name="archetype" label="Archetype" values={archetypes} defaultValue={defaultInput.archetype} />
            <SelectField name="tone" label="Story tone" values={tones} defaultValue={defaultInput.tone} />
            <SelectField
              name="universeStyle"
              label="Universe style"
              values={universeStyles}
              defaultValue={defaultInput.universeStyle}
            />

            <label>
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#d9bd78]">One strength</span>
              <input
                name="strength"
                required
                maxLength={80}
                placeholder="Unbroken loyalty"
                className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition focus:border-[#d9bd78]/60 focus:bg-black/50"
                defaultValue={defaultInput.strength}
              />
            </label>

            <label>
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#d9bd78]">One weakness</span>
              <input
                name="weakness"
                required
                maxLength={80}
                placeholder="Fear of being forgotten"
                className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition focus:border-[#d9bd78]/60 focus:bg-black/50"
                defaultValue={defaultInput.weakness}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="gold-button mt-6 w-full rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-[0.24em] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate my legend
          </button>
        </motion.form>
      </section>
    </main>
  );
}

function SelectField<T extends readonly string[]>({
  name,
  label,
  values,
  defaultValue,
}: {
  name: string;
  label: string;
  values: T;
  defaultValue: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#d9bd78]">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[#f8ecd0] outline-none transition focus:border-[#d9bd78]/60 focus:bg-black/50"
      >
        {values.map((value) => (
          <option key={value} value={value} className="bg-[#090d16] text-[#f8ecd0]">
            {labelize(value)}
          </option>
        ))}
      </select>
    </label>
  );
}
