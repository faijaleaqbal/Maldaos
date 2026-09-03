'use client';

import React, { useRef, useState } from 'react';
import { Camera, UploadCloud, X, Image as ImageIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onChange,
  maxImages = 4,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleEvidence = [
    {
      label: 'Sample AV/Projector Defect',
      url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    },
    {
      label: 'Sample Water Leakage',
      url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80',
    },
    {
      label: 'Sample Electrical Panel',
      url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
    },
  ];

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Only image files (JPG, PNG, WebP) are permitted for evidence.');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size exceeds 5MB limit. Please compress or take standard photo.');
        continue;
      }
      validFiles.push(file);
    }

    if (images.length + validFiles.length > maxImages) {
      setErrorMsg(`Maximum of ${maxImages} evidence photos allowed per ticket.`);
      return;
    }

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onChange([...images, e.target.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addSample = (url: string) => {
    if (images.length >= maxImages) {
      setErrorMsg(`Maximum ${maxImages} images already attached.`);
      return;
    }
    onChange([...images, url]);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
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
          accept="image/*"
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
              JPG, PNG, or WebP up to 5MB (Max {maxImages} files)
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

      {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

      {/* Previews */}
      {images.length > 0 && (
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
                    removeImage(idx);
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

      {/* Demo helper: Quick sample evidence insertion */}
      <div className="pt-2 border-t border-warm-200">
        <span className="text-[11px] text-ink-muted block mb-1.5 font-medium">
          Or attach a verified demonstration photo:
        </span>
        <div className="flex flex-wrap gap-2">
          {sampleEvidence.map((sample, i) => (
            <button
              key={i}
              type="button"
              onClick={() => addSample(sample.url)}
              className="text-[11px] bg-warm-100 hover:bg-warm-200 border border-warm-300 text-ink-muted hover:text-ink px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ImageIcon className="w-3 h-3 text-maroon-700" />
              <span>{sample.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
