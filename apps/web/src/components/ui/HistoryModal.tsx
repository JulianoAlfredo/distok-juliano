import { Modal } from './Modal';
import { EmptyState } from './index';
import { IconHistory } from './icons';

export type HistoryEntry = { id: string; action: string; before_json: string | null; after_json: string | null; created_at: string; user_name: string | null };

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  entries: HistoryEntry[];
  actionLabels: Record<string, string>;
}

/** Modal genérico de histórico de auditoria (extraído do padrão original de Clientes). */
export function HistoryModal({ open, onClose, title, entries, actionLabels }: HistoryModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {entries.length === 0 ? (
        <EmptyState icon={<IconHistory />} title="Sem registros de alteração" hint="Alterações futuras aparecerão aqui." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Campos</th></tr></thead>
            <tbody>
              {entries.map((e) => {
                const after = e.after_json ? JSON.parse(e.after_json) : null;
                const changedFields = after ? Object.keys(after).filter((k) => k !== 'id' && k !== 'tenant_id').join(', ') : null;
                return (
                  <tr key={e.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                    <td>{actionLabels[e.action] || e.action}</td>
                    <td className="muted">{e.user_name || '—'}</td>
                    <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{changedFields || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
