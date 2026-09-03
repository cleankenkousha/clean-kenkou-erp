import React, { useRef, useState, useEffect, useCallback } from 'react'
import { X, RotateCcw, Check, PenTool } from 'lucide-react'
import { Button } from '../ui'

interface SignaturePadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signatureDataUrl: string) => void
  title?: string
  customerName?: string
  existingSignature?: string | null
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title = 'お客様サイン（電子署名）',
  customerName,
  existingSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // キャンバスの初期化（Retina・高解像度対応）
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a' // 濃いネイビーブラック
    ctx.lineWidth = 2.5

    // 既存のサインがあれば復元
    if (existingSignature) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
        setHasDrawn(true)
      }
      img.src = existingSignature
    } else {
      setHasDrawn(false)
    }
  }, [existingSignature])

  useEffect(() => {
    if (isOpen) {
      // モーダル表示のアニメーション完了後にキャンバスサイズを確定
      const timer = setTimeout(() => {
        initCanvas()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, initCanvas])

  // 描画座標の取得（タッチ・マウス両対応）
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 }
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  // 描画開始
  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      // スクロール防止
      e.preventDefault()
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasDrawn(true)
  }

  // 描画中
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    if ('touches' in e) {
      e.preventDefault()
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  // 描画終了
  const handleEnd = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.closePath()
    }
  }

  // キャンバスのクリア
  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setHasDrawn(false)
  }

  // サインの保存
  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    // PNG画像として出力
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              {customerName && (
                <p className="text-[11px] text-slate-500">ご依頼者様: {customerName} 様</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* サインエリア */}
        <div className="p-5 space-y-3">
          <div className="text-xs text-slate-600 flex items-center justify-between">
            <span>枠内に指先またはタッチペンでお名前をご記入ください</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {new Date().toLocaleDateString('ja-JP')}
            </span>
          </div>

          <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              className="w-full h-52 bg-white cursor-crosshair touch-none select-none block"
              style={{ touchAction: 'none' }}
            />

            {/* ガイドライン */}
            <div className="absolute inset-x-8 bottom-10 border-b border-slate-200 pointer-events-none flex justify-between text-[11px] text-slate-300">
              <span>署名欄</span>
              <span>×</span>
            </div>

            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs">
                ここにサインをご記入ください
              </div>
            )}
          </div>
        </div>

        {/* フッター操作ボタン */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!hasDrawn}
            className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            書き直す（クリア）
          </Button>

          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!hasDrawn}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Check className="w-4 h-4 mr-1" />
              サインを確定する
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
