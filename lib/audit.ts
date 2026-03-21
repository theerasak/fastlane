import { getServerClient } from '@/lib/supabase/server'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface AuditParams {
  table_name: string
  record_id: string
  action: AuditAction
  performed_by: string
  performed_by_email: string
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
}

/**
 * Write an audit log entry. Never throws — audit failure must not block the main operation.
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    const supabase = getServerClient()
    await supabase.from('audit_logs').insert({
      table_name: params.table_name,
      record_id: params.record_id,
      action: params.action,
      performed_by: params.performed_by,
      performed_by_email: params.performed_by_email,
      old_data: params.old_data ?? null,
      new_data: params.new_data ?? null,
    })
  } catch {
    // Intentionally swallowed — audit log must not break main API operations
  }
}
