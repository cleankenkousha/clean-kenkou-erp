import React, { forwardRef } from 'react'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  requiredMark?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      requiredMark = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-main"
          >
            {label}
            {requiredMark && (
              <span className="text-semantic-error ml-1 font-bold">*</span>
            )}
          </label>
        )}

        <input
          id={inputId}
          ref={ref}
          className={`w-full bg-white border ${
            error ? 'border-semantic-error' : 'border-border'
          } rounded-md px-3 py-2 text-sm text-main placeholder-sub focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all ${className}`}
          {...props}
        />

        {error && <p className="text-xs text-semantic-error">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-sub">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
