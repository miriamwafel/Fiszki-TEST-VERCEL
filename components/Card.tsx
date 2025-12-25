'use client'

import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white rounded-xl shadow-sm border border-gray-100 transition-shadow duration-200',
      interactive:
        'bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
    }

    return (
      <div
        ref={ref}
        className={`${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
