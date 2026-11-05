import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { backupFileName, exportBackup, importBackup, parseBackup, type BackupFile } from '../../data/backup'
import { useDb } from '../AppState'
import { ConfirmDialog } from '../components/ConfirmDialog'

function lastBackupText(iso: string | undefined): string {
  if (!iso) return 'No backup yet'
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString() ? 'Last backup: today' : `Last backup: ${d.toLocaleDateString()}`
}

export function Backup() {
  const db = useDb()
  const lastAt = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value as string | undefined, [db])
  const persisted = useLiveQuery(async () => (await db.meta.get('persisted'))?.value as boolean | undefined, [db])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<BackupFile | null>(null)

  const doExport = async () => {
    const data = await exportBackup(db)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName(new Date())
    a.click()
    // Revoking straight away can cancel the download on some phones.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const pick = async (file: File | undefined) => {
    setError(''); setNotice('')
    if (!file) return
    let json: unknown
    try { json = JSON.parse(await file.text()) } catch { json = undefined }
    const r = parseBackup(json)
    if (!r.ok) { setError("This file isn't a valid Hay Day Manager backup."); return }
    setPending(r.data)
  }

  const restore = async () => {
    if (!pending) return
    await importBackup(db, pending)
    setPending(null)
    setNotice('Backup restored.')
  }

  return (
    <section>
      <div aria-hidden={pending ? true : undefined} inert={pending ? true : undefined}>
        <h1>Backup</h1>
        <p>Your data lives only on this phone. Export a backup to keep a copy, or to move to another phone.</p>
        {persisted === false && <p className="banner banner-warn">Your browser may clear this data. Export a backup regularly.</p>}

        <h2>Export</h2>
        <p className="muted">{lastBackupText(lastAt)}</p>
        <button type="button" className="btn btn-primary" onClick={() => void doExport()}>Export backup</button>

        <h2>Restore</h2>
        <div className="field">
          <label htmlFor="backup-file">Import a backup file</label>
          <input id="backup-file" type="file" accept="application/json,.json" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {notice && <p className="plan-ready" role="status">{notice}</p>}
      </div>

      {pending && (
        <ConfirmDialog title="Replace all data?" confirmLabel="Replace all data" danger onConfirm={() => void restore()} onCancel={() => setPending(null)}>
          <p>
            Every farm, count, order and catalog edit on this phone is replaced with the backup from{' '}
            {new Date(pending.exportedAt).toLocaleString()} ({pending.farms.length} {pending.farms.length === 1 ? 'farm' : 'farms'}).
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
