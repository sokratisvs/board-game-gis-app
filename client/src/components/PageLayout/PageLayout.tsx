import React from 'react'

const PAGE_CONTAINER_CLASS =
  'max-w-[1200px] mx-auto px-3 py-4 sm:p-3 md:px-6 md:py-4'
const PAGE_HEADER_CLASS = 'mb-6'
const PAGE_TITLE_CLASS = 'text-2xl font-bold text-sidebar m-0 mb-1'
const PAGE_DESCRIPTION_CLASS = 'text-sm text-slate-500 m-0'

type PageLayoutProps = {
  /** Optional page title (h1) */
  title?: React.ReactNode
  /** Optional short description below title */
  description?: React.ReactNode
  /** Page content */
  children: React.ReactNode
}

/**
 * Shared layout for app pages: Map, Settings, Users, Dashboard.
 * Same container (max-width, padding) and optional standard header (title + description).
 */
export default function PageLayout({
  title,
  description,
  children,
}: PageLayoutProps) {
  return (
    <div className={PAGE_CONTAINER_CLASS}>
      {(title != null || description != null) && (
        <header className={PAGE_HEADER_CLASS}>
          {title != null && <h1 className={PAGE_TITLE_CLASS}>{title}</h1>}
          {description != null && (
            <p className={PAGE_DESCRIPTION_CLASS}>{description}</p>
          )}
        </header>
      )}
      {children}
    </div>
  )
}

export {
  PAGE_CONTAINER_CLASS,
  PAGE_HEADER_CLASS,
  PAGE_TITLE_CLASS,
  PAGE_DESCRIPTION_CLASS,
}
