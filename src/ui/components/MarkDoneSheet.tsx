import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { markOrderDone, previewOrderDone, type ShortReport } from '../../actions/stockActions'
import type { Order } from '../../types'
import { useDb } from '../AppState'
import { itemName } from '../itemOrder'
import { useCatalog } from '../useCatalog'
import { ConfirmDialog } from './ConfirmDialog'

/** Previews what marking `order` done deducts, warns if stock is short, then marks it done. */
export function MarkDoneSheet({ order, onClose }: { order: Order; onClose(): void }) {
  const db = useDb()
  const catalog = useCatalog()
  const [preview, setPreview] = useState<ShortReport | null>(null)

  useEffect(() => { void previewOrderDone(db, order.id).then(setPreview) }, [db, order.id])
  if (!preview) return null

  const confirm = async () => { await markOrderDone(db, order.id); onClose() }

  if (preview.short.length > 0) {
    return (
      <ConfirmDialog title="Your counts may be out of date" confirmLabel="Mark done anyway" onConfirm={() => void confirm()} onCancel={onClose}>
        <p>The app has less in stock than this order needs:</p>
        <ul className="plain-list">
          {preview.short.map((s) => <li key={s.itemId}>{itemName(catalog, s.itemId)} short by {s.qty}</li>)}
        </ul>
        <p><Link to="/stock">Fix counts</Link> first, or go ahead; stock stops at zero.</p>
      </ConfirmDialog>
    )
  }

  return (
    <ConfirmDialog title="Mark order done?" confirmLabel="Mark done" onConfirm={() => void confirm()} onCancel={onClose}>
      <p>This takes the order's items out of stock:</p>
      <ul className="plain-list">
        {order.lines.map((l) => <li key={l.itemId}>{itemName(catalog, l.itemId)} −{l.qty}</li>)}
      </ul>
    </ConfirmDialog>
  )
}
