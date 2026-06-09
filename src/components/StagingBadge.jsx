import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const detectStaging = () => {
  if (import.meta.env.VITE_ENVIRONMENT === 'staging') return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('-git-staging-') || host.startsWith('staging.');
};

const StagingBadge = () => {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setShow(detectStaging());
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: expanded ? '10px 14px' : '6px 12px',
        borderRadius: 999,
        background: '#F59E0B',
        color: '#1a1a1a',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        boxShadow: '0 6px 18px rgba(245, 158, 11, 0.45)',
        border: '1px solid #FBBF24',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        maxWidth: expanded ? 280 : 'unset',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
      }}
      title="Click para ver detalles"
    >
      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: 'nowrap' }}>Entorno de pruebas</span>
      {expanded && (
        <span
          style={{
            fontSize: 10,
            textTransform: 'none',
            fontWeight: 500,
            letterSpacing: 0,
            marginLeft: 4,
            opacity: 0.85,
            lineHeight: 1.3,
          }}
        >
          · Los datos creados aquí se reflejan en la base de datos real.
        </span>
      )}
    </div>
  );
};

export default StagingBadge;
