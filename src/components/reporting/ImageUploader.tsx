'use client';

import React, { useRef, useState } from 'react';
import { Camera, UploadCloud, X, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImageUploaderProps {
  imageFiles?: File[];
  onFilesChange?: (files: File[]) => void;
  images?: string[];
  onChange?: (images: string[]) => void;
  maxImages?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageFiles = [],
  onFilesChange,
  images = [],
  onChange,
  maxImages = 4,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const validNewFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ALLOWED_MIME.includes(file.type)) {
        setErrorMsg('Invalid format: Only JPEG, PNG, or WebP images are permitted.');
        continue;
      }
      if (file.size <= 0 || file.size > MAX_SIZE) {
        setErrorMsg('File too large: Image exceeds the 5MB institutional limit.');
        continue;
      }
      validNewFiles.push(file);
    }

    const currentTotal = (imageFiles?.length || 0) + (images?.length || 0);
    if (currentTotal + validNewFiles.length > maxImages) {
      setErrorMsg(`Maximum of ${maxImages} evidence photos allowed per ticket.`);
      return;
    }

    if (onFilesChange) {
      onFilesChange([...(imageFiles || []), ...validNewFiles]);
    }

    // Also populate legacy base64 if consumer uses onChange
    if (onChange) {
      validNewFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            onChange([...(images || []), e.target.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    if (onFilesChange && imageFiles) {
      const updated = imageFiles.filter((_, i) => i !== index);
      onFilesChange(updated);
    }
    if (onChange && images) {
      const updated = images.filter((_, i) => i !== index);
      onChange(updated);
    }
  };

  const totalCount = (imageFiles?.length || 0) + (images?.length || 0);

  return (
    <div className="space-y-4">
      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-maroon-700 bg-maroon-50/50'
            : 'border-warm-300 hover:border-maroon-400 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-warm-200 flex items-center justify-center text-maroon-800">
            <UploadCloud className="w-6 h-6 stroke-[1.75]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">
              Tap to take photo or upload evidence
            </p>
            <p className="text-xs text-ink-muted">
              JPG, PNG, or WebP up to 5MB (Max {maxImages} files • Stored in Supabase Storage)
            </p>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-maroon-800 bg-maroon-50 px-2.5 py-1 rounded border border-maroon-200 font-medium">
              <Camera className="w-3.5 h-3.5" />
              Camera / File Library
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Real File Previews with upload readiness badges */}
      {imageFiles && imageFiles.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider block">
            Selected Evidence Files ({imageFiles.length}/{maxImages})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {imageFiles.map((file, idx) => {
              const previewUrl = URL.createObjectURL(file);
              const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-warm-300 bg-white shadow-subtle relative group"
                >
                  <div className="w-14 h-14 rounded overflow-hidden bg-warm-100 shrink-0 border border-warm-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-medium text-ink truncate">{file.name}</p>
                    <p className="text-[11px] text-ink-muted">{sizeMb} MB • {file.type.split('/')[1]?.toUpperCase()}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold mt-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Validated for Supabase Storage
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-warm-200 hover:bg-rose-100 hover:text-rose-700 text-ink-muted flex items-center justify-center transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback previews for existing URL strings */}
      {(!imageFiles || imageFiles.length === 0) && images && images.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider block">
            Attached Evidence ({images.length}/{maxImages})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((imgUrl, idx) => (
              <div
                key={idx}
                className="relative aspect-video rounded-md overflow-hidden border border-warm-300 bg-warm-100 group shadow-subtle"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt={`Evidence photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-700 transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

