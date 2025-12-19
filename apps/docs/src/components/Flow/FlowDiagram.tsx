import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type FitViewOptions,
  MarkerType,
  ConnectionLineType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { nodeTypes } from './nodes';

export interface FlowDiagramProps {
  nodes: Node[];
  edges: Edge[];
  height?: number | string;
  fitView?: boolean;
  miniMap?: boolean;
  controls?: boolean;
  interactive?: boolean;
  className?: string;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  autoLayout?: boolean;
}

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
  maxZoom: 1.5,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
  },
  style: {
    strokeWidth: 2,
  },
};

// Use dagre to create a hierarchical layout
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 140;
  const nodeHeight = 50;

  // Map direction to dagre rankdir
  const rankdir = direction === 'BT' ? 'BT' : direction === 'RL' ? 'RL' : direction === 'LR' ? 'LR' : 'TB';

  dagreGraph.setGraph({
    rankdir,
    nodesep: 60,
    ranksep: 80,
    marginx: 30,
    marginy: 30,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const isHorizontal = direction === 'LR' || direction === 'RL';

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
    };
  });

  return { nodes: layoutedNodes, edges };
}

export default function FlowDiagram({
  nodes: initialNodes,
  edges: initialEdges,
  height = 400,
  fitView = true,
  miniMap = false,
  controls = true,
  interactive = true,
  className = '',
  direction = 'TB',
  autoLayout = true,
}: FlowDiagramProps) {
  // Apply dagre layout if enabled
  const layoutedData = useMemo(() => {
    if (autoLayout && initialNodes.length > 0 && initialEdges.length > 0) {
      return getLayoutedElements(initialNodes, initialEdges, direction);
    }
    return { nodes: initialNodes, edges: initialEdges };
  }, [initialNodes, initialEdges, direction, autoLayout]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedData.edges);

  // Apply edge colors based on labels
  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      let strokeColor = 'var(--flow-edge)';
      const label = edge.label?.toString().toLowerCase() || '';

      if (label.includes('error') || label.includes('fail') ||
          label.includes('cancel') || label.includes('reject') ||
          edge.data?.type === 'error') {
        strokeColor = 'var(--flow-error)';
      } else if (label.includes('success') || label.includes('complete') ||
                 label.includes('confirm') || label.includes('approved') ||
                 edge.data?.type === 'success') {
        strokeColor = 'var(--flow-success)';
      }

      return {
        ...edge,
        type: 'smoothstep',
        style: {
          ...edge.style,
          stroke: strokeColor,
          strokeWidth: 2,
        },
        labelStyle: { fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--flow-node-bg)', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: strokeColor,
        },
      };
    });
  }, [edges]);

  return (
    <div
      className={`flow-diagram-container ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={interactive ? onNodesChange : undefined}
        onEdgesChange={interactive ? onEdgesChange : undefined}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView={fitView}
        fitViewOptions={fitViewOptions}
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--flow-grid)" gap={20} size={1} />
        {controls && <Controls showInteractive={false} />}
        {miniMap && (
          <MiniMap
            nodeStrokeColor="var(--flow-node-border)"
            nodeColor="var(--flow-node-bg)"
            maskColor="var(--flow-minimap-mask)"
          />
        )}
      </ReactFlow>
    </div>
  );
}
