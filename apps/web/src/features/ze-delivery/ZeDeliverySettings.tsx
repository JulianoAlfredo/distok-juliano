import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatBRL } from '../../lib/format';

type ZeOrder = {
  id: string;
  order_number: string;
  status: string;
  total_value: number | null;
  concluded_at: string | null;
  created_at: string;
};
type OrdersPage = { items: ZeOrder[]; total: number; page: number; pages: number; totalValueConcluded: number };
type Movement = { id: string; type: string; quantity: number; source: string; created_at: string; product_name: string };
type Status = { credentials: Credentials; recentMovements: Movement[]; outboxErrorCount: number };

type Credentials = {
  tenant_id: string;
  environment: 'production' | 'sandbox';
  client_id: string;
  merchant_ids: string[];
  status: 'disconnected' | 'active' | 'error';
  last_sync_inbound_at: string | null;
  last_sync_outbound_at: string | null;
  last_import_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
} | null;

type ImportResult = {
  imported: number;
  linked: number;
  skipped: { itemId: string | null; reason: string }[];
  stoppedEarly: boolean;
  planLimitHit: boolean;
};

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  disconnected: { text: 'Não conectado', className: 'badge' },
  active: { text: 'Conectado', className: 'badge badge-success' },
  error: { text: 'Erro', className: 'badge badge-danger' },
};

