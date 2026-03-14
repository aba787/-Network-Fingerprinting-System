import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Search, Activity, Shield, ArrowUpDown, ServerCrash } from 'lucide-react'
import { useAnalyzePcap } from '@workspace/api-client-react'
import type { PacketFeature, AnalyzeResult } from '@workspace/api-client-react'

import { FileUpload } from '@/components/FileUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getProtocolName } from '@/lib/utils'

type SortConfig = {
  key: keyof PacketFeature
  direction: 'asc' | 'desc'
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [ipFilter, setIpFilter] = useState("")
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  
  const analyzeMutation = useAnalyzePcap()

  const handleAnalyze = () => {
    if (!file) return
    analyzeMutation.mutate({ data: { file } })
  }

  const result = analyzeMutation.data as AnalyzeResult | undefined

  const filteredData = useMemo(() => {
    if (!result?.features) return []
    if (!ipFilter) return result.features

    const query = ipFilter.toLowerCase()
    return result.features.filter(f => 
      f.src_ip.toLowerCase().includes(query) || 
      f.dst_ip.toLowerCase().includes(query)
    )
  }, [result, ipFilter])

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortConfig])

  const handleSort = (key: keyof PacketFeature) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' }
        return null // reset sort
      }
      return { key, direction: 'asc' }
    })
  }

  const exportCSV = () => {
    if (!sortedData.length) return

    const headers = ["Source IP", "Destination IP", "Packet Size (Bytes)", "TTL", "Protocol", "Time Delta (s)"]
    const csvRows = sortedData.map(f => 
      `${f.src_ip},${f.dst_ip},${f.packet_size},${f.ttl},${getProtocolName(f.protocol)},${f.time_delta}`
    )
    
    const csvContent = [headers.join(","), ...csvRows].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "features.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const getProtocolBadgeVariant = (proto: number) => {
    if (proto === 6) return 'tcp'
    if (proto === 17) return 'udp'
    if (proto === 1) return 'icmp'
    return 'outline'
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section with generated image background */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/cyber-bg.png`} 
            alt="Cybersecurity background" 
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6 backdrop-blur-sm">
              <Shield className="w-4 h-4" />
              <span>Security Analysis Module</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold font-display tracking-tight text-foreground mb-6 drop-shadow-xl">
              Network <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Fingerprinting</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload packet capture files to extract behavioral features. Analyze source/destination pairs, protocols, and temporal patterns to build device profiles.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Upload & Action Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass-panel p-6 md:p-8 rounded-3xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <FileUpload 
                onFileSelect={setFile} 
                isAnalyzing={analyzeMutation.isPending} 
              />
            </div>
            <div className="flex flex-col justify-center space-y-6">
              <div className="space-y-2">
                <h3 className="font-display text-xl font-bold text-foreground">Analysis Engine</h3>
                <p className="text-sm text-muted-foreground">Extracts spatial and temporal features per packet for downstream machine learning tasks.</p>
              </div>
              <Button 
                variant="cyber" 
                size="lg" 
                className="w-full"
                disabled={!file || analyzeMutation.isPending}
                onClick={handleAnalyze}
              >
                {analyzeMutation.isPending ? "Processing Data..." : "Run Analysis"}
              </Button>
              {analyzeMutation.isError && (
                <div className="text-sm text-destructive flex items-start gap-2 bg-destructive/10 p-3 rounded-lg">
                  <ServerCrash className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{analyzeMutation.error?.message || "Failed to analyze file. Ensure it is a valid pcap/pcapng."}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Stats & Filters Bar */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center bg-card/40 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Total Packets</span>
                    <span className="text-2xl font-mono text-foreground">{result.total_packets.toLocaleString()}</span>
                  </div>
                  <div className="h-10 w-px bg-border/50" />
                  <div className="flex flex-col">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Showing</span>
                    <span className="text-2xl font-mono text-primary">{filteredData.length.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Filter IP address..." 
                      className="pl-9 w-full sm:w-64 font-mono text-xs h-10"
                      value={ipFilter}
                      onChange={(e) => setIpFilter(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={exportCSV}
                    disabled={filteredData.length === 0}
                    className="gap-2 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Data Table */}
              <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[180px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('src_ip')}>
                        <div className="flex items-center gap-2">Source IP <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead className="w-[180px] cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('dst_ip')}>
                        <div className="flex items-center gap-2">Destination IP <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('packet_size')}>
                        <div className="flex items-center justify-end gap-2"><ArrowUpDown className="w-3 h-3" /> Size (Bytes)</div>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('ttl')}>
                        <div className="flex items-center justify-end gap-2"><ArrowUpDown className="w-3 h-3" /> TTL</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('protocol')}>
                        <div className="flex items-center gap-2">Protocol <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('time_delta')}>
                        <div className="flex items-center justify-end gap-2"><ArrowUpDown className="w-3 h-3" /> Δ Time (s)</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-mono text-xs">
                    {sortedData.length > 0 ? (
                      sortedData.slice(0, 100).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-foreground">{row.src_ip}</TableCell>
                          <TableCell className="text-muted-foreground">{row.dst_ip}</TableCell>
                          <TableCell className="text-right text-emerald-400/90">{row.packet_size}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{row.ttl}</TableCell>
                          <TableCell>
                            <Badge variant={getProtocolBadgeVariant(row.protocol)}>
                              {getProtocolName(row.protocol)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-cyan-400/90">{row.time_delta.toFixed(6)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Activity className="w-6 h-6 text-muted-foreground/50" />
                            <p>No packets match the current filter.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {sortedData.length > 100 && (
                  <div className="p-3 text-center border-t border-border/50 bg-secondary/20 text-xs text-muted-foreground">
                    Showing first 100 rows. Export to CSV to see all {filteredData.length} records.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
