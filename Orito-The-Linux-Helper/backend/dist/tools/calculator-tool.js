/**
 * Safe calculator tool - uses a custom expression parser instead of eval/new Function
 * This prevents code injection attacks
 */
/**
 * Allowed math functions with their implementations
 */
const MATH_FUNCTIONS = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    log: Math.log,
    log2: Math.log2,
    log10: Math.log10,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
    exp: Math.exp,
    sign: Math.sign,
    trunc: Math.trunc,
};
/**
 * Constants that can be used in expressions
 */
const CONSTANTS = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
};
/**
 * Tokenize the expression string
 */
function tokenize(expression) {
    const tokens = [];
    let i = 0;
    const expr = expression.toLowerCase();
    while (i < expr.length) {
        const char = expr[i];
        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        // Numbers (including decimals)
        if (/\d/.test(char) || (char === '.' && /\d/.test(expr[i + 1]))) {
            let num = '';
            while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
                num += expr[i];
                i++;
            }
            tokens.push({ type: 'NUMBER', value: parseFloat(num) });
            continue;
        }
        // Operators
        if (['+', '-', '*', '/', '%', '^'].includes(char)) {
            tokens.push({ type: 'OPERATOR', value: char });
            i++;
            continue;
        }
        // Parentheses
        if (char === '(') {
            tokens.push({ type: 'LPAREN', value: '(' });
            i++;
            continue;
        }
        if (char === ')') {
            tokens.push({ type: 'RPAREN', value: ')' });
            i++;
            continue;
        }
        // Comma for function arguments
        if (char === ',') {
            tokens.push({ type: 'COMMA', value: ',' });
            i++;
            continue;
        }
        // Identifiers (functions and constants)
        if (/[a-z_]/.test(char)) {
            let name = '';
            while (i < expr.length && /[a-z0-9_]/.test(expr[i])) {
                name += expr[i];
                i++;
            }
            // Check if it's a function (followed by parenthesis)
            if (expr[i] === '(') {
                if (!MATH_FUNCTIONS[name]) {
                    throw new Error(`Unknown function: ${name}`);
                }
                tokens.push({ type: 'FUNCTION', value: name });
            }
            else {
                // It's a constant or identifier
                if (CONSTANTS[name] !== undefined) {
                    tokens.push({ type: 'NUMBER', value: CONSTANTS[name] });
                }
                else {
                    throw new Error(`Unknown identifier: ${name}`);
                }
            }
            continue;
        }
        throw new Error(`Invalid character: ${char}`);
    }
    tokens.push({ type: 'EOF', value: '' });
    return tokens;
}
/**
 * Recursive descent parser for mathematical expressions
 * Implements operator precedence: parentheses > functions > exponentiation > multiplication/division > addition/subtraction
 */
class ExpressionParser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    current() {
        return this.tokens[this.pos];
    }
    consume(type) {
        const token = this.current();
        if (token.type !== type) {
            throw new Error(`Expected ${type}, got ${token.type}`);
        }
        this.pos++;
        return token;
    }
    /**
     * Parse the full expression
     */
    parse() {
        const result = this.parseExpression();
        if (this.current().type !== 'EOF') {
            throw new Error('Unexpected token after expression');
        }
        return result;
    }
    /**
     * Parse addition and subtraction (lowest precedence)
     */
    parseExpression() {
        let left = this.parseTerm();
        while (this.current().type === 'OPERATOR' &&
            (this.current().value === '+' || this.current().value === '-')) {
            const op = this.consume('OPERATOR').value;
            const right = this.parseTerm();
            if (op === '+') {
                left = left + right;
            }
            else {
                left = left - right;
            }
        }
        return left;
    }
    /**
     * Parse multiplication, division, and modulo
     */
    parseTerm() {
        let left = this.parsePower();
        while (this.current().type === 'OPERATOR' &&
            (this.current().value === '*' || this.current().value === '/' || this.current().value === '%')) {
            const op = this.consume('OPERATOR').value;
            const right = this.parsePower();
            if (op === '*') {
                left = left * right;
            }
            else if (op === '/') {
                if (right === 0) {
                    throw new Error('Division by zero');
                }
                left = left / right;
            }
            else {
                left = left % right;
            }
        }
        return left;
    }
    /**
     * Parse exponentiation (right associative)
     */
    parsePower() {
        let base = this.parseUnary();
        if (this.current().type === 'OPERATOR' && this.current().value === '^') {
            this.consume('OPERATOR');
            const exponent = this.parsePower(); // Right associative
            return Math.pow(base, exponent);
        }
        return base;
    }
    /**
     * Parse unary operators (+ and -)
     */
    parseUnary() {
        if (this.current().type === 'OPERATOR' &&
            (this.current().value === '+' || this.current().value === '-')) {
            const op = this.consume('OPERATOR').value;
            const operand = this.parseUnary();
            return op === '-' ? -operand : operand;
        }
        return this.parsePrimary();
    }
    /**
     * Parse primary expressions (numbers, parentheses, functions)
     */
    parsePrimary() {
        const token = this.current();
        // Number
        if (token.type === 'NUMBER') {
            this.pos++;
            return token.value;
        }
        // Parenthesized expression
        if (token.type === 'LPAREN') {
            this.consume('LPAREN');
            const result = this.parseExpression();
            this.consume('RPAREN');
            return result;
        }
        // Function call
        if (token.type === 'FUNCTION') {
            const funcName = this.consume('FUNCTION').value;
            this.consume('LPAREN');
            const args = [];
            if (this.current().type !== 'RPAREN') {
                args.push(this.parseExpression());
                while (this.current().type === 'COMMA') {
                    this.consume('COMMA');
                    args.push(this.parseExpression());
                }
            }
            this.consume('RPAREN');
            const func = MATH_FUNCTIONS[funcName];
            if (!func) {
                throw new Error(`Unknown function: ${funcName}`);
            }
            return func(...args);
        }
        throw new Error(`Unexpected token: ${token.type} (${token.value})`);
    }
}
/**
 * Safe calculate function using custom parser
 */
