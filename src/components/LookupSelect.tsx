"use client";

import { useState } from "react";

const NEW = "__new__";

type Props = {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
  addLabel: string;
  required?: boolean;
};

/** Dropdown of saved choices with an "Add new" entry that reveals a text box. The chosen/typed text is submitted as `name`. */
export function LookupSelect({ name, label, options, defaultValue = "", addLabel, required }: Props) {
  // A value saved earlier that's no longer in the list still needs to show up.
  const all = defaultValue && !options.includes(defaultValue) ? [defaultValue, ...options] : options;
  const [choice, setChoice] = useState(defaultValue);
  const [typed, setTyped] = useState("");
  const adding = choice === NEW;

  return (
    <div>
      <label className="label" htmlFor={`${name}-select`}>
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <select
        id={`${name}-select`}
        value={choice}
        required={required}
        onChange={(e) => setChoice(e.target.value)}
        className="input"
      >
        <option value="">Select…</option>
        {all.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={NEW}>＋ {addLabel}</option>
      </select>
      {adding ? (
        <input
          id={name}
          name={name}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={addLabel}
          required
          autoFocus
          maxLength={60}
          className="input mt-2"
        />
      ) : (
        <input type="hidden" name={name} value={choice} />
      )}
    </div>
  );
}
