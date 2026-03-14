import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Search, Activity, Shield, ArrowUpDown, ServerCrash,
  Database, GitCompare, Layers
} from 'lucide-react'
import {
  useAnalyzePcap,
  useSaveBaseline,
  useListBaselines,
  useDeleteBaseline,
  useCompareFingerprint,
} from '@workspace/api-client-react'
import type { PacketFeature, AnalyzeResult } from '@workspace/api-client-react'
import { useQueryClient } from '@tanstack/react-query'

import { FileUpload } from '@/components/FileUpload'
import { FingerprintCard } from '@/components/FingerprintCard'
import { DetectionCard } from '@/components/DetectionCard'
import { BaselinesPanel } from '@/components/BaselinesPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { DeviceFingerprint } from '@workspace/api-client-react'
import { getProtocolName } from '@/lib/utils'

type SortConfig = {
  key: keyof PacketFeature
  direction: 'asc' | 'desc'
}

export default function Home() {
  const queryClient = useQueryClient()

  const [analyzeFile, setAnalyzeFile] = useState<File | null>(null)
  const [compareFile, setCompareFile] = useState<File | null>(null)
  const [ipFilter, setIpFilter] = useState("")
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [savingIp, setSavingIp] = useState<string | null>(null)
  const [savedIps, setSavedIps] = useState<Set<string>>(new Set())

  const analyzeMutation = useAnalyzePcap()
  const compareMutation = useCompareFingerprint()
  const saveBaselineMutation = useSaveBaseline()
  const deleteBaselineMutation = useDeleteBaseline()
  const { data: baselines = [], refetch: refetchBaselines } = useListBaselines()

  const handleAnalyze = () => {
    if (!analyzeFile) return
    analyzeMutation.mutate({ data: { file: analyzeFile } })
  }

  const handleCompare = () => {
    if (!compareFile) return
    compareMutation.mutate({ data: { file: compareFile } })
  }

  const handleSaveBaseline = async (fingerprint: DeviceFingerprint, label: string) => {
    setSavingIp(fingerprint.ip)
    try {
      await saveBaselineMutation.mutateAsync({ data: { ip: fingerprint.ip, label, fingerprint } })
      setSavedIps(prev => new Set([...prev, fingerprint.ip]))
      await refetchBaselines()
    } finally {
      setSavingIp(null)
    }
  }

  const handleDeleteBaseline = (id: number) => {
    deleteBaselineMutation.mutate({ id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['listBaselines'] })
        void refetchBaselines()
      },
    })
  }

  const analyzeResult = analyzeMutation.data as AnalyzeResult | undefined

  const filteredData = useMemo(() => {
    if (!analyzeResult?.features) return []
    if (!ipFilter) return analyzeResult.features
    const query = ipFilter.toLowerCase()
    return analyzeResult.features.filter(f =>
      f.src_ip.toLowerCase().includes(query) ||
      f.dst_ip.toLowerCase().includes(query)
    )
  }, [analyzeResult, ipFilter])

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
        return null
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
      {/* Hero */}
      <section className="relative pt-24 pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/cyber-bg.png`}
            alt="Cybersecurity background"
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6 backdrop-blur-sm">
              <Shield className="w-4 h-4" />
              <span>Network Fingerprinting System</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold font-display tracking-tight text-foreground mb-6 drop-shadow-xl">
              Network <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Fingerprinting</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Build device profiles, save behavioral baselines, and detect anomalies or spoofing from packet capture files.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="analyze" className="space-y-6">
          <TabsList className="h-11 gap-1 bg-card/60 border border-border/50 backdrop-blur-sm p-1">
            <TabsTrigger value="analyze" className="gap-2 data-[state=active]:text-primary">
              <Layers className="w-4 h-4" /> Analyze
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2 data-[state=active]:text-primary">
              <GitCompare className="w-4 h-4" /> Compare
            </TabsTrigger>
            <TabsTrigger value="baselines" className="gap-2 data-[state=active]:text-primary">
              <Database className="w-4 h-4" /> Baselines
              {baselines.length > 0 && (
                <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{baselines.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── ANALYZE TAB ─────────────────────────────────────── */}
          <TabsContent value="analyze" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-6 md:p-8 rounded-3xl"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-2">
                  <FileUpload onFileSelect={setAnalyzeFile} isAnalyzing={analyzeMutation.isPending} />
                </div>
                <div className="flex flex-col justify-center space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-bold text-foreground">Analysis Engine</h3>
                    <p className="text-sm text-muted-foreground">Extracts per-packet features and builds a behavioral fingerprint per device.</p>
                  </div>
                  <Button
                    variant="cyber"
                    size="lg"
                    className="w-full"
                    disabled={!analyzeFile || analyzeMutation.isPending}
                    onClick={handleAnalyze}
                  >
                    {analyzeMutation.isPending ? "Processing..." : "Run Analysis"}
                  </Button>
                  {analyzeMutation.isError && (
                    <div className="text-sm text-destructive flex items-start gap-2 bg-destructive/10 p-3 rounded-lg">
                      <ServerCrash className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{analyzeMutation.error?.message || "Failed to analyze file."}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <AnimatePresence>
              {analyzeResult && (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

                  {/* Device Fingerprints */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold font-display text-foreground">Device Fingerprints</h2>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                        {analyzeResult.fingerprints.length} device{analyzeResult.fingerprints.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {analyzeResult.fingerprints.map((fp, i) => (
                        <motion.div key={fp.ip} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                          <FingerprintCard
                            fingerprint={fp}
                            onSaveBaseline={handleSaveBaseline}
                            isSaving={savingIp === fp.ip}
                            alreadySaved={savedIps.has(fp.ip)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Packet Table */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center bg-card/40 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Total Packets</span>
                          <span className="text-2xl font-mono text-foreground">{analyzeResult.total_packets.toLocaleString()}</span>
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
                            placeholder="Filter by IP..."
                            className="pl-9 w-full sm:w-56 font-mono text-xs h-10"
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

                    <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('src_ip')}>
                              <div className="flex items-center gap-2">Source IP <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('dst_ip')}>
                              <div className="flex items-center gap-2">Destination IP <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('packet_size')}>
                              <div className="flex items-center justify-end gap-2"><ArrowUpDown className="w-3 h-3" /> Size (B)</div>
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
                                  <Activity className="w-6 h-6 opacity-40" />
                                  <p>No packets match the current filter.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      {sortedData.length > 100 && (
                        <div className="p-3 text-center border-t border-border/50 bg-secondary/20 text-xs text-muted-foreground">
                          Showing first 100 rows. Export CSV to see all {filteredData.length.toLocaleString()} records.
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── COMPARE TAB ─────────────────────────────────────── */}
          <TabsContent value="compare" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-6 md:p-8 rounded-3xl"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-2">
                  <FileUpload onFileSelect={setCompareFile} isAnalyzing={compareMutation.isPending} />
                </div>
                <div className="flex flex-col justify-center space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-bold text-foreground">Detection Engine</h3>
                    <p className="text-sm text-muted-foreground">
                      Compares each device's current fingerprint against its saved baseline. Detects TTL spoofing, protocol shifts, and size anomalies.
                    </p>
                    {baselines.length === 0 && (
                      <p className="text-xs text-yellow-400/80 bg-yellow-400/10 px-3 py-2 rounded-lg border border-yellow-400/20">
                        No baselines saved yet. Run an analysis first and save baselines.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="cyber"
                    size="lg"
                    className="w-full"
                    disabled={!compareFile || compareMutation.isPending}
                    onClick={handleCompare}
                  >
                    {compareMutation.isPending ? "Comparing..." : "Compare Against Baselines"}
                  </Button>
                  {compareMutation.isError && (
                    <div className="text-sm text-destructive flex items-start gap-2 bg-destructive/10 p-3 rounded-lg">
                      <ServerCrash className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{compareMutation.error?.message || "Comparison failed."}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <AnimatePresence>
              {compareMutation.data && (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold font-display text-foreground">Detection Results</h2>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                        {compareMutation.data.total_packets.toLocaleString()} packets
                      </span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {(['Normal', 'Suspicious', 'Possible Spoofing', 'No Baseline'] as const).map(v => {
                        const count = compareMutation.data!.comparisons.filter(c => c.verdict === v).length
                        if (!count) return null
                        const colors = {
                          'Normal': 'text-emerald-400 bg-emerald-400/10',
                          'Suspicious': 'text-yellow-400 bg-yellow-400/10',
                          'Possible Spoofing': 'text-red-400 bg-red-400/10',
                          'No Baseline': 'text-muted-foreground bg-secondary/50',
                        }
                        return (
                          <span key={v} className={`px-2 py-1 rounded-lg font-mono ${colors[v]}`}>
                            {count} {v}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {compareMutation.data.comparisons.map((c, i) => (
                      <DetectionCard key={c.ip} comparison={c} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── BASELINES TAB ────────────────────────────────────── */}
          <TabsContent value="baselines">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold font-display text-foreground">Saved Baselines</h2>
                  <p className="text-sm text-muted-foreground">Device profiles used as reference for anomaly detection.</p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{baselines.length} profile{baselines.length !== 1 ? 's' : ''} stored</span>
              </div>
              <BaselinesPanel
                baselines={baselines}
                onDelete={handleDeleteBaseline}
                isDeleting={deleteBaselineMutation.isPending}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
