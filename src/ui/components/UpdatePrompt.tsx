import { useRegisterSW } from 'virtual:pwa-register/react'

/** Shows "Update available" when a new version is ready; switches only when the user taps Update. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="update-prompt" role="status">
      <span>Update available</span>
      <button type="button" className="btn btn-small btn-primary" onClick={() => void updateServiceWorker(true)}>Update</button>
      <button type="button" className="btn btn-small" onClick={() => setNeedRefresh(false)}>Later</button>
    </div>
  )
}
