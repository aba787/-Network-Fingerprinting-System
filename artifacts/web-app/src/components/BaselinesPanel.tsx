import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Database, Calendar, Tag } from 'lucide-react'
import type { BaselineRecord } from '@workspace/api-client-react'
import { Button } from '@/components/ui/button'
import { getProtocolName } from '@/lib/utils'

interface BaselinesPanelProps {
  baselines: BaselineRecord[]
  onDelete: (id: number) => void
  isDeleting: boolean
}

export function BaselinesPanel({ baselines, onDelete, isDeleting }: BaselinesPanelProps) {
  if (baselines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Database className="w-10 h-10 opacity-30" />
        <p className="text-sm">No baselines saved yet.</p>
        <p className="text-xs">Run an analysis and click "Save Baseline" on any device.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {baselines.map((b, i) => {
          const topProtos = Object.entries(b.fingerprint.protocol_distribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)

          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.04 }}
              className="glass-panel rounded-2xl p-4 border border-border/50 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-foreground">{b.ip}</span>
                    {b.label && (
                      <span className="flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" />
                        {b.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{b.fingerprint.packet_count.toLocaleString()} pkts</span>
                    <span>TTL {b.fingerprint.avg_ttl.toFixed(0)}</span>
                    <span>{topProtos.map(([k]) => getProtocolName(parseInt(k, 10))).join('/')}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(b.id)}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
