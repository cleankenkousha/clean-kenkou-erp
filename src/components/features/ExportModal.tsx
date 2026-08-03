import React, { useState } from 'react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (month: string) => void
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport }) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-07')

  if (!isOpen) return null

  const months = [
    { value: 'all', label: '🗂️ 全期間（すべてのデータ）' },
    { value: '2026-08', label: '📅 2026年8月度' },
    { value: '2026-07', label: '📅 2026年7月度' },
    { value: '2026-06', label: '📅 2026年6月度' },
  ]

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="exportModalTitle">Excel集計データの出力</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="閉じる">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="exportMonthSelect">
              出力対象年月（請求書送付・受付基準）
            </label>
            <select
              id="exportMonthSelect"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-input"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              background: 'var(--lane-bg)',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginTop: '0.5rem',
            }}
          >
            💡 <strong>集計仕様:</strong>
            <br />
            選んだ月における「新規受付数」「請求書送付済（成約数）」「成約率（％）」を自動計算した【集計サマリー】シートと【案件明細一覧】シートの2構造で出力されます。
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onExport(selectedMonth)
              onClose()
            }}
          >
            Excelを出力する
          </button>
        </div>
      </div>
    </div>
  )
}
