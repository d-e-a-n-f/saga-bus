import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
  ConnectionLineType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { nodeTypes } from './nodes';

// Lazy load Monaco to avoid SSR issues
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

export interface LiveSagaEditorProps {
  initialDefinition?: string;
  height?: number | string;
  title?: string;
}

interface ParsedSaga {
  nodes: Node[];
  edges: Edge[];
  error?: string;
}

interface StateTransition {
  from: string;
  to: string;
  event: string;
  isError?: boolean;
  isSuccess?: boolean;
}

const defaultDefinition = `// Order Saga - E-commerce order processing
// Edit this to see the flow diagram update!

// -- Message Types --
type OrderSubmitted = { type: 'OrderSubmitted'; orderId: string };
type PaymentCaptured = { type: 'PaymentCaptured'; orderId: string };
type PaymentFailed = { type: 'PaymentFailed'; orderId: string };
type InventoryReserved = { type: 'InventoryReserved'; orderId: string };
type InventoryFailed = { type: 'InventoryFailed'; orderId: string };
type RefundCompleted = { type: 'RefundCompleted'; orderId: string };
type ShipmentCreated = { type: 'ShipmentCreated'; orderId: string };
type DeliveryConfirmed = { type: 'DeliveryConfirmed'; orderId: string };

type OrderMessages =
  | OrderSubmitted
  | PaymentCaptured
  | PaymentFailed
  | InventoryReserved
  | InventoryFailed
  | RefundCompleted
  | ShipmentCreated
  | DeliveryConfirmed;

// -- Saga State --
interface OrderState {
  orderId: string;
  status: 'pending' | 'paid' | 'reserved' | 'shipped' | 'completed' | 'failed' | 'compensating';
}

// -- Saga Definition --
const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('*', msg => msg.orderId)

  .initial<OrderSubmitted>(msg => ({
    orderId: msg.orderId,
    status: 'pending',
  }))

  .on('PaymentCaptured')
    .when(state => state.status === 'pending')
    .handle(async (msg, state) => ({
      ...state,
      status: 'paid',
    }))

  .on('PaymentFailed')
    .when(state => state.status === 'pending')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'failed' };
    })

  .on('InventoryReserved')
    .when(state => state.status === 'paid')
    .handle(async (msg, state) => ({
      ...state,
      status: 'reserved',
    }))

  .on('InventoryFailed')
    .when(state => state.status === 'paid')
    .handle(async (msg, state, ctx) => {
      ctx.publish({ type: 'RefundPayment' });
      return { ...state, status: 'compensating' };
    })

  .on('RefundCompleted')
    .when(state => state.status === 'compensating')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'failed' };
    })

  .on('ShipmentCreated')
    .when(state => state.status === 'reserved')
    .handle(async (msg, state) => ({
      ...state,
      status: 'shipped',
    }))

  .on('DeliveryConfirmed')
    .when(state => state.status === 'shipped')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'completed' };
    })

  .build();
`;

// Use dagre to create a hierarchical layout
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 140;
  const nodeHeight = 60;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
    };
  });

  return { nodes: layoutedNodes, edges };
}

