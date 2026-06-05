interface WelcomeOnboardingProps {
  onScanNow: () => void
  onAddFolder: () => void
  scanning?: boolean
  addingFolder?: boolean
}

const FEATURES = [
  'Remembers files from watched folders',
  'Remembers clipboard text',
  'Indexes documents for search',
  'Everything stays local',
] as const

const primaryButtonClassName =
  'rounded-md bg-remy-accent px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40'

const secondaryButtonClassName =
  'rounded-md border border-remy-border bg-remy-elevated px-3 py-1.5 text-xs font-medium text-remy-subtle transition-colors hover:border-zinc-600 hover:text-remy-text disabled:cursor-not-allowed disabled:opacity-40'

export function WelcomeOnboarding({
  onScanNow,
  onAddFolder,
  scanning = false,
  addingFolder = false,
}: WelcomeOnboardingProps) {
  return (
    <section
      className="mb-3 rounded-xl border border-remy-border bg-remy-surface px-4 py-3.5"
      aria-labelledby="welcome-onboarding-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id="welcome-onboarding-title"
            className="text-sm font-semibold text-remy-text"
          >
            Welcome to Remy
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-5">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 text-xs text-remy-subtle"
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full bg-remy-accent"
                  aria-hidden
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onScanNow}
            disabled={scanning}
            className={primaryButtonClassName}
          >
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
          <button
            type="button"
            onClick={onAddFolder}
            disabled={addingFolder}
            className={secondaryButtonClassName}
          >
            {addingFolder ? 'Opening…' : 'Add Folder'}
          </button>
        </div>
      </div>
    </section>
  )
}

export { primaryButtonClassName, secondaryButtonClassName }
