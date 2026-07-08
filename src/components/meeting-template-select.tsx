"use client";

import { MEETING_TEMPLATES } from "@/lib/meeting-templates";
import { modelOptions } from "@/lib/meeting-notes-mock";

export function MeetingTemplateSelect({
  template,
  setTemplate,
  transcriptionModel,
  setTranscriptionModel,
  notesModel,
  setNotesModel,
}: {
  template: string;
  setTemplate: (value: string) => void;
  transcriptionModel: string;
  setTranscriptionModel: (value: string) => void;
  notesModel: string;
  setNotesModel: (value: string) => void;
}) {
  return (
    <>
      <section aria-labelledby="model-title" className="space-y-4">
        <h2 id="model-title" className="text-lg font-semibold">
          Models
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ModelSelect
            id="transcription-model"
            label="Transcription Model"
            helperText="Model for audio transcription"
            value={transcriptionModel}
            onChange={setTranscriptionModel}
          />
          <ModelSelect
            id="notes-model"
            label="Notes Generation Model"
            helperText="Model for generating meeting notes"
            value={notesModel}
            onChange={setNotesModel}
          />
        </div>
      </section>

      <section aria-labelledby="template-title" className="space-y-3">
        <h2 id="template-title" className="text-lg font-semibold">
          Meeting Template
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {MEETING_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`rounded-[14px] border p-3 text-left transition ${
                template === t.id
                  ? "border-ink bg-brand-blue-200/40"
                  : "border-hairline bg-canvas hover:border-stone"
              }`}
            >
              <p className="text-base">{t.icon}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{t.label}</p>
              <p className="mt-0.5 text-xs text-slate line-clamp-2">{t.description}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ModelSelect({
  id,
  label,
  helperText,
  value,
  onChange,
}: {
  id: string;
  label: string;
  helperText: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="mt-2 h-12 w-full rounded-md border border-hairline bg-canvas px-3 text-base text-ink shadow-sm outline-none transition focus:border-brand-blue-deep focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {modelOptions.map((model) => (
          <option key={model.value} value={model.value}>
            {model.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm text-slate">{helperText}</p>
    </div>
  );
}
