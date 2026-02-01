import React from 'react'

const OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50'
const PANEL_CLASS =
  'relative z-10 bg-white rounded-lg shadow-xl w-full max-w-[480px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto'
const HEADER_CLASS =
  'flex items-center justify-between p-4 border-b border-slate-200'
const TITLE_CLASS = 'text-lg font-semibold m-0 text-slate-800'
const CLOSE_BTN_CLASS =
  'w-8 h-8 border-none bg-transparent text-2xl leading-none text-slate-500 cursor-pointer rounded hover:bg-slate-100 hover:text-slate-700'

type ModalProps = {
  /** Whether the modal is open */
  open: boolean
  /** Called when user requests close (backdrop or close button) */
  onClose: () => void
  /** Modal title (shown in header) */
  title: React.ReactNode
  /** Modal body */
  children: React.ReactNode
  /** Optional id for title (for aria-labelledby) */
  titleId?: string
  /** Optional extra class for the panel */
  panelClassName?: string
}

/**
 * Reusable modal: overlay, panel with title + close button, body.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  titleId = 'modal-title',
  panelClassName = '',
}: ModalProps) {
  if (!open) return null

  return (
    <div
      className={OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className={`${PANEL_CLASS} ${panelClassName}`.trim()}>
        <div className={HEADER_CLASS}>
          <h2 id={titleId} className={TITLE_CLASS}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={CLOSE_BTN_CLASS}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
