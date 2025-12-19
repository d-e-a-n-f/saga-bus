import StateNode from './StateNode';
import ServiceNode from './ServiceNode';
import DecisionNode from './DecisionNode';

export const nodeTypes = {
  state: StateNode,
  service: ServiceNode,
  decision: DecisionNode,
};

export { StateNode, ServiceNode, DecisionNode };
export type { StateNodeData } from './StateNode';
export type { ServiceNodeData } from './ServiceNode';
export type { DecisionNodeData } from './DecisionNode';
