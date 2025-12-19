---
sidebar_position: 5
title: Flow Visualizer
---

# Saga Flow Visualizer

Interactive visualizations of saga definitions with side-by-side code.

## Order Saga

export const orderNodes = [
  { id: 'start', type: 'stateNode', position: { x: 200, y: 0 }, data: { label: 'OrderSubmitted', status: 'initial' } },
  { id: 'pending', type: 'stateNode', position: { x: 200, y: 80 }, data: { label: 'pending', status: 'active' } },
  { id: 'paid', type: 'stateNode', position: { x: 300, y: 160 }, data: { label: 'paid', status: 'success' } },
  { id: 'failed', type: 'stateNode', position: { x: 100, y: 160 }, data: { label: 'failed', status: 'error' } },
  { id: 'reserved', type: 'stateNode', position: { x: 300, y: 240 }, data: { label: 'reserved', status: 'success' } },
  { id: 'compensating', type: 'stateNode', position: { x: 100, y: 240 }, data: { label: 'compensating', status: 'warning' } },
  { id: 'completed', type: 'stateNode', position: { x: 300, y: 320 }, data: { label: 'completed', status: 'success' } },
];

export const orderEdges = [
  { id: 'e1', source: 'start', target: 'pending', animated: true },
  { id: 'e2', source: 'pending', target: 'paid', label: 'PaymentCaptured', data: { type: 'success' } },
  { id: 'e3', source: 'pending', target: 'failed', label: 'PaymentFailed', data: { type: 'error' } },
  { id: 'e4', source: 'paid', target: 'reserved', label: 'InventoryReserved', data: { type: 'success' } },
  { id: 'e5', source: 'paid', target: 'compensating', label: 'InventoryFailed', data: { type: 'error' } },
  { id: 'e6', source: 'compensating', target: 'failed' },
  { id: 'e7', source: 'reserved', target: 'completed', label: 'ShipmentCreated', data: { type: 'success' } },
];

export const orderCode = `const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('*', msg => msg.orderId)

  .initial<OrderSubmitted>(msg => ({
    orderId: msg.orderId,
    status: 'pending',
    items: msg.items,
  }))

  .on('PaymentCaptured')
    .when(state => state.status === 'pending')
    .handle(async (msg, state, ctx) => ({
      ...state,
      status: 'paid',
      transactionId: msg.transactionId,
    }))

  .on('PaymentFailed')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'failed' };
    })

  .on('InventoryReserved')
    .when(state => state.status === 'paid')
    .handle(async (msg, state) => ({
      ...state,
      status: 'reserved',
      reservationId: msg.reservationId,
    }))

  .on('InventoryFailed')
    .when(state => state.status === 'paid')
    .handle(async (msg, state, ctx) => {
      ctx.publish({ type: 'RefundPayment', ... });
      return { ...state, status: 'compensating' };
    })

  .on('ShipmentCreated')
    .when(state => state.status === 'reserved')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'completed' };
    })

  .build();`;

<SagaFlowViewer
  nodes={orderNodes}
  edges={orderEdges}
  code={orderCode}
  title="Order Saga: E-commerce Flow"
  height={420}
/>

## Payment Processing

export const paymentNodes = [
  { id: 'req', type: 'stateNode', position: { x: 200, y: 0 }, data: { label: 'PaymentRequested', status: 'initial' } },
  { id: 'validating', type: 'serviceNode', position: { x: 200, y: 80 }, data: { label: 'Validating', type: 'service' } },
  { id: 'charging', type: 'serviceNode', position: { x: 300, y: 160 }, data: { label: 'Charging', type: 'external' } },
  { id: 'declined', type: 'stateNode', position: { x: 100, y: 160 }, data: { label: 'Declined', status: 'error' } },
  { id: 'captured', type: 'stateNode', position: { x: 300, y: 240 }, data: { label: 'Captured', status: 'success' } },
  { id: 'retrying', type: 'stateNode', position: { x: 100, y: 240 }, data: { label: 'Retrying', status: 'warning' } },
];

export const paymentEdges = [
  { id: 'p1', source: 'req', target: 'validating', animated: true },
  { id: 'p2', source: 'validating', target: 'charging', label: 'Valid', data: { type: 'success' } },
  { id: 'p3', source: 'validating', target: 'declined', label: 'Invalid', data: { type: 'error' } },
  { id: 'p4', source: 'charging', target: 'captured', label: 'Success', data: { type: 'success' } },
  { id: 'p5', source: 'charging', target: 'retrying', label: 'Transient Error', data: { type: 'error' } },
  { id: 'p6', source: 'retrying', target: 'charging', label: 'Retry' },
];

export const paymentCode = `const paymentSaga = createSagaMachine<PaymentState, PaymentMessages>()
  .name('PaymentSaga')
  .correlate('PaymentRequested', msg => msg.paymentId, { canStart: true })

  .initial<PaymentRequested>(msg => ({
    paymentId: msg.paymentId,
    amount: msg.amount,
    status: 'validating',
    retryCount: 0,
  }))

  .on('CardValidated')
    .when(state => state.status === 'validating')
    .handle(async (msg, state, ctx) => {
      ctx.publish({ type: 'ChargeCard', ... });
      return { ...state, status: 'charging' };
    })

  .on('CardDeclined')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'declined' };
    })

  .on('ChargeSucceeded')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'captured' };
    })

  .on('ChargeFailed')
    .when(state => state.retryCount < 3)
    .handle(async (msg, state, ctx) => {
      ctx.setTimeout(5000); // Retry in 5s
      return {
        ...state,
        status: 'retrying',
        retryCount: state.retryCount + 1
      };
    })

  .build();`;

