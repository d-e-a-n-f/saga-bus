import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export interface DecisionNodeData {
  label: string;
  condition?: string;
}

function DecisionNode({ data, selected }: NodeProps<DecisionNodeData>) {
  return (
    <div
      className="flow-decision-node"
      style={{
        borderColor: selected ? 'var(--flow-primary)' : 'var(--flow-warning)',
        borderWidth: selected ? '2px' : '1px',
      }}
    >
      <Handle type="target" position={Position.Top} className="flow-handle flow-handle-diamond" />
      <div className="flow-decision-content">
        <div className="flow-decision-label">{data.label}</div>
        {data.condition && (
          <div className="flow-decision-condition">{data.condition}</div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="flow-handle flow-handle-diamond"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        className="flow-handle flow-handle-diamond"
        style={{ top: '50%' }}
      />
    </div>
  );
}

export default memo(DecisionNode);
