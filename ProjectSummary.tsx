'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Image as ImageIcon, Music, Table, File } from 'lucide-react'
import { JACKSON } from '@/lib/mock-data'
import type { FileType, UploadedFile } from '@/lib/mock-data'
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage'

const FILE_ICONS: Record<FileType, { icon: typeof File; color: string }> = {
  pdf: { icon: FileText, color: 'text-red-400' },
  image: { icon: ImageIcon, color: 'text-blue-400' },
  audio: { icon: Music, color: 'text-purple-400' },
  csv: { icon: Table, color: 'text-green-400' },
  text: { icon: FileText, color: 'text-zinc-400' },
}

const CATEGORIES = ['All', 'Health', 'Fitness', 'Nutrition', 'Finance', 'Projects']

function detectType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image'
  if (['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) return 'audio'
  if (ext === 'csv') return 'csv'
  return 'text'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

export default function UploadsPage() {
  const [dragging, setDragging] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeCategoryRef = useRef(activeCategory)

  useEffect(() => {
    activeCategoryRef.current = activeCategory
  }, [activeCategory])

  useEffect(() => {
    const saved = getStorage<UploadedFile[]>(STORAGE_KEYS.UPLOAD_HISTORY, [])
    setUploads(saved.length > 0 ? saved : JACKSON.uploads)
  }, [])

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const now = new Date().toISOString()
    const category = activeCategoryRef.current === 'All' ? 'General' : activeCategoryRef.current

    const newEntries: UploadedFile[] = []
    for (const f of Array.from(fileList)) {
      const type = detectType(f.name)
      let previewDataUrl: string | undefined
      if (type === 'image' && f.size < 1_048_576) {
        try {
          previewDataUrl = await readFileAsDataURL(f)
        } catch {
          // no preview for this file
        }
      }
      newEntries.push({
        id: crypto.randomUUID(),
        name: f.name,
        type,
        size: formatSize(f.size),
        uploadedAt: fmtDate(now),
        category,
        previewDataUrl,
      })
    }

    setUploads((prev) => {
      const updated = [...newEntries, ...prev]
      try {
        setStorage(STORAGE_KEYS.UPLOAD_HISTORY, updated)
      } catch {
        // localStorage full — save without previews
        const stripped = updated.map(({ previewDataUrl: _, ...rest }) => rest)
        setStorage(STORAGE_KEYS.UPLOAD_HISTORY, stripped)
      }
      return updated
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const filtered =
    activeCategory === 'All'
      ? uploads
      : uploads.filter((f) => f.category === activeCategory)

  return (
    <div className="pb-4">
      <div className="px-4 pt-7 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-600">Knowledge Base</p>
        <h1 className="text-2xl font-semibold text-white mt-1 tracking-tight">Upload Center</h1>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mx-4 rounded-2xl border-2 border-dashed p-8 flex flex-col items-center gap-3 transition-all duration-200 ${
          dragging
            ? 'border-blue-500/60 bg-blue-500/5'
            : 'border-white/10 bg-[#0f0f0f]'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 ${
            dragging ? 'bg-blue-500/15' : 'bg-white/5'
          }`}
        >
          <Upload size={22} className={dragging ? 'text-blue-400' : 'text-zinc-600'} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white">
            {dragging ? 'Drop to upload' : 'Drop files here'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">PDF, image, audio, CSV, text · Images under 1MB get preview</p>
        </div>
        <label className="mt-1 cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.mp3,.m4a,.wav,.csv,.txt,.md"
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors border border-blue-500/30 rounded-lg px-3 py-1.5">
            Browse files
          </span>
        </label>
      </div>

      {/* Category filter */}
      <div className="mt-4 px-4 flex gap-2 no-scrollbar overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all duration-150 ${
              activeCategory === cat
                ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                : 'border-white/10 text-zinc-600 bg-[#111]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Upload history */}
      <div className="mx-4 mt-3 rounded-2xl bg-[#111] border border-white/10 overflow-hidden card-elevated">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
            {filtered.length} file{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-zinc-600">No files in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filtered.map((file) => {
              const { icon: Icon, color } = FILE_ICONS[file.type]
              return (
                <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {file.previewDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.previewDataUrl} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon size={16} className={color} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{file.name}</p>
                    <p className="text-[9px] text-zinc-700 mt-0.5 font-mono">
                      {file.category} · {file.size} · {file.uploadedAt}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="mx-4 mt-3 text-[9px] text-zinc-700 font-mono leading-relaxed">
        Stored locally in browser. Image previews survive refresh for files under 1MB.
      </p>
    </div>
  )
}
