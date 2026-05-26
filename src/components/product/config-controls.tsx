"use client";

import type { Dispatch, SetStateAction } from "react";

import type { ProfileFormState } from "./shared";

type SocialArrayFieldKey = "interestProfiles" | "oppositionProfiles";
type StringListFieldKey =
  | "interestSites"
  | "oppositionSites"
  | "trainingReferenceLinks";

export function ToggleGridField({
  label,
  values,
  options,
  onToggle,
  compact = false,
}: {
  label: string;
  values: string[];
  options: readonly string[];
  onToggle: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="control-group">
      <span className="control-label">{label}</span>
      <div className={compact ? "option-grid compact" : "option-grid"}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={values.includes(option) ? "option active" : "option"}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function updateToggleValues(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((item) => item !== nextValue)
    : [...values, nextValue];
}

export function DynamicStringListField({
  label,
  fieldKey,
  values,
  placeholder,
  addLabel,
  setProfileForm,
  maxItems = 10,
}: {
  label: string;
  fieldKey: StringListFieldKey;
  values: string[];
  placeholder: string;
  addLabel: string;
  setProfileForm: Dispatch<SetStateAction<ProfileFormState>>;
  maxItems?: number;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="stack-list">
        {values.map((value, index) => (
          <div key={`${fieldKey}-${index}`} className="inline-list-row">
            <input
              value={value}
              onChange={(event) =>
                setProfileForm((current) =>
                  ({
                    ...current,
                    [fieldKey as string]: current[fieldKey].map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  }) as ProfileFormState,
                )
              }
              placeholder={placeholder}
            />
            <button
              type="button"
              className="ghost-button icon-only-button"
              onClick={() =>
                setProfileForm((current) =>
                  ({
                    ...current,
                    [fieldKey as string]: current[fieldKey].filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }) as ProfileFormState,
                )
              }
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ghost-button"
        onClick={() =>
          setProfileForm((current) =>
            ({
              ...current,
              [fieldKey as string]:
                current[fieldKey].length >= maxItems
                  ? current[fieldKey]
                  : [...current[fieldKey], ""],
            }) as ProfileFormState,
          )
        }
        disabled={values.length >= maxItems}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function DynamicSocialListField({
  label,
  fieldKey,
  values,
  networkOptions,
  addLabel,
  setProfileForm,
  maxItems = 10,
}: {
  label: string;
  fieldKey: SocialArrayFieldKey;
  values: Array<{ network: string; handle: string }>;
  networkOptions: readonly string[];
  addLabel: string;
  setProfileForm: Dispatch<SetStateAction<ProfileFormState>>;
  maxItems?: number;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="stack-list">
        {values.map((value, index) => (
          <div key={`${fieldKey}-${index}`} className="inline-list-row social-row">
            <select
              value={value.network}
              onChange={(event) =>
                setProfileForm((current) =>
                  ({
                    ...current,
                    [fieldKey as string]: current[fieldKey].map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, network: event.target.value }
                        : item,
                    ),
                  }) as ProfileFormState,
                )
              }
            >
              {networkOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={value.handle}
              onChange={(event) =>
                setProfileForm((current) =>
                  ({
                    ...current,
                    [fieldKey as string]: current[fieldKey].map((item, itemIndex) =>
                      itemIndex === index ? { ...item, handle: event.target.value } : item,
                    ),
                  }) as ProfileFormState,
                )
              }
              placeholder="@perfil"
            />
            <button
              type="button"
              className="ghost-button icon-only-button"
              onClick={() =>
                setProfileForm((current) =>
                  ({
                    ...current,
                    [fieldKey as string]: current[fieldKey].filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }) as ProfileFormState,
                )
              }
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ghost-button"
        onClick={() =>
          setProfileForm((current) =>
            ({
              ...current,
              [fieldKey as string]:
                current[fieldKey].length >= maxItems
                  ? current[fieldKey]
                  : [
                      ...current[fieldKey],
                      { network: networkOptions[0] ?? "Instagram", handle: "" },
                    ],
            }) as ProfileFormState,
          )
        }
        disabled={values.length >= maxItems}
      >
        {addLabel}
      </button>
    </div>
  );
}
