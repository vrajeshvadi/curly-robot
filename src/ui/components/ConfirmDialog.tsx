import type { ReactNode } from 'react'

export function ConfirmDialog(props: {
  title: string
  children?: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{props.title}</h2>
        {props.children}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={props.onCancel}>Cancel</button>
          <button type="button" className={props.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