<SagaFlowViewer
  nodes={paymentNodes}
  edges={paymentEdges}
  code={paymentCode}
  title="Payment Saga: Card Processing"
  height={350}
/>

## Multi-Service Orchestration

export const orchestrationNodes = [
  { id: 'trigger', type: 'stateNode', position: { x: 250, y: 0 }, data: { label: 'WorkflowTriggered', status: 'initial' } },
  { id: 'svc1', type: 'serviceNode', position: { x: 100, y: 100 }, data: { label: 'Service A', type: 'service' } },
  { id: 'svc2', type: 'serviceNode', position: { x: 250, y: 100 }, data: { label: 'Service B', type: 'database' } },
  { id: 'svc3', type: 'serviceNode', position: { x: 400, y: 100 }, data: { label: 'Service C', type: 'external' } },
  { id: 'a_done', type: 'stateNode', position: { x: 100, y: 200 }, data: { label: 'A Complete', status: 'success' } },
  { id: 'b_done', type: 'stateNode', position: { x: 250, y: 200 }, data: { label: 'B Complete', status: 'success' } },
  { id: 'c_done', type: 'stateNode', position: { x: 400, y: 200 }, data: { label: 'C Complete', status: 'success' } },
  { id: 'aggregate', type: 'decisionNode', position: { x: 250, y: 300 }, data: { label: 'All Done?', condition: 'count === 3' } },
  { id: 'complete', type: 'stateNode', position: { x: 250, y: 400 }, data: { label: 'Workflow Complete', status: 'success' } },
];

export const orchestrationEdges = [
  { id: 'o1', source: 'trigger', target: 'svc1', animated: true },
  { id: 'o2', source: 'trigger', target: 'svc2', animated: true },
  { id: 'o3', source: 'trigger', target: 'svc3', animated: true },
  { id: 'o4', source: 'svc1', target: 'a_done', data: { type: 'success' } },
  { id: 'o5', source: 'svc2', target: 'b_done', data: { type: 'success' } },
  { id: 'o6', source: 'svc3', target: 'c_done', data: { type: 'success' } },
  { id: 'o7', source: 'a_done', target: 'aggregate' },
  { id: 'o8', source: 'b_done', target: 'aggregate' },
  { id: 'o9', source: 'c_done', target: 'aggregate' },
  { id: 'o10', source: 'aggregate', target: 'complete', label: 'Yes', data: { type: 'success' } },
];

export const orchestrationCode = `const workflowSaga = createSagaMachine<WorkflowState, WorkflowMessages>()
  .name('OrchestratorSaga')
  .correlate('WorkflowTriggered', msg => msg.workflowId, { canStart: true })
  .correlate('*', msg => msg.workflowId)

  .initial<WorkflowTriggered>(msg => ({
    workflowId: msg.workflowId,
    completedServices: [],
    status: 'running',
  }))

  // Fan out to all services in parallel
  .on('WorkflowTriggered')
    .handle(async (msg, state, ctx) => {
      // Publish to all services concurrently
      ctx.publish({ type: 'InvokeServiceA', workflowId: msg.workflowId });
      ctx.publish({ type: 'InvokeServiceB', workflowId: msg.workflowId });
      ctx.publish({ type: 'InvokeServiceC', workflowId: msg.workflowId });
      return state;
    })

  // Collect responses from each service
  .on('ServiceACompleted')
    .handle(async (msg, state, ctx) => {
      const updated = {
        ...state,
        completedServices: [...state.completedServices, 'A'],
      };
      return checkCompletion(updated, ctx);
    })

  .on('ServiceBCompleted')
    .handle(async (msg, state, ctx) => {
      const updated = {
        ...state,
        completedServices: [...state.completedServices, 'B'],
      };
      return checkCompletion(updated, ctx);
    })

  .on('ServiceCCompleted')
    .handle(async (msg, state, ctx) => {
      const updated = {
        ...state,
        completedServices: [...state.completedServices, 'C'],
      };
      return checkCompletion(updated, ctx);
    })

  .build();

function checkCompletion(state, ctx) {
  if (state.completedServices.length === 3) {
    ctx.publish({ type: 'WorkflowCompleted', ... });
    ctx.complete();
    return { ...state, status: 'completed' };
  }
  return state;
}`;

<SagaFlowViewer
  nodes={orchestrationNodes}
  edges={orchestrationEdges}
  code={orchestrationCode}
  title="Orchestrator: Parallel Service Coordination"
  height={500}
/>

## Key Patterns Demonstrated

| Pattern | Description | Example |
|---------|-------------|---------|
| **State Guards** | `.when()` prevents handlers from running in wrong state | Order saga checks status before transitioning |
| **Compensation** | Undo operations on failure | RefundPayment on inventory failure |
| **Fan-out/Fan-in** | Parallel operations with aggregation | Orchestrator invokes 3 services, waits for all |
| **Retry with Backoff** | Handle transient failures | Payment retries up to 3 times |
| **Timeout Handling** | Set deadlines for expected events | Payment sets 5s retry timeout |

## Interactive Features

The flow diagrams above are fully interactive:

- **Pan & Zoom** - Drag to pan, scroll to zoom
- **Node Selection** - Click nodes to highlight them
- **Minimap** - Large diagrams show a navigation minimap
- **Animated Edges** - Watch the flow of data through the system

## See Also

- [Order Saga](/docs/examples/order-saga) - Complete implementation
- [Common Patterns](/docs/examples/patterns) - More pattern examples
- [DSL Reference](/docs/dsl-reference/overview) - Full API documentation