export function ZeDeliverySettings() {
  const toast = useToast();
  const [cred, setCred] = useState<Credentials>(null);
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('sandbox');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [merchantIdsText, setMerchantIdsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [orders, setOrders] = useState<OrdersPage>({ items: [], total: 0, page: 1, pages: 1, totalValueConcluded: 0 });
  const [orderStatus, setOrderStatus] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusPanel, setStatusPanel] = useState<Status | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/ze-delivery');
      if (data) {
        setCred(data);
        setEnvironment(data.environment);
        setClientId(data.client_id || '');
        setMerchantIdsText((data.merchant_ids || []).join(', '));
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders(status = orderStatus) {
    setOrdersLoading(true);
    try {
      const { data } = await api.get('/ze-delivery/orders', { params: { status: status || undefined } });
      setOrders(data);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadStatus() {
    try {
      const { data } = await api.get('/ze-delivery/status');
      setStatusPanel(data);
    } catch { /* silencioso — painel é informativo, não bloqueia a tela */ }
  }

  useEffect(() => { load(); loadOrders(); loadStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        environment,
        client_id: clientId,
        merchant_ids: merchantIdsText.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (clientSecret) payload.client_secret = clientSecret; // só envia se o admin digitou um novo valor
      await api.put('/ze-delivery', payload);
      setClientSecret('');
      toast.push('Credenciais salvas!', 'success');
      await load();
      await loadStatus();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao salvar credenciais.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (clientSecret || !cred) {
        payload.environment = environment;
        payload.client_id = clientId;
        payload.client_secret = clientSecret;
      }
      const { data } = await api.post('/ze-delivery/test-connection', payload);
      if (data.ok) toast.push('Conexão com o Zé Delivery funcionando!', 'success');
      else toast.push(data.message || 'Falha ao conectar.', 'error');
      await load();
      await loadStatus();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao testar conexão.', 'error');
    } finally {
      setTesting(false);
    }
  }

  async function importCatalog() {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await api.post('/ze-delivery/import');
      setImportResult(data);
      if (data.planLimitHit) {
        toast.push('Importação parcial: limite de produtos do plano atingido.', 'error');
      } else {
        toast.push(`Catálogo importado: ${data.imported} novo(s), ${data.linked} vinculado(s).`, 'success');
      }
      await load();
      await loadStatus();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao importar catálogo.', 'error');
    } finally {
      setImporting(false);
    }
  }

  const status = cred ? STATUS_LABEL[cred.status] : STATUS_LABEL.disconnected;

  return (
    <div>
      <PageHeader
        title="Zé Delivery"
        subtitle="Conecte sua conta do Zé Delivery — cada distribuidora usa as próprias credenciais"
        actions={<span className={status.className}>{status.text}</span>}
      />

      <div className="card" style={{ maxWidth: 560 }}>
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <>
            <div className="field">
              <label>Ambiente</label>
              <select className="input" value={environment} onChange={(e) => setEnvironment(e.target.value as 'production' | 'sandbox')}>
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Produção</option>
              </select>
            </div>

            <div className="field">
              <label>Client ID</label>
              <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID do Zé Delivery" />
            </div>

            <div className="field">
              <label>Client Secret {cred ? '(deixe em branco para manter o atual)' : ''}</label>
              <input
                className="input" type="password" value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={cred ? '••••••••' : 'Client Secret do Zé Delivery'}
              />
            </div>

            <div className="field">
              <label>IDs dos estabelecimentos (merchant IDs, separados por vírgula)</label>
              <input className="input" value={merchantIdsText} onChange={(e) => setMerchantIdsText(e.target.value)} placeholder="111, 222" />
            </div>

            <div className="row mt-2" style={{ gap: 'var(--sp-2)' }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !clientId}>
                {saving ? 'Salvando…' : 'Salvar credenciais'}
              </button>
              <button className="btn" onClick={testConnection} disabled={testing || !clientId}>
                {testing ? 'Testando…' : 'Testar conexão'}
              </button>
            </div>

            {cred?.last_error && (
              <p className="mt-4" style={{ color: 'var(--color-danger)' }}>
                Último erro: {cred.last_error} {cred.last_error_at ? `(${new Date(cred.last_error_at).toLocaleString('pt-BR')})` : ''}
              </p>
            )}

            <div className="row muted mt-4" style={{ gap: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
              <span>Último sync de pedidos: {cred?.last_sync_inbound_at ? new Date(cred.last_sync_inbound_at).toLocaleString('pt-BR') : 'nunca'}</span>
              <span>Último envio de estoque: {cred?.last_sync_outbound_at ? new Date(cred.last_sync_outbound_at).toLocaleString('pt-BR') : 'nunca'}</span>
              {!!statusPanel?.outboxErrorCount && (
                <span className="badge badge-danger">{statusPanel.outboxErrorCount} produto(s) com erro no envio</span>
              )}
            </div>

            {!!statusPanel?.recentMovements?.length && (
              <div className="mt-4">
                <div className="label">Últimas movimentações desta integração</div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Origem</th><th>Data</th></tr></thead>
                    <tbody>
                      {statusPanel.recentMovements.map((m) => (
                        <tr key={m.id}>
                          <td data-label="Produto">{m.product_name}</td>
                          <td data-label="Tipo">{m.type}</td>
                          <td data-label="Qtd">{m.quantity}</td>
                          <td className="muted" data-label="Origem">{m.source === 'ze_delivery_import' ? 'importação' : 'pedido'}</td>
                          <td className="muted" data-label="Data">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <hr style={{ margin: 'var(--sp-6) 0', border: 0, borderTop: '1px solid var(--color-border)' }} />

            <h3 style={{ marginBottom: 'var(--sp-2)' }}>Catálogo</h3>
            <p className="muted" style={{ marginBottom: 'var(--sp-3)' }}>
              Importa os itens já cadastrados no Zé Delivery como produtos no DISTOK (casando por código/SKU quando possível).
              Itens já importados não são reprocessados — não sobrescreve contagens ajustadas manualmente depois.
            </p>
            <button className="btn" onClick={importCatalog} disabled={importing || cred?.status !== 'active'}>
              {importing ? 'Importando…' : 'Importar catálogo agora'}
            </button>
            {cred?.status !== 'active' && <p className="muted mt-2">Teste a conexão com sucesso antes de importar.</p>}
            {cred?.last_import_at && <p className="muted mt-2">Última importação: {new Date(cred.last_import_at).toLocaleString('pt-BR')}</p>}

            {importResult && (
              <div className="mt-4">
                <p><strong>{importResult.imported}</strong> criado(s), <strong>{importResult.linked}</strong> vinculado(s), <strong>{importResult.skipped.length}</strong> pulado(s).</p>
                {importResult.planLimitHit && <p style={{ color: 'var(--color-danger)' }}>Limite de produtos do plano atingido — importação parcial.</p>}
                {importResult.skipped.length > 0 && (
                  <ul style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }} className="muted">
                    {importResult.skipped.slice(0, 20).map((s, i) => (
                      <li key={i}>{s.itemId || '(sem id)'}: {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card mt-6">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
          <h3>Pedidos Zé Delivery</h3>
          <div className="row" style={{ gap: 'var(--sp-2)' }}>
            <select className="input" value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); loadOrders(e.target.value); }}>
              <option value="">Todos os status</option>
              <option value="CREATED">Criado</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="EDITED">Editado</option>
              <option value="READY_FOR_PICKUP">Pronto p/ coleta</option>
              <option value="DISPATCHED">Em rota</option>
              <option value="CONCLUDED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
        </div>

        <p className="muted" style={{ marginBottom: 'var(--sp-3)' }}>
          Log de pedidos puxados do Zé Delivery — use para conferência e cálculo de faturamento.
        </p>
        <div className="badge badge-success" style={{ marginBottom: 'var(--sp-3)', display: 'inline-block' }}>
          Faturamento (concluídos, filtro atual): {formatBRL(orders.totalValueConcluded)}
        </div>

        {ordersLoading ? <p>Carregando…</p> : orders.items.length === 0 ? (
          <p className="muted">Nenhum pedido ainda — os pedidos aparecem aqui conforme o sync de eventos processa o Zé Delivery.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pedido</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
              <tbody>
                {orders.items.map((o) => (
                  <tr key={o.id}>
                    <td data-label="Pedido">{o.order_number}</td>
                    <td data-label="Status"><span className="badge">{o.status}</span></td>
                    <td data-label="Valor">{o.total_value != null ? formatBRL(Number(o.total_value)) : '—'}</td>
                    <td className="muted" data-label="Data">{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
