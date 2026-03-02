import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'block w-full px-3 py-2 border rounded-lg text-sm',
            'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            error ? 'border-red-300 bg-red-50' : 'border-gray-300',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
