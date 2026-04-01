// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MolangHover - Hover content for Molang expressions
 */

import { IHoverContent } from "../json/JsonHoverContent";
import { MOLANG_QUERIES, MOLANG_MATH, molangParser } from "./MolangParser";

/**
 * Generate Molang hover content
 */
export class MolangHoverGenerator {
  /**
   * Generate hover for an expression at a position
   */
  public generateHover(expression: string, offset: number): IHoverContent | null {
    const context = molangParser.getCursorContext(expression, offset);

    if (!context.tokenAtCursor) {
      return null;
    }

    const token = context.tokenAtCursor;

    switch (token.type) {
      case "query":
        return this.generateQueryHover(token.fullIdentifier || token.value);
      case "math":
        return this.generateMathHover(token.fullIdentifier || token.value);
      case "variable":
        return this.generateVariableHover(token.fullIdentifier || token.value);
      case "temp":
        return this.generateTempHover(token.fullIdentifier || token.value);
      case "context":
        return this.generateContextHover(token.fullIdentifier || token.value);
      case "keyword":
        return this.generateKeywordHover(token.value);
      case "operator":
        return this.generateOperatorHover(token.value);
      default:
        return null;
    }
  }

  /**
   * Generate hover for a query
   */
  private generateQueryHover(queryName: string): IHoverContent | null {
    // Normalize to full form
    const normalized = queryName.startsWith("q.") ? queryName.replace("q.", "query.") : queryName;

    const queryInfo = MOLANG_QUERIES.find((q) => q.name === normalized);

    if (!queryInfo) {
      // Unknown query
      return {
        sections: [{ markdown: `### ${queryName}\n\n*Unknown query*` }],
      };
    }

    return {
      sections: [
        {
          markdown: [`### ${queryInfo.name}`, "", queryInfo.description, "", `**Returns:** ${queryInfo.returns}`].join(
            "\n"
          ),
        },
        {
          markdown: `*Short form: \`${queryInfo.name.replace("query.", "q.")}\`*`,
        },
      ],
    };
  }

  /**
   * Generate hover for a math function
   */
  private generateMathHover(mathName: string): IHoverContent | null {
    const mathInfo = MOLANG_MATH.find((m) => mathName.startsWith(m.name));

    if (!mathInfo) {
      return {
        sections: [{ markdown: `### ${mathName}\n\n*Unknown math function*` }],
      };
    }

    return {
      sections: [
        {
          markdown: [`### ${mathInfo.name}`, "", mathInfo.description, "", `**Syntax:** \`${mathInfo.syntax}\``].join(
            "\n"
          ),
        },
      ],
    };
  }

  /**
   * Generate hover for a variable
   */
  private generateVariableHover(variableName: string): IHoverContent {
    const normalized = variableName.startsWith("v.") ? variableName.replace("v.", "variable.") : variableName;

    return {
      sections: [
        {
          markdown: [
            `### ${normalized}`,
            "",
            "**Entity Variable**",
            "",
            "Persistent variable stored on the entity. Survives between ticks and can be read/written by any component.",
            "",
            "*Variables are reset when the entity is unloaded.*",
          ].join("\n"),
        },
        {
          markdown: [
            "**Usage:**",
            "```",
            "// Set value",
            `${normalized} = 1.0;`,
            "",
            "// Read value",
            `query.is_baby ? ${normalized} : 0`,
            "```",
          ].join("\n"),
        },
      ],
    };
  }

  /**
   * Generate hover for a temp variable
   */
  private generateTempHover(tempName: string): IHoverContent {
    const normalized = tempName.startsWith("t.") ? tempName.replace("t.", "temp.") : tempName;

    return {
      sections: [
        {
          markdown: [
            `### ${normalized}`,
            "",
            "**Temporary Variable**",
            "",
            "Scoped to the current expression/context. Use for intermediate calculations.",
            "",
            "*Temp variables are cleared after the expression completes.*",
          ].join("\n"),
        },
        {
          markdown: [
            "**Usage:**",
            "```",
            `${normalized} = math.sin(query.anim_time * 360);`,
            `${normalized} * 10`,
            "```",
          ].join("\n"),
        },
      ],
    };
  }

  /**
   * Generate hover for context
   */
  private generateContextHover(contextName: string): IHoverContent {
    const contexts: { [key: string]: string } = {
      "context.other": "The other entity involved in an interaction (e.g., the attacker when being damaged)",
      "c.other": "Short form of context.other",
      "context.item_slot": "The item slot being accessed",
      "context.block_face": "The face of the block being interacted with",
    };

    const desc = contexts[contextName] || "Context variable for interaction data";

    return {
      sections: [
        {
          markdown: [`### ${contextName}`, "", "**Context Variable**", "", desc].join("\n"),
        },
      ],
    };
  }

  /**
   * Generate hover for a keyword
   */
  private generateKeywordHover(keyword: string): IHoverContent {
    const keywords: { [key: string]: { description: string; example: string } } = {
      return: {
        description: "Returns a value from a Molang expression",
        example: "return query.is_baby ? 1.0 : 0.5;",
      },
      loop: {
        description: "Loops a specified number of times",
        example: "loop(10, { v.counter = v.counter + 1; });",
      },
      for_each: {
        description: "Iterates over array elements",
        example: "for_each(v.item, array.items, { ... });",
      },
      break: {
        description: "Exits a loop early",
        example: "loop(10, { v.i > 5 ? break : 0; });",
      },
      continue: {
        description: "Skips to next loop iteration",
        example: "loop(10, { v.skip ? continue : v.sum = v.sum + 1; });",
      },
      this: {
        description: "Reference to the current entity/context",
        example: "this",
      },
    };

    const info = keywords[keyword.toLowerCase()];
    if (!info) {
      return { sections: [{ markdown: `### ${keyword}\n\n*Molang keyword*` }] };
    }

    return {
      sections: [
        {
          markdown: [`### ${keyword}`, "", info.description].join("\n"),
        },
        {
          markdown: `**Example:**\n\`\`\`\n${info.example}\n\`\`\``,
        },
      ],
    };
  }

  /**
   * Generate hover for an operator
   */
  private generateOperatorHover(operator: string): IHoverContent | null {
    const operators: { [key: string]: string } = {
      "+": "Addition",
      "-": "Subtraction / Negation",
      "*": "Multiplication",
      "/": "Division",
      "%": "Modulo (remainder)",
      "==": "Equal to",
      "!=": "Not equal to",
      "<": "Less than",
      "<=": "Less than or equal",
      ">": "Greater than",
      ">=": "Greater than or equal",
      "&&": "Logical AND",
      "||": "Logical OR",
      "!": "Logical NOT",
      "?": "Ternary conditional (condition ? true : false)",
      "??": "Null coalescing (value ?? default)",
      "->": "Arrow operator (lambda/function reference)",
    };

    const desc = operators[operator];
    if (!desc) {
      return null;
    }

    return {
      sections: [{ markdown: `### \`${operator}\`\n\n${desc}` }],
    };
  }
}

// Singleton instance
export const molangHoverGenerator = new MolangHoverGenerator();
