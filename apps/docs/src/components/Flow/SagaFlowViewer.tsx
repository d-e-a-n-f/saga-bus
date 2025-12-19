import React, { useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from './nodes';
import CodeBlock from '@theme/CodeBlock';

export interface SagaFlowViewerProps {
  nodes: Node[];
  edges: Edge[];
  code: string;
  language?: string;
  title?: string;
  height?: number | string;
  showLineNumbers?: boolean;
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
  },
};

export default function SagaFlowViewer({
  nodes: initialNodes,
  edges: initialEdges,
  code,
  language = 'typescript',
  title,
  height = 500,
  showLineNumbers = true,
}: SagaFlowViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Apply edge colors based on labels/data
  const styledEdges = useMemo(() => {
    return initialEdges.map((edge) => {
      let strokeColor = 'var(--flow-edge)';

      if (edge.label?.toString().toLowerCase().includes('error') ||
          edge.label?.toString().toLowerCase().includes('fail') ||
          edge.data?.type === 'error') {
        strokeColor = 'var(--flow-error)';
      } else if (edge.label?.toString().toLowerCase().includes('success') ||
                 edge.label?.toString().toLowerCase().includes('complete') ||
                 edge.data?.type === 'success') {
        strokeColor = 'var(--flow-success)';
      }

      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: strokeColor,
        },
        markerEnd: {
          ...defaultEdgeOptions.markerEnd,
          color: strokeColor,
        },
      };
    });
  }, [initialEdges]);

  // Highlight nodes
  const highlightedNodes = useMemo(() => {
    return initialNodes.map((node) => ({
      ...node,
      selected: node.id === selectedNode,
    }));
  }, [initialNodes, selectedNode]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
  };

  return (
    <div className="saga-flow-viewer">
      {title && <div className="saga-flow-viewer-title">{title}</div>}
      <div
        className="saga-flow-viewer-content"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <div className="saga-flow-viewer-diagram">
          <ReactFlow
            nodes={highlightedNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            onNodeClick={handleNodeClick}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--flow-grid)" gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <div className="saga-flow-viewer-code">
          <CodeBlock language={language} showLineNumbers={showLineNumbers}>
            {code}
          </CodeBlock>
        </div>
      </div>
      {selectedNode && (
        <div className="saga-flow-viewer-info">
          Selected: <strong>{selectedNode}</strong>
        </div>
      )}
    </div>
  );
}
