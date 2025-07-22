import { IMolangExpression } from "./IMolangExpression";
import IMolangNode, { MolangNodeType } from "./IMolangNode";
import MolangNode from "./MolangNode";

// NOTE NOTE: I tried to call this MolangExpression but it was giving errors in the vscbuild process
export default class Molang {
  _data: IMolangExpression;

  constructor(molang: string) {
    const node = this.parse(molang);
    this._data = { rootNode: node.data };
  }

  parse(molangExpression: string): MolangNode {
    const tokens = this.tokenize(molangExpression);
    const syntaxTree = this.parseTokens(tokens);

    return syntaxTree;
  }

  private tokenize(expression: string): string[] {
    // Simple tokenizer splitting by spaces and operators
    return expression.match(/(\d+|\w+|[()+\-/])/g) || [];
  }

  private parseTokens(tokens: string[]): MolangNode {
    const stack: MolangNode[] = [];
    const operators: string[] = [];

    const precedence: { [key: string]: number } = {
      "+": 1,
      "-": 1,
      "*": 2,
      "/": 2,
    };

    const operatorSet = new Set(["+", "-", "*", "/"]);

    const applyOperator = () => {
      const operator = operators.pop();
      const right = stack.pop();
      const left = stack.pop();

      const node: IMolangNode = {
        type: MolangNodeType.operator,
        value: operator,
        left: left?.data,
        right: right?.data,
      };

      stack.push(new MolangNode(node));
    };

    for (const token of tokens) {
      if (/\d+/.test(token)) {
        stack.push(new MolangNode({ type: MolangNodeType.number, value: token }));
      } else if (/\w+/.test(token)) {
        stack.push(new MolangNode({ type: MolangNodeType.variable, value: token }));
      } else if (token === "(") {
        operators.push(token);
      } else if (token === ")") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          applyOperator();
        }
        operators.pop(); // Remove '('
      } else if (operatorSet.has(token)) {
        while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) {
          applyOperator();
        }
        operators.push(token);
      }
    }

    while (operators.length) {
      applyOperator();
    }

    return stack[0];
  }
}
