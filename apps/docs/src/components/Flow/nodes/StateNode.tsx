import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export interface StateNodeData {
  label: string;
  status?: 'initial' | 'active' | 'success' | 'error' | 'warning' | 'pending';
  description?: string;
}

const statusColors = {
  initial: { bg: 'var(--flow-node-bg)', border: 'var(--flow-node-border)' },
  active: { bg: 'var(--flow-primary-bg)', border: 'var(--flow-primary)' },
  success: { bg: 'var(--flow-success-bg)', border: 'var(--flow-success)' },
  error: { bg: 'var(--flow-error-bg)', border: 'var(--flow-error)' },
  warning: { bg: 'var(--flow-warning-bg)', border: 'var(--flow-warning)' },
  pending: { bg: 'var(--flow-node-bg)', border: 'var(--flow-node-border)' },
};

function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const status = data.status || 'pending';
  const colors = statusColors[status];

  return (
    <div
      className="flow-state-node"
      style={{
        background: colors.bg,
        borderColor: selected ? 'var(--flow-primary)' : colors.border,
        borderWidth: selected ? '2px' : '1px',
      }}
    >
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="flow-state-label">{data.label}</div>
      {data.description && (
        <div className="flow-state-description">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

export default memo(StateNode);
