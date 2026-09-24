import React, { useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Phone,
  User,
  ExternalLink,
  Trash2,
  CalendarCheck,
  Briefcase,
  Car,
  Coffee,
} from 'lucide-react'
import { useStaffSchedules, CreateAppointmentParams } from '../hooks/useStaffSchedules'
import { useProfiles, getRoleInfo } from '../hooks/useProfiles'
import { StaffSchedule, ScheduleType } from '../types'
import { Button, Input } from '../components/ui'
import { TaskDetailModal } from '../components/features/TaskDetailModal'
import { useJobs } from '../hooks/useJobs'
import { mapJobStatusToLane } from '../lib/statusMapping'
import { supabase } from '../lib/supabase'

// タイムラインの表示時間帯（8:00 〜 19:00）
const START_HOUR = 8
const END_HOUR = 19
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const SCHEDULE_TYPE_LABELS: Record<
  ScheduleType,
  { label: string; badgeClass: string; cardClass: string; icon: any }
> = {
  appointment: {
    label: '見積訪問アポ',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    cardClass: 'bg-amber-50/95 border-amber-300 text-amber-950 hover:bg-amber-100',
    icon: CalendarCheck,
  },
  away: {
    label: '外出・移動',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    cardClass: 'bg-sky-50/95 border-sky-300 text-sky-950 hover:bg-sky-100',
    icon: Car,
  },
  meeting: {
    label: '打合せ・会議',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    cardClass: 'bg-purple-50/95 border-purple-300 text-purple-950 hover:bg-purple-100',
    icon: Coffee,
  },
  work: {
    label: '現場作業・立会い',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    cardClass: 'bg-emerald-50/95 border-emerald-300 text-emerald-950 hover:bg-emerald-100',
    icon: Briefcase,
  },
  private: {
    label: '休暇・私用',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    cardClass: 'bg-slate-100/95 border-slate-300 text-slate-800 hover:bg-slate-200',
    icon: User,
  },
  other: {
    label: 'その他',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
    cardClass: 'bg-gray-50/95 border-gray-300 text-gray-950 hover:bg-gray-100',
    icon: Clock,
  },
}

