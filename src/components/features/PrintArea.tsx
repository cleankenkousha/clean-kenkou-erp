import React from 'react'
import ReactDOM from 'react-dom'

export interface StepsData {
  reception?: { status: string; memo: string; worker: string }
  estimate_schedule?: { status: string; memo: string; worker: string }
  estimate_do?: { status: string; memo: string; worker: string }
  estimate_submit?: { status: string; memo: string; worker: string }
  customer_consideration?: { status: string; memo: string; worker: string }
  work_schedule?: { status: string; memo: string; worker: string }
  schedule_confirmed?: { status: string; memo: string; worker: string }
  work_execution?: { status: string; memo: string; worker: string }
  invoice_sent?: { status: string; memo: string; worker: string }
}

export interface PrintTaskData {
  receptionNo: string
  customer: string
  tel: string
  address: string
  taskType: string
  receptionDate: string
  updater: string
  stepsData?: StepsData
}

interface PrintAreaProps {
  task: PrintTaskData | null
}

export const PrintArea: React.FC<PrintAreaProps> = ({ task }) => {
  // ポータルのマウント先を取得（index.html の #print-root）
  const targetElement = document.getElementById('print-root') || document.body

  // タスクデータが無い場合は空の印刷コンテナを出力
  if (!task) {
    return ReactDOM.createPortal(
      <div id="printArea" className="print-container"></div>,
      targetElement
    )
  }

  // ステップデータの抽出
  const steps = task.stepsData || {}

  const receptionWorker = steps.reception?.worker || task.updater || ''
  const estimateWorker = steps.estimate_do?.worker || steps.estimate_submit?.worker || ''
  const workWorker = steps.work_execution?.worker || ''

  const receptionMemo = steps.reception?.memo || ''
  const estimateDate = steps.estimate_do?.memo || ''
  const estimateSubmitMemo = steps.estimate_submit?.memo || ''
  const workScheduleMemo = steps.work_schedule?.memo || ''

  // 全ステップの特記事項を結合
  const allMemos = [
    steps.reception?.memo ? `【受付伝言】${steps.reception.memo}` : '',
    steps.estimate_schedule?.memo ? `【見積日程】${steps.estimate_schedule.memo}` : '',
    steps.estimate_do?.memo ? `【見積実施】${steps.estimate_do.memo}` : '',
    steps.estimate_submit?.memo ? `【見積金額/提出】${steps.estimate_submit.memo}` : '',
    steps.customer_consideration?.memo ? `【顧客検討】${steps.customer_consideration.memo}` : '',
    steps.work_schedule?.memo ? `【作業日程】${steps.work_schedule.memo}` : '',
    steps.schedule_confirmed?.memo ? `【日程確定】${steps.schedule_confirmed.memo}` : '',
    steps.work_execution?.memo ? `【作業実施】${steps.work_execution.memo}` : '',
    steps.invoice_sent?.memo ? `【請求書送付】${steps.invoice_sent.memo}` : '',
  ].filter(Boolean).join('\n')

  // Portal経由で #print-root 直下にレンダリング
  return ReactDOM.createPortal(
    <div id="printArea" className="print-container">
      {/* 表面 (A4 1ページ目: 臨時収集依頼書) */}
      <div className="print-page print-page-front">
        <div className="print-header-row">
          <h1 className="print-title">
            臨時収集依頼書<span className="print-subtitle">（ホッチキス止めするときは、この紙を表に）</span>
          </h1>
          <div className="print-signatures">
            <div className="sig-box">
              <div className="sig-title">受付責任者</div>
              <div className="sig-name">（　{receptionWorker}　）</div>
            </div>
            <div className="sig-box">
              <div className="sig-title">現地調査・見積責任者</div>
              <div className="sig-name">（　{estimateWorker}　）</div>
            </div>
            <div className="sig-box">
              <div className="sig-title">作業責任者</div>
              <div className="sig-name">（　{workWorker}　）</div>
            </div>
          </div>
        </div>

        {/* 基本情報 */}
        <table className="print-table table-section1">
          <tbody>
            <tr>
              <th style={{ width: '14%' }}>受付日</th>
              <td style={{ width: '36%' }}>{task.receptionDate}</td>
              <th style={{ width: '15%' }}>ご依頼者名</th>
              <td style={{ width: '35%' }} className="font-large">{task.customer} 様</td>
            </tr>
            <tr>
              <th>現場住所</th>
              <td>{task.address} <span className="print-subtext">（地図添付）</span></td>
              <th>ご連絡先</th>
              <td className="font-large">{task.tel}</td>
            </tr>
            <tr>
              <th>ご依頼内容</th>
              <td colSpan={3}>
                <div style={{ fontSize: '0.725rem', color: '#475569', marginBottom: '2px' }}>
                  ※お得意先様のスポット回収（見積不要で回収希望）、見積希望など
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{task.taskType}</div>
                {receptionMemo && (
                  <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>{receptionMemo}</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 見積・事前に確認すべき事項 */}
        <table className="print-table table-section2">
          <tbody>
            <tr>
              <th style={{ width: '14%' }}>見積日</th>
              <td style={{ width: '36%' }}>{estimateDate}</td>
              <th style={{ width: '15%' }}>見積額</th>
              <td style={{ width: '35%' }} className="font-large">
                {estimateSubmitMemo ? `口頭 (${estimateSubmitMemo})` : '別紙　口頭 (　　　　　　　)'}
              </td>
            </tr>
            <tr>
              <th>現場状況</th>
              <td colSpan={3}>別紙写真　　写真無し（　　　　　　　　　　　　　　　　　　）</td>
            </tr>
            <tr>
              <th>予定台数</th>
              <td>2ｔなら　　　台分</td>
              <th>予定人員</th>
              <td>　　人で　　日間（1日は午後～として）</td>
            </tr>
            <tr>
              <th>車両条件</th>
              <td>なし　あり（　　　　　　　　　　　　　　）</td>
              <th>必要道具</th>
              <td>なし　あり（　　　　　　　　　　　）</td>
            </tr>
            <tr>
              <th>報告書/マニ伝</th>
              <td>不要　必要（　　　　　） 写真： 不要　必要</td>
              <th>回収予定日</th>
              <td>
                {workScheduleMemo || '　　年　　月　　日'} <span style={{ fontSize: '0.75rem', color: '#475569' }}>（日程連絡 OK記入: 　　）</span>
              </td>
            </tr>
            <tr>
              <th>外注作業</th>
              <td>なし　あり（　　　　　） 外注手配： 口OK</td>
              <th>アンケート</th>
              <td>依頼したい　不要　当日立ち合い： あり　なし</td>
            </tr>
            <tr>
              <th>請求先</th>
              <td colSpan={3}>
                〒　　　-　　　　住所：同上<br />
                <span style={{ fontSize: '0.725rem', color: '#475569' }}>
                  ※現場住所・ご依頼者名と同じなら同上と記入
                </span>
              </td>
            </tr>
            <tr>
              <th>特記事項</th>
              <td colSpan={3} className="print-memos-cell">
                <div style={{ whiteSpace: 'pre-wrap', minHeight: '60px' }}>{allMemos || '/  /  /  /  /  /'}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 裏面 (A4 2ページ目: 現場作業実績・回収結果記入欄) */}
      <div className="print-page print-page-back">
        <div className="print-header-row">
          <h2 className="print-title">【現場作業実績・回収結果記入欄】</h2>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>管理番号: {task.receptionNo}</div>
        </div>

        <table className="print-table table-section3">
          <tbody>
            <tr>
              <th style={{ width: '15%' }}>アンケート</th>
              <td style={{ width: '35%' }}>回収済　　未回収</td>
              <th style={{ width: '20%' }}>当日の状況（見積時より）</th>
              <td style={{ width: '30%' }}>増えた　　減った　　変化なし</td>
            </tr>
            <tr>
              <th>請求・支払い</th>
              <td colSpan={3} style={{ fontSize: '0.775rem', color: '#475569', height: '42px', verticalAlign: 'top' }}>
                ※お客様から請求や支払に関して何か言われた場合に記入。何も言われなければ未記入でOK
              </td>
            </tr>
            <tr>
              <th>延べ業務時間</th>
              <td colSpan={3} style={{ fontSize: '0.825rem' }}>
                ※3人×3h×2日間なら3×3×2＝18人・ｈと記入 ／ 　　人 × 　　h × 　　日 ＝ 延べ 　　　人・ｈ
              </td>
            </tr>
          </tbody>
        </table>

        {/* 収集品目・数量テーブル */}
        <table className="print-table table-items" style={{ marginTop: '8px' }}>
          <thead>
            <tr>
              <th style={{ width: '18%' }}>分類</th>
              <th style={{ width: '27%' }}>品目名</th>
              <th style={{ width: '40%' }}>回収重量・個数記録</th>
              <th style={{ width: '15%' }}>確認</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan={3} className="center font-bold">組合搬入分</td>
              <td>金物・危険物</td>
              <td>　　　　　　　　　　　　kg</td>
              <td></td>
            </tr>
            <tr>
              <td>不燃粗大</td>
              <td>　　　　　　　　　　　　kg</td>
              <td></td>
            </tr>
            <tr>
              <td>びん類</td>
              <td>　　　　　　　　　　　　kg</td>
              <td></td>
            </tr>
            <tr>
              <td className="center font-bold">４家電</td>
              <td>冷蔵庫/洗濯機/TV/エアコン</td>
              <td>総重量:　　　kg ／ 種類・台数:　　　　</td>
              <td></td>
            </tr>
            <tr>
              <td rowSpan={6} className="center font-bold">その他自社処理</td>
              <td>可燃物</td>
              <td>　　　　　　　　　　　　Kg</td>
              <td></td>
            </tr>
            <tr>
              <td>可燃粗大</td>
              <td>　　　full　　　　　　Kg</td>
              <td></td>
            </tr>
            <tr>
              <td>木くず</td>
              <td>　　　　　　　　　　　　Kg</td>
              <td></td>
            </tr>
            <tr>
              <td>陶器くず</td>
              <td>　　　　　　　　　　　　Kg</td>
              <td></td>
            </tr>
            <tr>
              <td>廃プラ</td>
              <td>　　　　　　　　　　　　Kg</td>
              <td></td>
            </tr>
            <tr>
              <td>混合廃棄物</td>
              <td>　　　　　　　　　　　　Kg</td>
              <td></td>
            </tr>
            <tr>
              <td className="center font-bold">搬出作業</td>
              <td>作業の有無・搬出量</td>
              <td>なし　あり（　　　　　） ／ 搬出量:　　　㎥</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* 現場メモ欄 */}
        <div className="print-memo-box" style={{ marginTop: '10px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>
            メモ（作業上の特記事項・現場連絡等）:
          </div>
          <div style={{ height: '80px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
          </div>
        </div>
      </div>
    </div>,
    targetElement
  )
}
