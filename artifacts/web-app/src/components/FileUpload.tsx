import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, File, X, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, formatBytes } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File | null) => void
  isAnalyzing: boolean
}

export function FileUpload({ onFileSelect, isAnalyzing }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setError("Please upload a valid .pcap or .pcapng file.")
      return
    }
    if (acceptedFiles.length > 0) {
      setError(null)
      setSelectedFile(acceptedFiles[0])
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.tcpdump.pcap': ['.pcap'],
      'application/x-pcapng': ['.pcapng'],
      'application/octet-stream': ['.pcap', '.pcapng'] // Fallback for some OS
    },
    maxFiles: 1,
    disabled: isAnalyzing
  })

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
    onFileSelect(null)
    setError(null)
  }

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          "relative group overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out cursor-pointer",
          isDragActive ? "border-primary bg-primary/5 cyber-glow" : "border-border/60 hover:border-primary/50 bg-card/20 hover:bg-card/40",
          isAnalyzing && "opacity-50 cursor-not-allowed pointer-events-none",
          selectedFile && "border-primary/30 bg-card/40"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="p-10 flex flex-col items-center justify-center text-center relative z-10 min-h-[240px]">
          <AnimatePresence mode="wait">
            {!selectedFile ? (
              <motion.div
                key="upload-prompt"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center"
              >
                <div className={cn(
                  "p-4 rounded-full mb-4 transition-transform duration-300 group-hover:scale-110",
                  isDragActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                )}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-display mb-2 text-foreground">
                  {isDragActive ? "Drop packet capture here" : "Upload Packet Capture"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Drag and drop your <span className="text-primary/80 font-mono">.pcap</span> or <span className="text-primary/80 font-mono">.pcapng</span> file here, or click to browse.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center w-full max-w-sm"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 relative">
                  <File className="w-8 h-8 text-primary" />
                  {!isAnalyzing && (
                    <button
                      onClick={handleRemove}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-lg hover:scale-110 transition-transform"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h4 className="font-medium text-foreground truncate w-full px-4">{selectedFile.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{formatBytes(selectedFile.size)}</p>
                
                {isAnalyzing && (
                  <div className="w-full mt-6 space-y-2">
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
                      />
                    </div>
                    <p className="text-xs text-primary animate-pulse font-mono uppercase tracking-wider">Analyzing Packets...</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/20"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
