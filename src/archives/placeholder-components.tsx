import React from 'react';

/**
 * ARCHIVED CODES & PLACEHOLDER COMPONENTS
 * This folder maintains placeholder / mock features that are hidden from the active user interface.
 * These can be reinstated or referenced in future iterations as needed.
 */

// ==========================================
// 1. TELEGRAM BOT COMPOSER (MOCK FEATURE)
// ==========================================

export const TELE_CHANNELS = [
  { id: 'ops', name: '📢 Interdist Ops HN', members: 42, badge: 'Active' },
  { id: 'all_ba', name: '👥 P&G BA Vietnam', members: 110 },
  { id: 'mkt', name: '🎨 Trade Mkt Campaign', members: 18 }
];

export const TELE_HISTORY = [
  { template: 'daily', channel: 'Interdist Ops HN', time: 'Hôm qua 18:02', reads: '38/42 read' },
  { template: 'warning', channel: 'P&G BA Vietnam', time: '14/05 09:30', reads: '102/110 read' }
];

export const TelegramComposer = ({ open, onClose, project = 'stmb', pdata }: any) => {
  if (!open) return null;

  const projTitle = project === 'crv' ? 'CRV BA Long Term' : 'STMB';
  const stores = pdata ? pdata.stores : [];

  const dynTemplates = [
    {
      id: 'daily',
      name: 'Báo cáo hàng ngày',
      desc: 'Form chuẩn gửi OPS P&G mỗi tối',
      icon: '📊',
      body: () => `📊 *OPERATIONS REPORT · ${projTitle}*
Cập nhật chu kỳ: ${pdata?.meta?.updated_to || 'Hôm nay'}

1. Doanh số lũy kế MTD:
• Actual: ${pdata ? Math.round(pdata.total.actual / 1000000) : 0}M VNĐ
• Target Full: ${pdata ? Math.round(pdata.total.target / 1000000) : 0}M VNĐ
• Tiến độ đạt: ${pdata ? pdata.total.pct.toFixed(2) : '0.00'}% (vs Timegone ${(pdata?.meta?.timegone || 0).toFixed(0)}%)

2. Điểm tin vận hành:
• Top perform: ${stores && stores[0] ? stores[0].store : 'N/A'} (${stores && stores[0] ? stores[0].pct.toFixed(1) : 0}%)
• Cần lưu ý: ${stores && stores.length > 0 ? stores[stores.length - 1].store : 'N/A'} (${stores && stores.length > 0 ? stores[stores.length - 1].pct.toFixed(1) : 0}%)

3. Action đề xuất:
• Supervisor kiểm tra các cửa hàng dưới 70% tiến độ.
• Đẩy nhanh tiến độ nhập liệu tuần.`,
    },
    {
      id: 'warning',
      name: 'Cảnh báo tiến độ',
      desc: 'Nhắc nhở Supervisor khi cửa hàng trễ target',
      icon: '⚠️',
      body: () => `⚠️ *CẢNH BÁO TIẾN ĐỘ DOANH SỐ · ${projTitle}*

Kính gửi các anh chị Supervisor,
Hiện tại tiến độ thời gian đã trôi qua ${(pdata?.meta?.timegone || 0).toFixed(0)}%, tuy nhiên các điểm bán sau đây chưa đạt 70% mong đợi:

${(stores || []).filter((s: any) => s.pct < (pdata?.meta?.timegone || 0) * 0.7).slice(0, 5).map((s: any) => `• *${s.store}* (${s.region}): đạt ${s.pct.toFixed(1)}%`).join('\n') || '• Không có cửa hàng nào cực kỳ thấp!'}

→ Đề nghị các Sup liên hệ BA kiểm tra trực tiếp và báo nguyên nhân trong group OPS trước 12:00 ngày mai.`,
    },
    {
      id: 'oos',
      name: 'OOS Alert',
      desc: 'Khi shop báo hết hàng',
      icon: '📦',
      body: () => `📦 *OUT OF STOCK · ${projTitle}*

${stores[0] ? stores[0].store : 'Store'} · Pantene 320ml
Hết hàng từ: 14/05 (4 ngày)
SKU code: PG-PAN-320-S

→ Logistics: ưu tiên giao sớm`,
    },
  ];

  const [tmplId, setTmplId] = React.useState('daily');
  const [channelId, setChannelId] = React.useState('ops');
  const [scheduled, setScheduled] = React.useState(false);
  const [scheduleTime, setScheduleTime] = React.useState('18:00');
  const [sent, setSent] = React.useState(false);
  const [pinned, setPinned] = React.useState(true);

  const tmpl = dynTemplates.find(t => t.id === tmplId) || dynTemplates[0];
  const channel = TELE_CHANNELS.find(c => c.id === channelId) || TELE_CHANNELS[0];
  const body = tmpl.body();

  const handleSend = () => {
    setSent(true);
    setTimeout(() => { setSent(false); onClose && onClose(); }, 1400);
  };

  return (
    <div className="tele-overlay" onClick={onClose}>
      <div className="tele-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="tele-head">
          <div className="tele-head-left">
            <div className="tele-bot-avatar">⚡</div>
            <div>
              <div className="tele-title">Telegram Bot · @InterdistOpsBot</div>
              <div className="tele-sub">Soạn & gửi thông báo [MOCK]</div>
            </div>
          </div>
          <button className="tele-close" onClick={onClose}>✕</button>
        </div>

        {/* Form Container */}
        <div className="tele-body">
          <div className="tele-left">
            <div className="tele-section">
              <div className="tele-section-title">TEMPLATE</div>
              <div className="tele-templates">
                {dynTemplates.map(t => (
                  <button key={t.id} className={`tele-tmpl ${tmplId === t.id ? 'active' : ''}`} onClick={() => setTmplId(t.id)}>
                    <span className="tele-tmpl-icon">{t.icon}</span>
                    <div className="tele-tmpl-meta">
                      <div className="tele-tmpl-name">{t.name}</div>
                      <div className="tele-tmpl-desc">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="tele-right">
            <div className="tele-section-title">PREVIEW</div>
            <div className="tele-preview">
              <pre className="tele-preview-text">{body}</pre>
            </div>
          </div>
        </div>

        <div className="tele-foot">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sent}>
            {sent ? '⌛ Đang gửi...' : `📨 Gửi tới #${channel.name}`}
          </button>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// 2. SUGGESTED ACTIONS FOR BA DETAIL DRAWER
// ==========================================

export const BADrawerSuggestedActionsPlaceholder = () => {
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">SUGGESTED ACTIONS [MOCK]</div>
      <ul className="drawer-actions">
        <li>📞 Supervisor call — review 3 ngày gần nhất</li>
        <li>📚 Training theo top category</li>
        <li>🎯 Set mini-target tuần tới</li>
        <li>📨 Gửi reminder qua Telegram bot</li>
      </ul>
    </div>
  );
};

export const BADrawerFooterButtonsPlaceholder = () => {
  return (
    <>
      <button className="btn btn-secondary">📋 Copy hồ sơ [MOCK]</button>
      <button className="btn btn-primary">📨 Gửi qua Telegram [MOCK]</button>
    </>
  );
};


// ==========================================
// 3. EXPORT REPORT TELEGRAM REDIRECT
// ==========================================

export const ExportReportTelegramButtonPlaceholder = () => {
  return (
    <button className="btn btn-secondary">📨 Gửi qua Telegram [MOCK]</button>
  );
};


// ==========================================
// 4. EXPORT REPORT (PDF REPORT DIALOG) — ARCHIVED 08/06/2026
// ==========================================
// Tạm ẩn khỏi UI chính. Được gọi qua setExportOpen trong App.tsx.
// Để kích hoạt lại: bỏ comment ExportReport trong App.tsx dòng ~1612

const fmtVNDfullLocal = (v: number) => {
  if (!v) return '0 đ';
  return v.toLocaleString('vi-VN') + ' đ';
};

const catLabelLocal = (k: string) => {
  const m: Record<string, string> = {
    HAIRCARE: 'Hair Care', SHAVECARE: 'Shave Care', SKINCARE: 'Skin Care', LAUNDRY: 'Laundry',
  };
  return m[k] || k;
};

export const ExportReportArchived = ({ open, project, pdata, onClose, onPrint }: any) => {
  if (!open) return null;
  const isCRV = project === 'crv';
  const title = isCRV ? 'CRV BA Long Term' : 'STMB';
  const totalRev = pdata.total.actual;
  const target   = pdata.total.target;
  const pct = pdata.total.pct;
  const timegone = pdata.meta.timegone;
  const stores = [...pdata.stores].sort((a: any, b: any) => b.pct - a.pct);
  const onTrack = stores.filter((s: any) => s.pct >= timegone).length;
  const below70 = stores.filter((s: any) => s.pct < timegone * 0.7).length;

  return (
    <div className="tele-overlay" onClick={onClose}>
      <div className="report-modal" id="printable-report" onClick={(e) => e.stopPropagation()}>
        <div className="report-head">
          <div>
            <div className="report-eyebrow mono">INTERDIST · P&G · {title.toUpperCase()}</div>
            <div className="report-title">Báo cáo Hiệu suất Kênh {title}</div>
            <div className="report-sub">Chu kỳ {pdata.meta.start_day} — {pdata.meta.end_day} · Updated {pdata.meta.updated_to}</div>
          </div>
          <button className="tele-close no-print" onClick={onClose}>✕</button>
        </div>
        <div className="report-body">
          <div className="report-cover">
            <div className="report-cover-main">
              <div className="report-cover-label mono">ACTUAL SO</div>
              <div className="report-cover-val mono">{fmtVNDfullLocal(totalRev)} <span>VNĐ</span></div>
              <div className="report-cover-tgt mono">/ {fmtVNDfullLocal(target)} target</div>
            </div>
            <div className="report-cover-side">
              <div className="report-cover-stat">
                <div className="mono">{pct.toFixed(1)}%</div>
                <div>%Ach Full Month</div>
              </div>
              <div className="report-cover-stat">
                <div className="mono">{stores.length}</div>
                <div>điểm bán active</div>
              </div>
              <div className="report-cover-stat">
                <div className="mono">{onTrack}</div>
                <div>on-track ≥ {timegone.toFixed(0)}%</div>
              </div>
              <div className="report-cover-stat">
                <div className="mono" style={{ color: 'var(--c-bad)' }}>{below70}</div>
                <div>dưới {(timegone * 0.7).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        </div>
        <div className="report-foot no-print">
          <div className="report-foot-info mono">Báo cáo tự sinh · Interdist Analytics v3.0</div>
          <div className="tele-foot-actions">
            <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
            <button className="btn btn-primary" onClick={onPrint}>⬇ Tải PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
};
