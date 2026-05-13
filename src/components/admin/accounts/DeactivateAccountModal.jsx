import { useState } from 'react'
import Modal from '../../common/Modal'
import clsx from 'clsx'

const actionConfig = {
  suspend: { title: 'Suspend Account', confirmLabel: 'Confirm Suspension', danger: false },
  ban: { title: 'Ban Account', confirmLabel: 'Confirm Ban', danger: true },
  deactivate: { title: 'Deactivate Account', confirmLabel: 'Confirm Deactivation', danger: false },
}

const warningText = {
  suspend: '⚠ This will prevent the user from logging in. The reason you enter will be visible to them.',
  ban: '⚠ This action is permanent and cannot be undone. The user will be banned immediately and all their sessions will be revoked.',
  deactivate: '⚠ This will prevent the user from logging in. The reason you enter will be visible to them.',
}

const DeactivateAccountModal = ({ open, onClose, onConfirm, userName, userRole, action = 'suspend' }) => {
  const [reason, setReason] = useState('')
  const config = actionConfig[action]
  const canSubmit = reason.trim().length > 0

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm(reason.trim())
    setReason('')
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={config.title} size="sm">
      <div className="px-1">
        <p className="text-xs text-gray-400 -mt-2 mb-4">
          {userName} · <span className="capitalize">{userRole}</span>
        </p>

        <div className={`rounded-lg p-3 mb-4 border ${
          action === 'ban'
            ? 'bg-red-50 border-red-100'
            : 'bg-amber-50 border-amber-100'
        }`}>
          <p className={`text-xs ${action === 'ban' ? 'text-red-700' : 'text-amber-700'}`}>
            {warningText[action]}
          </p>
        </div>

        <div className="mb-5">
          <label
            htmlFor="deactivate-reason"
            className="block text-xs font-semibold text-gray-500 mb-1"
          >
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            id="deactivate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Multiple no-show appointments recorded."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              text-[#4A4A4A] focus:outline-none focus:ring-1 focus:ring-[#8A956D] resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">This message will be visible to the user.</p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg
              hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={clsx(
              'px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              config.danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-amber-500 hover:bg-amber-600'
            )}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DeactivateAccountModal