function parseSagaDSL(code: string): ParsedSaga {
  const states = new Set<string>();
  const transitions: StateTransition[] = [];
  const transitionSet = new Set<string>(); // Dedupe transitions

  try {
    // Extract status type from interface
    const statusTypeMatch = code.match(/status:\s*(['"][^'"]+['"](?:\s*\|\s*['"][^'"]+['"])*)/);
    if (statusTypeMatch) {
      const statusValues = statusTypeMatch[1].match(/['"]([^'"]+)['"]/g);
      if (statusValues) {
        statusValues.forEach(s => states.add(s.replace(/['"]/g, '')));
      }
    }

    // Extract initial state
    const initialMatch = code.match(/\.initial\s*<[^>]*>\s*\([^)]*\)\s*=>\s*\(\s*\{[^}]*status:\s*['"](\w+)['"]/s);
    const initialState = initialMatch ? initialMatch[1] : null;

    // Find all .on('EventName') handlers with .when() and extract transitions
    const onHandlerRegex = /\.on\s*\(\s*['"](\w+)['"]\s*\)[\s\S]*?\.when\s*\(\s*(?:state|\w+)\s*=>\s*(?:state|\w+)\.status\s*===\s*['"](\w+)['"]\s*\)[\s\S]*?\.handle\s*\([\s\S]*?status:\s*['"](\w+)['"]/g;

    let match;
    while ((match = onHandlerRegex.exec(code)) !== null) {
      const [, eventName, fromState, toState] = match;
      const key = `${fromState}->${toState}:${eventName}`;

      if (!transitionSet.has(key)) {
        transitionSet.add(key);
        states.add(fromState);
        states.add(toState);

        const eventLower = eventName.toLowerCase();
        const isError = eventLower.includes('fail') ||
                        eventLower.includes('error') ||
                        eventLower.includes('cancel') ||
                        eventLower.includes('reject') ||
                        eventLower.includes('timeout');
        const isSuccess = eventLower.includes('success') ||
                          eventLower.includes('complete') ||
                          eventLower.includes('confirm') ||
                          eventLower.includes('captured') ||
                          eventLower.includes('reserved') ||
                          eventLower.includes('created') ||
                          eventLower.includes('delivered') ||
                          eventLower.includes('approved');

        transitions.push({
          from: fromState,
          to: toState,
          event: eventName,
          isError,
          isSuccess,
        });
      }
    }

    // Build nodes
    const stateArray = Array.from(states);
    let nodes: Node[] = stateArray.map((state) => {
      let status: string = 'active';
      if (state === initialState) status = 'initial';
      else if (state === 'completed' || state === 'success' || state === 'approved' || state === 'funded') status = 'success';
      else if (state === 'failed' || state === 'error' || state === 'cancelled' || state === 'declined' || state === 'rejected') status = 'error';
      else if (state === 'compensating' || state === 'retrying' || state === 'pending') status = 'warning';

      return {
        id: state,
        type: 'stateNode',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: { label: state, status },
      };
    });

    // Build edges
    let edges: Edge[] = transitions.map((t, index) => {
      let strokeColor = 'var(--flow-edge)';
      if (t.isError) strokeColor = 'var(--flow-error)';
      else if (t.isSuccess) strokeColor = 'var(--flow-success)';

      return {
        id: `e-${t.from}-${t.to}-${index}`,
        source: t.from,
        target: t.to,
        label: t.event,
        type: 'smoothstep',
        animated: t.isSuccess,
        style: { stroke: strokeColor, strokeWidth: 2 },
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

    if (nodes.length === 0) {
      return { nodes: [], edges: [], error: 'No states found. Define a status union type in your interface.' };
    }

    // Apply dagre layout
    const layouted = getLayoutedElements(nodes, edges, 'TB');
    return { nodes: layouted.nodes, edges: layouted.edges };
  } catch (e) {
    return { nodes: [], edges: [], error: (e as Error).message };
  }
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
  },
  style: { strokeWidth: 2 },
};

export default function LiveSagaEditor({
  initialDefinition = defaultDefinition,
  height = 600,
  title = 'Live Saga Editor',
}: LiveSagaEditorProps) {
  const [definition, setDefinition] = useState(initialDefinition);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Handle SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  const { nodes, edges } = useMemo(() => {
    const result = parseSagaDSL(definition);
    if (result.error) {
      setError(result.error);
      return { nodes: [], edges: [] };
    }
    setError(null);
    return result;
  }, [definition]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setDefinition(value);
    }
  }, []);

  return (
    <div className="live-saga-editor">
      {title && <div className="live-saga-editor-title">{title}</div>}
      <div
        className="live-saga-editor-content"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <div className="live-saga-editor-code">
          {isClient ? (
            <React.Suspense fallback={<div className="live-saga-editor-loading">Loading editor...</div>}>
              <MonacoEditor
                height="100%"
                language="typescript"
                theme="vs-dark"
                value={definition}
                onChange={handleEditorChange}
                beforeMount={(monaco) => {
                  // Disable TypeScript validation errors
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: false,
                  });
                  // Add saga-bus type declarations
                  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
                    declare function createSagaMachine<TState, TMessages>(): SagaBuilder<TState, TMessages>;
                    interface SagaBuilder<TState, TMessages> {
                      name(name: string): this;
                      correlate<T extends TMessages>(type: T['type'] | '*', fn: (msg: T) => string, opts?: { canStart?: boolean }): this;
                      initial<T extends TMessages>(fn: (msg: T) => TState): this;
                      on<T extends TMessages['type']>(type: T): HandlerBuilder<TState, TMessages>;
                      build(): SagaDefinition<TState, TMessages>;
                    }
                    interface HandlerBuilder<TState, TMessages> {
                      when(predicate: (state: TState) => boolean): this;
                      handle(handler: (msg: any, state: TState, ctx: SagaContext) => Promise<TState> | TState): SagaBuilder<TState, TMessages>;
                    }
                    interface SagaContext {
                      complete(): void;
                      publish(msg: { type: string; [key: string]: any }): void;
                      setTimeout(ms: number): void;
                    }
                    interface SagaDefinition<TState, TMessages> {}
                  `, 'saga-bus.d.ts');
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 10, bottom: 10 },
                  lineHeight: 20,
                  folding: true,
                  renderLineHighlight: 'line',
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            </React.Suspense>
          ) : (
            <div className="live-saga-editor-loading">Loading editor...</div>
          )}
          {error && <div className="live-saga-editor-error">{error}</div>}
        </div>
        <div className="live-saga-editor-diagram">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
            nodesDraggable={true}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--flow-grid)" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
      <div className="live-saga-editor-help">
        <strong>Pattern:</strong> <code>.when(state =&gt; state.status === 'from')</code> → <code>status: 'to'</code> in handler
      </div>
    </div>
  );
}
