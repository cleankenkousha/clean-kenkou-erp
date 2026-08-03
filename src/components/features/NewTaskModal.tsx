import React, { useState } from 'react'
import { ProcessTask } from './KanbanBoard'

interface NewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (newTask: Omit<ProcessTask, 'id' | 'updatedAt'>, shouldPrint?: boolean) => void
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [customer, setCustomer] = useState('')
  const [tel, setTel] = useState('')
  const [address, setAddress] = useState('')
  const [taskType, setTaskType] = useState('')
  const [updater, setUpdater] = useState('')

  if (!isOpen) return null

  const handleFormSubmit = (shouldPrint = false) => {
    if (!customer.trim() || !taskType.trim() || !updater.trim()) {
      alert('顧客名、案件内容、担当者名（入力者名）は必須です。')
      return
    }

    const today = new Date()
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}`

    onSubmit(
      {
        customer: customer.trim(),
        tel: tel.trim(),
        address: address.trim(),
        taskType: taskType.trim(),
        status: '未着手',
        receptionDate: todayStr,
        updater: updater.trim(),
        isArchived: false,
        stepsData: {},
      },
      shouldPrint
    )

    setCustomer('')
    setTel('')
    setAddress('')
    setTaskType('')
    setUpdater('')
    onClose()
  }

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="newTaskModalTitle">新規受付の入力</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="閉じる">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <form className="form-layout" onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="newCustomer">
                顧客名 <span className="required">*</span>
              </label>
              <input
                type="text"
                id="newCustomer"
                required
                className="form-input"
                placeholder="例: 山田 太郎"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newTel">連絡先 (TEL)</label>
              <input
                type="text"
                id="newTel"
                className="form-input"
                placeholder="例: 090-1234-5678"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newAddress">住所 (Googleマップ連携用)</label>
              <input
                type="text"
                id="newAddress"
                className="form-input"
                placeholder="例: 熊本県山鹿市〇〇1-2-3"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newTaskType">
                案件内容 <span className="required">*</span>
              </label>
              <input
                type="text"
                id="newTaskType"
                required
                className="form-input"
                placeholder="例: 粗大ごみ回収"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newUpdater">
                担当者名（入力者名） <span className="required">*</span>
              </label>
              <input
                type="text"
                id="newUpdater"
                required
                className="form-input"
                placeholder="例: 山田"
                value={updater}
                onChange={(e) => setUpdater(e.target.value)}
              />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ background: '#0284c7', color: 'white', borderColor: '#0284c7' }}
            onClick={() => handleFormSubmit(true)}
          >
            🖨️ 登録して指示書を印刷
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleFormSubmit(false)}
          >
            登録する
          </button>
        </div>
      </div>
    </div>
  )
}
