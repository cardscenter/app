"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({ images, onChange, maxImages = 10 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;

    const toUpload = fileArray.slice(0, remaining);
    setUploading(true);

    const formData = new FormData();
    toUpload.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls?.length) {
        onChange([...images, ...data.urls]);
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  }, [images, maxImages, onChange]);

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);

    // If dragging an existing image (reorder), don't upload
    if (dragIndex !== null) return;

    if (e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  // Reorder drag handlers
  function handleImageDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleImageDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  }

  function handleImageDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleImageDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="space-y-3">
      {/* Grid: thumbnail slot + image slots */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Thumbnail slot (first position) — shown when no images */}
        {images.length === 0 ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed transition-all ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Thumbnail
            </span>
          </label>
        ) : (
          /* Existing images with drag-to-reorder */
          images.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={(e) => handleImageDragStart(e, i)}
              onDragOver={(e) => handleImageDragOver(e, i)}
              onDrop={(e) => handleImageDrop(e, i)}
              onDragEnd={handleImageDragEnd}
              className={`group relative aspect-square overflow-hidden rounded-xl cursor-grab active:cursor-grabbing transition-all ${
                dragIndex === i ? "opacity-40 scale-95" : ""
              } ${dragOverIndex === i ? "ring-2 ring-primary ring-offset-2" : ""
              } ${i === 0 ? "ring-2 ring-primary/40" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
              {i === 0 && (
                <div className="absolute left-1.5 bottom-1.5 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Thumbnail
                </div>
              )}
            </div>
          ))
        )}

        {/* Upload button slot (if more images can be added) */}
        {images.length > 0 && images.length < maxImages && (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
            onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setDragOver(false); }}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed transition-all ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            } ${uploading ? "pointer-events-none opacity-50" : ""}`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="mt-1 text-sm text-muted-foreground">
              {uploading ? "..." : `${images.length}/${maxImages}`}
            </span>
          </label>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>JPG, PNG, WebP of GIF — max 5MB per foto</p>
        <p>Sleep foto&apos;s om de volgorde te wijzigen. De eerste foto wordt de thumbnail.</p>
      </div>
    </div>
  );
}
