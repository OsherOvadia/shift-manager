import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'default' | 'lg'
}

export function Logo({ className, size = 'default' }: LogoProps) {
  const dimensions = {
    sm: { width: 32, height: 32 },
    default: { width: 40, height: 40 },
    lg: { width: 48, height: 48 },
  }

  const { width, height } = dimensions[size]

  return (
    <div className={cn('relative', className)}>
      <Image
        src="/logo.svg"
        alt="Logo"
        width={width}
        height={height}
        className="object-contain"
        priority
      />
      {/* Fallback text for accessibility */}
      <span className="sr-only">מנהל משמרות</span>
    </div>
  )
}
