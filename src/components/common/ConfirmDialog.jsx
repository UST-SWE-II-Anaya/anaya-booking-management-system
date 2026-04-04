// src/components/common/ConfirmDialog.jsx
import Modal from './Modal'

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-gray-600 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm border border-gray-200 rounded-lg
          hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className={`px-4 py-2 text-sm rounded-lg text-white transition-colors
          font-medium ${danger
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-[#8A956D] hover:bg-[#7a8560]'
          }`}
      >
        {confirmLabel}
      </button>
    </div>
  </Modal>
)

export default ConfirmDialog
