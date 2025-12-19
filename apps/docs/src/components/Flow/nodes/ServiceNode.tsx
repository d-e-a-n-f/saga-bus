import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export interface ServiceNodeData {
  label: string;
  icon?: string;
  type?: 'database' | 'queue' | 'service' | 'external';
}

const typeStyles = {
  database: { icon: '🗄️', color: 'var(--flow-success)' },
  queue: { icon: '📨', color: 'var(--flow-warning)' },
  service: { icon: '⚙️', color: 'var(--flow-primary)' },
  external: { icon: '🌐', color: 'var(--flow-secondary)' },
};

function ServiceNode({ data, selected }: NodeProps<ServiceNodeData>) {
  const style = typeStyles[data.type || 'service'];

  return (
    <div
      className="flow-service-node"
      style={{
        borderColor: selected ? 'var(--flow-primary)' : style.color,
        borderWidth: selected ? '2px' : '1px',
      }}
    >
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div className="flow-service-icon">{data.icon || style.icon}</div>
      <div className="flow-service-label">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
      <Handle type="source" position={Position.Right} className="flow-handle" />
    </div>
  );
}

export default memo(ServiceNode);
