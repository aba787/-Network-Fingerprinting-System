import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, CheckCircle, Cpu, Activity, Network, Clock, Hash } from 'lucide-react'
import type { DeviceFingerprint } from '@workspace/api-client-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getProtocolName } from '@/lib/utils'

interface FingerprintCardProps {
  fingerprint: DeviceFingerprint
  onSaveBaseline: (fingerprint: DeviceFingerprint, label: string) => Promise<void>
  isSaving: boolean
  alreadySaved: boolean
}

export function FingerprintCard({ fingerprint, onSaveBaseline, isSaving, alreadySaved }: FingerprintCardProps) {
  const [label, setLabel] = useState(fingerprint.ip)
  const [saved, setSaved] = useState(alreadySaved)

  const handleSave = async () => {
    await onSaveBaseline(fingerprint, label)
    setSaved(true)
  }

  const topProtocols = Object.entries(fingerprint.protocol_distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5 space-y-4 border border-border/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-foreground truncate">{fingerprint.ip}</p>
            <p className="text-xs text-muted-foreground">{fingerprint.packet_count.toLocaleString()} packets · {fingerprint.unique_destinations} destination{fingerprint.unique_destinations !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {saved ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0">
            <CheckCircle className="w-4 h-4" />
            <span>Saved</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="h-8 px-2 text-xs rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-32"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1.5 h-8 text-xs whitespace-nowrap"
            >
              <Save className="w-3 h-3" />
              Save Baseline
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Activity className="w-3.5 h-3.5" />} label="Avg Size" value={`${fingerprint.avg_packet_size.toFixed(0)} B`} sub={`±${fingerprint.std_packet_size.toFixed(0)}`} />
        <Stat icon={<Hash className="w-3.5 h-3.5" />} label="Avg TTL" value={fingerprint.avg_ttl.toFixed(1)} sub={`±${fingerprint.std_ttl.toFixed(1)}`} />
        <Stat icon={<Clock className="w-3.5 h-3.5" />} label="Avg Δ Time" value={`${(fingerprint.avg_time_delta * 1000).toFixed(2)} ms`} sub={`±${(fingerprint.std_time_delta * 1000).toFixed(2)}`} />
        <Stat icon={<Network className="w-3.5 h-3.5" />} label="Unique Dests" value={fingerprint.unique_destinations.toString()} sub="endpoints" />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Protocol Distribution</p>
        <div className="flex flex-wrap gap-2">
          {topProtocols.map(([proto, pct]) => (
            <Badge key={proto} variant="outline" className="font-mono text-xs gap-1.5">
              <span className="text-primary">{getProtocolName(parseInt(proto, 10))}</span>
              <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
            </Badge>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-secondary/30 rounded-xl p-3 space-y-0.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-mono text-sm font-bold text-foreground">{value}</p>
      <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}
