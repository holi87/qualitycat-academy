import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from "react";

interface FileUploadProps {
  accept?: string;
  maxSizeMb?: number;
  onFileSelect: (file: File) => void;
  preview?: string | null;
  onRemove?: () => void;
}

export function FileUpload({
  accept,
  maxSizeMb = 5,
  onFileSelect,
  preview,
  onRemove,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      const maxBytes = maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File size exceeds ${maxSizeMb}MB limit`);
        return;
      }
      onFileSelect(file);
    },
    [maxSizeMb, onFileSelect]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSelect(file);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        className="file-upload__input"
        data-testid="file-upload-input"
        type="file"
        accept={accept}
        onChange={handleChange}
        hidden
      />

      {preview ? (
        <div className="file-upload__preview-wrapper">
          <img
            className="file-upload__preview"
            data-testid="file-upload-preview"
            src={preview}
            alt="File preview"
          />
          {onRemove && (
            <button
              className="file-upload__remove"
              data-testid="file-upload-remove"
              onClick={onRemove}
              type="button"
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        <div
          className={`file-upload__dropzone ${isDragging ? "file-upload__dropzone--active" : ""}`}
          data-testid="file-upload-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleClick();
            }
          }}
        >
          <p className="file-upload__label">
            Drag &amp; drop a file here, or click to browse
          </p>
          <p className="file-upload__hint">Max size: {maxSizeMb}MB</p>
        </div>
      )}

      {error && <p className="file-upload__error">{error}</p>}
    </div>
  );
}
