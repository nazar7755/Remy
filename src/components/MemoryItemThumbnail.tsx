import { useEffect, useRef, useState } from 'react'
import { getImageDisplayUrl } from '../lib/imageSrc'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles.tsx'
import { isImageFile, type MemoryItem } from '../types/memoryItem'

interface MemoryItemThumbnailProps {
  item: MemoryItem
  /** Tailwind size classes for the 64×64 box (default `h-16 w-16`). */
  className?: string
  iconClassName?: string
}

export function MemoryItemThumbnail({
  item,
  className = 'h-16 w-16',
  iconClassName = 'h-4 w-4',
}: MemoryItemThumbnailProps) {
  const style = memoryItemTypeStyles[item.type]
  const showImage = isImageFile(item)
  const imageUrl = showImage
    ? getImageDisplayUrl(item.filePath, item.extension)
    : null

  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!imageUrl) return
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [imageUrl])

  const showThumbnail = Boolean(imageUrl && inView && !loadFailed)

  return (
    <div
      ref={containerRef}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-remy-border bg-remy-elevated text-remy-subtle transition-colors group-hover:border-zinc-600 group-hover:text-remy-text ${className}`}
      aria-hidden
    >
      {showThumbnail ? (
        <img
          src={imageUrl}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <svg
          className={iconClassName}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          {style.icon}
        </svg>
      )}
    </div>
  )
}