export const Schedule: React.FC = () => {
  // フック取得
  const { schedules, isLoading, addSchedule, deleteSchedule, createAppointmentWithJob } = useStaffSchedules()
  const { profiles } = useProfiles()
  const { jobs, updateJobDetails } = useJobs()

  // 選択日（YYYY-MM-DD）
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // 表示モード：日別営業タイムライン ('day') | 週間カレンダー ('week')
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  // スタッフフィルター（'all' または特定スタッフID）
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all')

  // 見積訪問予約モーダル（空き枠クリックで開く）
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false)
  const [appointmentForm, setAppointmentForm] = useState<CreateAppointmentParams>({
    profileId: '',
    title: '',
    startTime: '',
    endTime: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    notes: '',
    createJob: true,
  })

  // 一般予定作成モーダル（外出・打合せ等）
  const [isSimpleModalOpen, setIsSimpleModalOpen] = useState(false)
  const [simpleForm, setSimpleForm] = useState({
    profileId: '',
    title: '',
    scheduleType: 'away' as ScheduleType,
    date: selectedDate,
    startHour: '10:00',
    endHour: '11:00',
    location: '',
    notes: '',
  })

  // 選択された予定の詳細モーダル
  const [selectedSchedule, setSelectedSchedule] = useState<StaffSchedule | null>(null)

  // 連動案件の詳細モーダルを開くためのjobId
  const [activeJobDetailId, setActiveJobDetailId] = useState<string | null>(null)

  // 営業または全体スタッフ（優先度：営業 > 事務 > その他）
  const targetStaffList = useMemo(() => {
    if (selectedStaffFilter !== 'all') {
      return profiles.filter((p) => p.id === selectedStaffFilter)
    }
    // 営業担当を先頭に並べる
    return [...profiles].sort((a, b) => {
      if (a.role === 'sales' && b.role !== 'sales') return -1
      if (a.role !== 'sales' && b.role === 'sales') return 1
      return (a.display_name || '').localeCompare(b.display_name || '')
    })
  }, [profiles, selectedStaffFilter])

  // 当日のスケジュール一覧
  const daySchedules = useMemo(() => {
    return schedules.filter((s) => {
      const schDate = s.start_time.split('T')[0]
      return schDate === selectedDate
    })
  }, [schedules, selectedDate])

  // 日付の前後ナビゲーション
  const handleDateShift = (days: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + (viewMode === 'week' ? days * 7 : days))
    setSelectedDate(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(
        current.getDate()
      ).padStart(2, '0')}`
    )
  }

  const handleSetToday = () => {
    const d = new Date()
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }

  // 曜日表記
  const dayOfWeekStr = useMemo(() => {
    const d = new Date(selectedDate)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return days[d.getDay()]
  }, [selectedDate])

  // 選択日を含む週（月曜日始まり）の7日間
  const weekDays = useMemo(() => {
    const curr = new Date(selectedDate)
    const day = curr.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(curr)
    monday.setDate(curr.getDate() + diffToMonday)

    const days = []
    const dayNames = ['月', '火', '水', '木', '金', '土', '日']
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: dayNames[i],
        isToday:
          dateStr ===
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(
            new Date().getDate()
          ).padStart(2, '0')}`,
        isSelected: dateStr === selectedDate,
      })
    }
    return days
  }, [selectedDate])

  // 空き枠クリックで「即時見積訪問予約」を開く
  const handleSlotClick = (profileId: string, hour: number, targetDate = selectedDate) => {
    const startStr = `${targetDate}T${String(hour).padStart(2, '0')}:00:00+09:00`
    const endStr = `${targetDate}T${String(hour + 1).padStart(2, '0')}:00:00+09:00`

    setAppointmentForm({
      profileId,
      title: '',
      startTime: startStr,
      endTime: endStr,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      notes: '',
      createJob: true,
    })
    setIsAppointmentModalOpen(true)
  }

  // 見積訪問予約の送信
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appointmentForm.profileId || !appointmentForm.customerName.trim()) {
      alert('担当営業とお客様名を入力してください。')
      return
    }

    const title = appointmentForm.title.trim() || `${appointmentForm.customerName.trim()}様 見積訪問`

    await createAppointmentWithJob({
      ...appointmentForm,
      title,
    })

    setIsAppointmentModalOpen(false)
  }

  // 一般予定（外出・打合せ等）の送信
  const handleSaveSimpleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simpleForm.profileId || !simpleForm.title.trim()) {
      alert('担当者と予定名を入力してください。')
      return
    }

    const startTime = `${simpleForm.date}T${simpleForm.startHour}:00+09:00`
    const endTime = `${simpleForm.date}T${simpleForm.endHour}:00+09:00`

    await addSchedule({
      profile_id: simpleForm.profileId,
      title: simpleForm.title.trim(),
      schedule_type: simpleForm.scheduleType,
      start_time: startTime,
      end_time: endTime,
      location: simpleForm.location || '',
      notes: simpleForm.notes || '',
    })

    setIsSimpleModalOpen(false)
  }

  // 予定の位置計算（top %, height %）
  const getScheduleStyle = (startTimeStr: string, endTimeStr: string) => {
    const startDate = new Date(startTimeStr)
    const endDate = new Date(endTimeStr)

    const startMinutes = (startDate.getHours() - START_HOUR) * 60 + startDate.getMinutes()
    const endMinutes = (endDate.getHours() - START_HOUR) * 60 + endDate.getMinutes()
    const totalMinutes = (END_HOUR - START_HOUR) * 60

    const top = Math.max(0, (startMinutes / totalMinutes) * 100)
    const height = Math.max(4, Math.min(100 - top, ((endMinutes - startMinutes) / totalMinutes) * 100))

    return {
      top: `${top}%`,
      height: `${height}%`,
    }
  }

  const activeJob = useMemo(() => {
    if (!activeJobDetailId) return null
    return jobs.find((j) => j.id === activeJobDetailId) || null
  }, [activeJobDetailId, jobs])

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-12 font-sans">
      {/* 1. ヘッダー＆コントロールバー */}
      <div className="bg-white p-4 md:p-5 rounded-xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 左側：タイトル＆日付ナビ */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg shadow-sm">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-main tracking-tight flex items-center gap-2">
                <span>営業スケジュール ＆ 見積枠予約</span>
                <span className="hidden sm:inline-block text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-semibold">
                  リアルタイム空き状況
                </span>
              </h1>
              <p className="text-xs text-sub hidden sm:block">
                営業の空き枠を確認し、即座に見積訪問予約と新規案件を一括登録できます
              </p>
            </div>
          </div>

          {/* ビュー切替タブ（日別タイムライン / 週間カレンダー） */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              日別タイムライン
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              週間カレンダー
            </button>
          </div>

          {/* 日付操作ナビ */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => handleDateShift(-1)}
              className="p-1.5 hover:bg-white rounded-md text-main transition-colors"
              title={viewMode === 'week' ? '前週' : '前日'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-main px-2 py-1 focus:outline-none cursor-pointer"
            />
            {viewMode === 'day' && (
              <span className="text-xs font-bold px-1 text-slate-600">({dayOfWeekStr})</span>
            )}
            <button
              type="button"
              onClick={() => handleDateShift(1)}
              className="p-1.5 hover:bg-white rounded-md text-main transition-colors"
              title={viewMode === 'week' ? '翌週' : '翌日'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[11px] font-bold px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md border border-slate-300 ml-1 transition-colors shadow-xs"
            >
              今日
            </button>
          </div>
        </div>

        {/* 右側：絞り込み＆新規予定ボタン */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 担当者フィルター */}
          <select
            value={selectedStaffFilter}
            onChange={(e) => setSelectedStaffFilter(e.target.value)}
            className="p-2 border border-border rounded-lg text-xs bg-white font-medium text-main focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">全スタッフ表示</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({getRoleInfo(p.role).label})
              </option>
            ))}
          </select>

          {/* 一般予定ボタン */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSimpleForm({
                profileId: targetStaffList[0]?.id || '',
                title: '',
                scheduleType: 'away',
                date: selectedDate,
                startHour: '10:00',
                endHour: '11:00',
                location: '',
                notes: '',
              })
              setIsSimpleModalOpen(true)
            }}
            className="text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            外出・打合せ
          </Button>

          {/* 見積訪問アポ予約ボタン */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              const startStr = `${selectedDate}T10:00:00+09:00`
              const endStr = `${selectedDate}T11:00:00+09:00`
              setAppointmentForm({
                profileId: targetStaffList[0]?.id || '',
                title: '',
                startTime: startStr,
                endTime: endStr,
                customerName: '',
                customerPhone: '',
                customerAddress: '',
                notes: '',
                createJob: true,
              })
              setIsAppointmentModalOpen(true)
            }}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md flex items-center space-x-1"
          >
            <CalendarCheck className="w-4 h-4 mr-1 text-amber-200" />
            <span>見積訪問を予約</span>
          </Button>
        </div>
      </div>

      {/* 2. 凡例バー（予定の種類と色） */}
      <div className="bg-white px-4 py-2.5 rounded-lg border border-border shadow-xs flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-sub">予定区分:</span>
          {Object.entries(SCHEDULE_TYPE_LABELS).map(([typeKey, meta]) => {
            const Icon = meta.icon
            return (
              <span
                key={typeKey}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${meta.badgeClass}`}
              >
                <Icon className="w-3 h-3" />
                <span>{meta.label}</span>
              </span>
            )
          })}
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          💡 空いている時間枠をクリックすると、その場ですぐに見積予約が入ります
        </div>
      </div>

      {/* 3. メインビュー（日別タイムライン または 週間カレンダー） */}
      {viewMode === 'day' ? (
        /* 日別タイムラインビュー */
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-sub">スケジュールを読み込んでいます...</div>
          ) : targetStaffList.length === 0 ? (
            <div className="p-12 text-center text-xs text-sub">スタッフ情報が登録されていません。</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* テーブルヘッダー：スタッフ名列 */}
                <div
                  className="grid border-b border-border bg-slate-50 text-xs font-bold text-main sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: `70px repeat(${targetStaffList.length}, minmax(180px, 1fr))`,
                  }}
                >
                  <div className="p-3 text-center border-r border-border text-sub flex items-center justify-center font-bold">
                    時間
                  </div>
                  {targetStaffList.map((staff) => {
                    const role = getRoleInfo(staff.role)
                    return (
                      <div
                        key={staff.id}
                        className="p-3 border-r border-border last:border-r-0 flex flex-col items-center justify-center space-y-1"
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm text-slate-900">{staff.display_name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border ${role.style}`}>
                            {role.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          本日: {daySchedules.filter((s) => s.profile_id === staff.id).length}件の予定
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* タイムライン本体 */}
                <div
                  className="grid relative"
                  style={{
                    gridTemplateColumns: `70px repeat(${targetStaffList.length}, minmax(180px, 1fr))`,
                    height: `${HOURS.length * 68}px`,
                  }}
                >
                  {/* 左列：時間軸ラベル */}
                  <div className="border-r border-border bg-slate-50/50 flex flex-col justify-between text-[11px] font-semibold text-slate-500 select-none">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-[68px] border-b border-border/70 p-1.5 text-right pr-2 relative"
                      >
                        <span>{hour}:00</span>
                      </div>
                    ))}
                  </div>

                  {/* スタッフごとの列（グリッド枠 ＆ 予定カード） */}
                  {targetStaffList.map((staff) => {
                    const staffDaySchedules = daySchedules.filter((s) => s.profile_id === staff.id)

                    return (
                      <div
                        key={staff.id}
                        className="relative border-r border-border last:border-r-0 h-full bg-white select-none"
                      >
                        {/* 1時間ごとのクリック可能な空き枠スロット */}
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            onClick={() => handleSlotClick(staff.id, hour)}
                            className="h-[68px] border-b border-border/60 hover:bg-amber-50/40 cursor-pointer transition-colors relative group"
                            title={`${staff.display_name} ${hour}:00〜 空き枠（クリックで見積訪問予約）`}
                          >
                            {/* 30分の補助点線 */}
                            <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-slate-100" />
                            <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                見積予約を入れる
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* 予定カードの絶対配置 */}
                        {staffDaySchedules.map((item) => {
                          const style = getScheduleStyle(item.start_time, item.end_time)
                          const meta = SCHEDULE_TYPE_LABELS[item.schedule_type] || SCHEDULE_TYPE_LABELS.other

                          const startStr = item.start_time.split('T')[1]?.slice(0, 5) || ''
                          const endStr = item.end_time.split('T')[1]?.slice(0, 5) || ''

                          return (
                            <div
                              key={item.id}
                              style={style}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSchedule(item)
                              }}
                              className={`absolute left-1 right-1 p-2 rounded-lg border shadow-sm transition-all cursor-pointer z-10 overflow-hidden flex flex-col justify-between ${meta.cardClass}`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-extrabold flex items-center gap-1 tracking-tight">
                                    <Clock className="w-3 h-3 flex-shrink-0" />
                                    <span>
                                      {startStr} - {endStr}
                                    </span>
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${meta.badgeClass}`}
                                  >
                                    {meta.label}
                                  </span>
                                </div>

                                <div className="font-bold text-xs leading-tight line-clamp-2">
                                  {item.title}
                                </div>

                                {item.customer_name && (
                                  <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 truncate">
                                    <User className="w-3 h-3 flex-shrink-0 text-slate-500" />
                                    <span className="truncate">{item.customer_name} 様</span>
                                  </div>
                                )}

                                {item.location && (
                                  <div className="text-[10px] text-slate-600 flex items-center gap-1 truncate">
                                    <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                    <span className="truncate">{item.location}</span>
                                  </div>
                                )}
                              </div>

                              {/* モバイル・現場直結アクションアイコン */}
                              <div className="pt-1 flex items-center justify-between border-t border-black/5 mt-1">
                                <div className="flex items-center space-x-1.5 text-[10px]">
                                  {item.customer_phone && (
                                    <a
                                      href={`tel:${item.customer_phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 rounded bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                                      title="電話をかける"
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                  )}
                                  {item.location && (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                        item.location
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 rounded bg-white text-blue-700 hover:bg-blue-50 border border-blue-200"
                                      title="Google マップで経路を開く"
                                    >
                                      <MapPin className="w-3 h-3" />
                                    </a>
                                  )}
                                  {item.job_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveJobDetailId(item.job_id!)
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 font-bold"
                                      title="案件詳細を開く"
                                    >
                                      案件
                                    </button>
                                  )}
                                </div>

                                <span className="text-[9px] text-slate-500">詳細 &gt;</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 週間カレンダービュー */
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden p-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayItems = schedules.filter((s) => {
                const sDate = s.start_time.split('T')[0]
                if (sDate !== day.dateStr) return false
                if (selectedStaffFilter !== 'all' && s.profile_id !== selectedStaffFilter) return false
                return true
              })

              return (
                <div
                  key={day.dateStr}
                  className={`border rounded-xl p-3 min-h-[380px] flex flex-col space-y-2 transition-colors ${
                    day.isSelected
                      ? 'bg-amber-50/30 border-amber-400'
                      : day.isToday
                      ? 'bg-blue-50/20 border-blue-300'
                      : 'bg-white border-border'
                  }`}
                >
                  {/* 日付ヘッダー */}
                  <div
                    onClick={() => {
                      setSelectedDate(day.dateStr)
                      setViewMode('day')
                    }}
                    className="flex items-center justify-between pb-2 border-b border-border cursor-pointer group"
                    title="この日の日別タイムラインを開く"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-sm text-main group-hover:text-amber-600 transition-colors">
                        {day.dayNum}日 ({day.dayName})
                      </span>
                      {day.isToday && (
                        <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded">
                          今日
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-sub font-semibold">
                      {dayItems.length}件
                    </span>
                  </div>

                  {/* 予定一覧 */}
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {dayItems.length === 0 ? (
                      <div
                        onClick={() => handleSlotClick(targetStaffList[0]?.id || '', 10, day.dateStr)}
                        className="h-24 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/30 cursor-pointer transition-colors p-2 text-center"
                      >
                        <Plus className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">＋ 予約を追加</span>
                      </div>
                    ) : (
                      dayItems.map((item) => {
                        const meta = SCHEDULE_TYPE_LABELS[item.schedule_type] || SCHEDULE_TYPE_LABELS.other
                        const startStr = item.start_time.split('T')[1]?.slice(0, 5) || ''
                        const staff = profiles.find((p) => p.id === item.profile_id)

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedSchedule(item)}
                            className={`p-2 rounded-lg border shadow-2xs cursor-pointer transition-all ${meta.cardClass}`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span>{startStr}</span>
                              <span className="truncate max-w-[80px] text-slate-500">
                                {staff?.display_name || ''}
                              </span>
                            </div>
                            <div className="font-bold text-xs line-clamp-2 mt-0.5">
                              {item.title}
                            </div>
                            {item.customer_name && (
                              <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                {item.customer_name} 様
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. 予定詳細ポップオーバー / モーダル */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="space-y-1">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    SCHEDULE_TYPE_LABELS[selectedSchedule.schedule_type]?.badgeClass || ''
                  }`}
                >
                  {SCHEDULE_TYPE_LABELS[selectedSchedule.schedule_type]?.label || '予定'}
                </span>
                <h2 className="text-base font-bold text-main">{selectedSchedule.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchedule(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-700">
                <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="font-semibold">
                  {selectedSchedule.start_time.split('T')[0]} (
                  {selectedSchedule.start_time.split('T')[1]?.slice(0, 5)} 〜{' '}
                  {selectedSchedule.end_time.split('T')[1]?.slice(0, 5)})
                </span>
              </div>

              <div className="flex items-center space-x-2 text-slate-700">
                <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>
                  担当者: <strong className="text-slate-900">{selectedSchedule.profiles?.display_name || '未設定'}</strong>
                </span>
              </div>

              {selectedSchedule.customer_name && (
                <div className="flex items-center space-x-2 text-slate-700">
                  <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>
                    お客様: <strong className="text-slate-900">{selectedSchedule.customer_name} 様</strong>
                  </span>
                </div>
              )}

              {selectedSchedule.customer_phone && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-bold text-slate-900">{selectedSchedule.customer_phone}</span>
                  </div>
                  <a
                    href={`tel:${selectedSchedule.customer_phone}`}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>発信</span>
                  </a>
                </div>
              )}

              {selectedSchedule.location && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="truncate text-slate-900">{selectedSchedule.location}</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedSchedule.location
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>ルート案内</span>
                  </a>
                </div>
              )}

              {selectedSchedule.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap">
                  <div className="text-[10px] font-bold text-slate-500 mb-1">品目・メモ:</div>
                  {selectedSchedule.notes}
                </div>
              )}

              {selectedSchedule.job_id && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full text-xs font-bold"
                    onClick={() => {
                      const jobId = selectedSchedule.job_id!
                      setSelectedSchedule(null)
                      setActiveJobDetailId(jobId)
                    }}
                  >
                    <Briefcase className="w-4 h-4 mr-1" />
                    連動する案件詳細（ステータス・見積・サイン）を開く
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (confirm(`予定「${selectedSchedule.title}」を削除してもよろしいですか？`)) {
                    await deleteSchedule(selectedSchedule.id)
                    setSelectedSchedule(null)
                  }
                }}
                className="text-rose-600 hover:bg-rose-50 border-rose-200 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                削除
              </Button>

              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedSchedule(null)}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 空き枠クリックからの「即時見積訪問予約」モーダル */}
      {isAppointmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleSaveAppointment}
            className="bg-white w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-main">見積訪問予約（電話受付対応）</h2>
                  <p className="text-[11px] text-sub">
                    営業のスケジュール枠を確保し、案件（jobs）も同時に登録します
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAppointmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-main mb-1">担当営業 *</label>
                  <select
                    value={appointmentForm.profileId}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, profileId: e.target.value })}
                    required
                    className="w-full p-2 border border-border rounded-lg text-xs bg-white text-main font-semibold focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">担当者を選択...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({getRoleInfo(p.role).label})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-main mb-1">予約日・時間帯 *</label>
                  <div className="flex items-center space-x-1">
                    <Input
                      type="time"
                      value={appointmentForm.startTime.split('T')[1]?.slice(0, 5) || '10:00'}
                      onChange={(e) => {
                        const dateOnly = appointmentForm.startTime.split('T')[0] || selectedDate
                        setAppointmentForm({
                          ...appointmentForm,
                          startTime: `${dateOnly}T${e.target.value}:00+09:00`,
                        })
                      }}
                      required
                    />
                    <span className="text-slate-400">〜</span>
                    <Input
                      type="time"
                      value={appointmentForm.endTime.split('T')[1]?.slice(0, 5) || '11:00'}
                      onChange={(e) => {
                        const dateOnly = appointmentForm.endTime.split('T')[0] || selectedDate
                        setAppointmentForm({
                          ...appointmentForm,
                          endTime: `${dateOnly}T${e.target.value}:00+09:00`,
                        })
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-main mb-1">お客様氏名 / 会社名 *</label>
                <Input
                  type="text"
                  placeholder="例: 山田 太郎 様"
                  value={appointmentForm.customerName}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, customerName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-main mb-1">電話番号（連絡先）</label>
                  <Input
                    type="tel"
                    placeholder="例: 090-1234-5678"
                    value={appointmentForm.customerPhone || ''}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, customerPhone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block font-bold text-main mb-1">予定タイトル（任意）</label>
                  <Input
                    type="text"
                    placeholder="未入力時は「顧客名＋見積訪問」"
                    value={appointmentForm.title}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-main mb-1">訪問先住所</label>
                <Input
                  type="text"
                  placeholder="例: 山鹿市鹿校通2-1-10"
                  value={appointmentForm.customerAddress || ''}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, customerAddress: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-main mb-1">品目メモ・ご要望・状況</label>
                <textarea
                  rows={3}
                  placeholder="例: 2階からのタンス搬出、軽トラ1台分、見積もり希望日時の候補など"
                  value={appointmentForm.notes || ''}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                  className="w-full p-2 border border-border rounded-lg text-xs bg-white text-main focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="createJobCheckbox"
                  checked={appointmentForm.createJob}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, createJob: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="createJobCheckbox" className="text-xs font-semibold text-amber-900 cursor-pointer">
                  同時に案件（ステータス: 顧客検討・見積対応）を作成して連動する（推奨）
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAppointmentModalOpen(false)}>
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <CalendarCheck className="w-4 h-4 mr-1 text-amber-200" />
                予約を確定・保存する
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 6. 外出・打合せ・私用 登録モーダル */}
      {isSimpleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleSaveSimpleSchedule}
            className="bg-white w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-main">予定の追加（外出・打合せ等）</h2>
              <button
                type="button"
                onClick={() => setIsSimpleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-main mb-1">対象スタッフ *</label>
                <select
                  value={simpleForm.profileId}
                  onChange={(e) => setSimpleForm({ ...simpleForm, profileId: e.target.value })}
                  required
                  className="w-full p-2 border border-border rounded-lg text-xs bg-white text-main font-semibold focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">スタッフを選択...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({getRoleInfo(p.role).label})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-main mb-1">予定区分 *</label>
                <select
                  value={simpleForm.scheduleType}
                  onChange={(e) => setSimpleForm({ ...simpleForm, scheduleType: e.target.value as ScheduleType })}
                  className="w-full p-2 border border-border rounded-lg text-xs bg-white text-main font-semibold focus:ring-2 focus:ring-slate-900"
                >
                  <option value="away">外出・移動</option>
                  <option value="meeting">打合せ・会議</option>
                  <option value="work">現場作業・立会い</option>
                  <option value="private">休暇・私用</option>
                  <option value="other">その他</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-main mb-1">予定タイトル *</label>
                <Input
                  type="text"
                  placeholder="例: 市役所手続き、車両点検、社内打合せ"
                  value={simpleForm.title}
                  onChange={(e) => setSimpleForm({ ...simpleForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-main mb-1">開始時刻</label>
                  <Input
                    type="time"
                    value={simpleForm.startHour}
                    onChange={(e) => setSimpleForm({ ...simpleForm, startHour: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-main mb-1">終了時刻</label>
                  <Input
                    type="time"
                    value={simpleForm.endHour}
                    onChange={(e) => setSimpleForm({ ...simpleForm, endHour: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-main mb-1">場所</label>
                <Input
                  type="text"
                  placeholder="例: 山鹿市役所、本社2F"
                  value={simpleForm.location}
                  onChange={(e) => setSimpleForm({ ...simpleForm, location: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold text-main mb-1">メモ</label>
                <textarea
                  rows={2}
                  placeholder="備考など"
                  value={simpleForm.notes}
                  onChange={(e) => setSimpleForm({ ...simpleForm, notes: e.target.value })}
                  className="w-full p-2 border border-border rounded-lg text-xs bg-white text-main focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsSimpleModalOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" variant="primary" size="sm" className="font-bold">
                保存する
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 7. 連動案件詳細モーダル（TaskDetailModal） */}
      {activeJob && (
        <TaskDetailModal
          task={{
            id: activeJob.id,
            customer: activeJob.customers?.name || '名称未設定',
            tel: activeJob.customers?.phone || '',
            address: activeJob.customers?.address || '',
            taskType: activeJob.title || '見積訪問案件',
            status: mapJobStatusToLane(activeJob.status),
            receptionDate: activeJob.scheduled_date || activeJob.created_at.split('T')[0],
            assignedTo: activeJob.assigned_to || '',
            updatedAt: activeJob.updated_at || activeJob.created_at,
          }}
          isOpen={true}
          onClose={() => setActiveJobDetailId(null)}
          onSave={async (updated) => {
            await updateJobDetails(updated.id, {
              title: updated.taskType,
              assigned_to: updated.assignedTo || null,
            })
            setActiveJobDetailId(null)
          }}

          onDelete={async (taskId) => {
            if (confirm('案件を削除してもよろしいですか？')) {
              await supabase.from('jobs').delete().eq('id', taskId)
              setActiveJobDetailId(null)
            }
          }}
          onPrint={() => {
            window.print()
          }}
        />
      )}
    </div>
  )
}


export default Schedule
