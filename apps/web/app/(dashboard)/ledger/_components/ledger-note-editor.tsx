type LedgerNoteEditorProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function LedgerNoteEditor(props: LedgerNoteEditorProps) {
  return (
    <div className="w-full">
      <input
        autoFocus
        value={props.value}
        maxLength={200}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") props.onSave();
        }}
        placeholder={props.placeholder}
        className="w-full border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
      />
      <button
        type="button"
        onClick={props.onCancel}
        className="mt-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
      >
        Cancel
      </button>
    </div>
  );
}
