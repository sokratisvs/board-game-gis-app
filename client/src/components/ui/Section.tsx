import React from 'react'

const SECTION_CLASS =
  'bg-white rounded-lg border border-slate-200 p-3 mb-6 sm:p-4'
const HEADING_CLASS = 'text-lg font-semibold m-0 mb-4 text-slate-700'

type SectionProps = {
  /** Section heading (h2); omit for no heading */
  title?: React.ReactNode
  /** Id for heading (and aria-labelledby on section). Required when title is set for a11y. */
  id?: string
  /** Section content */
  children: React.ReactNode
  /** Extra class names for the section wrapper */
  className?: string
}

/**
 * Reusable content section: white card, optional heading.
 * Used on Dashboard, Users, Settings.
 */
export default function Section({
  title,
  id,
  children,
  className = '',
}: SectionProps) {
  return (
    <section
      className={`${SECTION_CLASS} ${className}`.trim()}
      aria-labelledby={title != null && id ? id : undefined}
    >
      {title != null && (
        <h2 id={id} className={HEADING_CLASS}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
