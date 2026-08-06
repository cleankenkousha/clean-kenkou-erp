import React, { createContext, useContext, useState, useEffect } from 'react'

export type ViewMode = 'pc' | 'mobile'

const STORAGE_KEY = 'clean_kenkou_view_mode'

interface ViewModeContextType {
  viewMode: ViewMode
  isMobileMode: boolean
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined)

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
    if (saved === 'pc' || saved === 'mobile') {
      return saved
    }
    return window.innerWidth < 768 ? 'mobile' : 'pc'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode)
  }, [viewMode])

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
  }

  const toggleViewMode = () => {
    setViewModeState((prev) => (prev === 'pc' ? 'mobile' : 'pc'))
  }

  const isMobileMode = viewMode === 'mobile'

  return (
    <ViewModeContext.Provider
      value={{
        viewMode,
        isMobileMode,
        setViewMode,
        toggleViewMode,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  const context = useContext(ViewModeContext)
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider')
  }
  return context
}