export function calculate(expression) {
    try {
        // Basic input validation
        if (!expression || typeof expression !== 'string') {
            return { expression: expression || '', result: 0, error: 'Invalid expression' };
        }
        // Length limit
        if (expression.length > 1000) {
            return { expression, result: 0, error: 'Expression too long (max 1000 characters)' };
        }
        // Check for dangerous patterns (defense in depth)
        const dangerPatterns = /\b(eval|function|return|import|require|process|window|document|fetch|XMLHttpRequest|setTimeout|setInterval|constructor|prototype|__proto__)\b/i;
        if (dangerPatterns.test(expression)) {
            return { expression, result: 0, error: 'Blocked: unsafe expression' };
        }
        // Tokenize
        const tokens = tokenize(expression);
        // Parse and evaluate
        const parser = new ExpressionParser(tokens);
        const result = parser.parse();
        // Validate result
        if (typeof result !== 'number' || !isFinite(result)) {
            return {
                expression,
                result: String(result),
                error: result === Infinity || result === -Infinity ? 'Result is infinity' : 'Invalid result'
            };
        }
        // Round to avoid floating point precision issues
        return { expression, result: Math.round(result * 1e12) / 1e12 };
    }
    catch (err) {
        return { expression, result: 0, error: err.message || 'Calculation error' };
    }
}
/**
 * Unit conversion functions
 */
export function convertUnits(value, from, to) {
    // Input validation
    if (typeof value !== 'number' || !isFinite(value)) {
        return { expression: `${value} ${from} to ${to}`, result: 0, error: 'Invalid value' };
    }
    const ratios = {
        bytes: { kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 },
        kb: { bytes: 1 / 1024, mb: 1024, gb: 1048576, tb: 1073741824 },
        mb: { bytes: 1 / 1048576, kb: 1 / 1024, gb: 1024, tb: 1048576 },
        gb: { bytes: 1 / 1073741824, kb: 1 / 1048576, mb: 1 / 1024, tb: 1024 },
    };
    const lengthRatios = {
        cm: { m: 0.01, km: 0.00001, in: 0.393701, ft: 0.0328084, mi: 0.00000621371 },
        m: { cm: 100, km: 0.001, in: 39.3701, ft: 3.28084, mi: 0.000621371 },
        km: { cm: 100000, m: 1000, in: 39370.1, ft: 3280.84, mi: 0.621371 },
        in: { cm: 2.54, m: 0.0254, km: 0.0000254, ft: 0.0833333, mi: 0.0000157828 },
        ft: { cm: 30.48, m: 0.3048, km: 0.0003048, in: 12, mi: 0.000189394 },
        mi: { cm: 160934, m: 1609.34, km: 1.60934, in: 63360, ft: 5280 },
    };
    const tempFns = {
        c: { f: (v) => v * 9 / 5 + 32, k: (v) => v + 273.15 },
        f: { c: (v) => (v - 32) * 5 / 9, k: (v) => (v - 32) * 5 / 9 + 273.15 },
        k: { c: (v) => v - 273.15, f: (v) => (v - 273.15) * 9 / 5 + 32 },
    };
    const fromKey = from.toLowerCase();
    const toKey = to.toLowerCase();
    // Same unit
    if (fromKey === toKey) {
        return { expression: `${value} ${from} to ${to}`, result: value };
    }
    // Temperature conversions
    if (tempFns[fromKey]?.[toKey]) {
        return { expression: `${value} ${from} to ${to}`, result: tempFns[fromKey][toKey](value) };
    }
    // Data storage conversions
    if (ratios[fromKey]?.[toKey]) {
        return { expression: `${value} ${from} to ${to}`, result: value * ratios[fromKey][toKey] };
    }
    // Length conversions
    if (lengthRatios[fromKey]?.[toKey]) {
        return { expression: `${value} ${from} to ${to}`, result: value * lengthRatios[fromKey][toKey] };
    }
    return { expression: `${value} ${from} to ${to}`, result: 0, error: `Unknown conversion: ${from} to ${to}` };
}
//# sourceMappingURL=calculator-tool.js.map