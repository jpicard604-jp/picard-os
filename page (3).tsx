import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          borderRadius: '44px',
        }}
      >
        <span
          style={{
            fontSize: 112,
            fontWeight: 800,
            color: '#3b82f6',
            fontFamily: 'sans-serif',
            letterSpacing: '-6px',
            lineHeight: 1,
          }}
        >
          P
        </span>
      </div>
    ),
    { ...size }
  )
}
