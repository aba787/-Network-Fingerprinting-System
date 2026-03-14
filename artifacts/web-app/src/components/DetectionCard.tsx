import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, ShieldX, HelpCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import type { DeviceComparison, DetectionVerdict } from '@workspace/api-client-react'
import { Badge } from '@/components/ui/badge'
import { getProtocolName } from '@/lib/utils'

interface DetectionCardProps {
  comparison: DeviceComparison
  index: number
}

const VERDICT_CONFIG: Record<DetectionVerdict, {
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
}> = {
  Normal: {
    label: 'Normal',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30',
  },
  Suspicious: {
    label: 'Suspicious',
    icon: <ShieldAlert className="w-5 h-5" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
  },
  'Possible Spoofing': {
    label: 'Possible Spoofing',
    icon: <ShieldX className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
  },
  'No Baseline': {
    label: 'No Baseline',
    icon: <HelpCircle className="w-5 h-5" />,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary/40',
    borderColor: 'border-border/50',
  },
}

export function DetectionCard({ comparison, index }: DetectionCardProps) {
  const cfg = VERDICT_CONFIG[comparison.verdict]
  const hasBaseline = comparison.verdict !== 'No Baseline'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`glass-panel rounded-2xl p-5 space-y-4 border ${cfg.borderColor}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">{comparison.ip}</p>
          {comparison.baseline_label && (
            <p className="text-xs text-muted-foreground mt-0.5">Baseline: {comparison.baseline_label}</p>
          )}
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${cfg.bgColor} ${cfg.color} shrink-0`}>
          {cfg.icon}
          <span className="text-sm font-bold">{cfg.label}</span>
        </div>
      </div>

      {hasBaseline && comparison.similarity_score !== null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Fingerprint Similarity</span>
            </div>
            <span className={`font-mono font-bold ${cfg.color}`}>{comparison.similarity_score}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                comparison.verdict === 'Normal' ? 'bg-emerald-400' :
                comparison.verdict === 'Suspicious' ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${comparison.similarity_score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.06 + 0.2 }}
            />
          </div>
        </div>
      )}

      {hasBaseline && comparison.baseline_fingerprint && (
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <CompareRow
            label="Avg TTL"
            baseline={comparison.baseline_fingerprint.avg_ttl.toFixed(1)}
            current={comparison.current_fingerprint.avg_ttl.toFixed(1)}
            changed={Math.abs(comparison.current_fingerprint.avg_ttl - comparison.baseline_fingerprint.avg_ttl) > 5}
          />
          <CompareRow
            label="Avg Size"
            baseline={`${comparison.baseline_fingerprint.avg_packet_size.toFixed(0)}B`}
            current={`${comparison.current_fingerprint.avg_packet_size.toFixed(0)}B`}
            changed={Math.abs(comparison.current_fingerprint.avg_packet_size - comparison.baseline_fingerprint.avg_packet_size) / Math.max(comparison.baseline_fingerprint.avg_packet_size, 1) > 0.2}
          />
          <CompareRow
            label="Protocol"
            baseline={Object.entries(comparison.baseline_fingerprint.protocol_distribution).sort((a,b)=>b[1]-a[1]).map(([k])=>getProtocolName(parseInt(k,10))).join('/')}
            current={Object.entries(comparison.current_fingerprint.protocol_distribution).sort((a,b)=>b[1]-a[1]).map(([k])=>getProtocolName(parseInt(k,10))).join('/')}
            changed={JSON.stringify(comparison.baseline_fingerprint.protocol_distribution) !== JSON.stringify(comparison.current_fingerprint.protocol_distribution)}
          />
        </div>
      )}

      {comparison.deviations.length > 0 && (
        <div className="space-y-1.5">
          {comparison.deviations.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${hasBaseline ? cfg.color : 'text-muted-foreground'}`} />
              <span>{d}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function CompareRow({ label, baseline, current, changed }: { label: string; baseline: string; current: string; changed: boolean }) {
  return (
    <div className={`rounded-lg p-2 space-y-1 ${changed ? 'bg-red-400/10 border border-red-400/20' : 'bg-secondary/30'}`}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-muted-foreground text-[10px] truncate">Base: {baseline}</p>
      <p className={`text-[10px] font-bold truncate ${changed ? 'text-red-400' : 'text-emerald-400'}`}>Now: {current}</p>
    </div>
  )
}
