import React from 'react';

/**
 * PopupCard — uniform, professional body for Leaflet <Popup> content.
 * Renders a title (with optional color/icon), a badge chip, labelled rows,
 * an optional divider section and a small footer.
 */
const font = { fontFamily: "'Roboto', sans-serif" };

export const PopupCard = ({ title, titleColor = '#202124', icon, badge, rows = [], sections = [], footer }) => {
  return (
    <div style={{ ...font, minWidth: 200, maxWidth: 280, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {icon}
          <div style={{ fontWeight: 800, fontSize: 13.5, color: titleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        </div>
        {badge}
      </div>

      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '1.5px 0', color: '#5F6368' }}>
          <span style={{ fontWeight: 600, color: '#80868B' }}>{r.label}</span>
          <span style={{ fontWeight: 700, color: '#3C4043', textAlign: 'right' }}>{r.value || '—'}</span>
        </div>
      ))}

      {sections.map((s, i) => (
        <div key={`s-${i}`} style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #EEF0F2' }}>
          {s.title && <div style={{ fontWeight: 700, fontSize: 10.5, color: '#5F6368', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>{s.title}</div>}
          {s.content}
        </div>
      ))}

      {footer && <div style={{ marginTop: 8, paddingTop: 5, borderTop: '1px solid #F1F3F4', fontSize: 10.5, color: '#9AA0A6' }}>{footer}</div>}
    </div>
  );
};

export const StatusBadge = ({ text, color = '#059669', bg }) => (
  <span style={{
    display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 800,
    color, background: bg || `${color}1A`, border: `1px solid ${color}55`, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
  }}>
    {text}
  </span>
);

export default PopupCard;
