import React from 'react';
import LightModal from './LightModal.jsx';

export default function UXFramePortal(props) {
  const { open, onClose } = props;
  return (
    <LightModal
      open={open}
      onClose={onClose}
      title={null}
      footer={null}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: '1100px',
          height: '80vh',
          maxHeight: '90vh',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
        }}
      >
        <iframe
          src="/.sys/ux/rt-matrix.html"
          title="rt-matrix"
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 12,
            background: '#000',
            width: '100%',
            height: '100%',
          }}
          allow="autoplay; clipboard-read; clipboard-write"
        />
      </div>
    </LightModal>
  );
}
