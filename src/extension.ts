import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	console.log('activated');
	
	context.subscriptions.push(HOVER_DEFN);
}

const HOVER_DEFN = vscode.languages.registerHoverProvider(
	{ scheme: "file", language: "asm" },
	{
		provideHover(document, position, token) {
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range).toLowerCase();
			if(isOpcodeName(word) && OPCODES.has(word)) {
				return new vscode.Hover(OPCODES.get(word)!.markdownDesc);
			}
		},
	},
);

// address - m[x]
// location - pc := x
// constant - ac := x
// offset - m[sp + x]
type XMode = "address" | "location" | "constant" | "offset"

const opcodeNames = [
	"lodd",
	"stod",
	"addd",
	"subd",
	"jpos",
	"jzer",
	"jump",
	"loco",
	"lodl",
	"stol",
	"addl",
	"subl",
	"jneg",
	"jnze",
	"call",
	"pshi",
	"popi",
	"push",
	"pop",
	"retn",
	"swap",
	"insp",
	"desp",
	"halt",
] as const;

type OpcodeName = typeof opcodeNames[number];
function isOpcodeName(x: string): x is OpcodeName {
	return (opcodeNames as readonly string[]).indexOf(x) >= 0;
}

type Signature = {
	arg1?: Argument;
	arg2?: Argument;
};

class Argument {
	argName: string;
	xMode: XMode;
	desc: string;
	constructor(argName: string, mode: XMode) {
		this.argName = argName;
		this.xMode = mode;
		this.desc = `<${this.argName}: ${this.xMode}>`;
	}
};

class Opcode {
	name: OpcodeName;
	signature?: Signature;
	description: string;
	markdownDesc: vscode.MarkdownString;
	
	constructor(name: OpcodeName, description: string, signature?: Signature) {
		this.name = name;
		this.signature = signature;
		this.description = description;
		// Format description from signature
		if (this.signature?.arg1) {
			this.description = this.description.replace("$1", String.raw`\<${this.signature.arg1.argName}\>`);
		}
		if (this.signature?.arg2) {
			this.description = this.description.replace("$2", String.raw`\<${this.signature.arg2.argName}\>`);
		}
		
		// Generate markdownDesc
		let heading = this.name;
		if (this.signature?.arg1) {
			heading += ` ${this.signature?.arg1.desc}`;
		}
		if (this.signature?.arg2) {
			heading += ` ${this.signature?.arg2.desc}`;
		}
		this.markdownDesc = new vscode.MarkdownString()
			.appendCodeblock(heading, "asm")
			.appendMarkdown("\n --- \n") // insert horizontal rule
			.appendMarkdown(this.description);
	}
}

const OPCODES = new Map<OpcodeName, Opcode>([
	[
		"lodd",
		new Opcode("lodd", "Load direct\n\n`ac := m[x]`\n\n`0000xxxxxxxxxxxx`", {
			arg1: new Argument("x", "address")
		})
	],
	[
		"stod",
		new Opcode("stod", "Store direct\n\n`m[x] := ac`\n\n`0001xxxxxxxxxxxx`", {
			arg1: new Argument("x", "address")
		})
	],
	[
		"addd",
		new Opcode("addd", "Add direct\n\n`ac := ac + m[x]`\n\n`0010xxxxxxxxxxxx`", {
			arg1: new Argument("x", "address")
		})
	],
	[
		"subd",
		new Opcode("subd", "Subtract direct\n\n`ac := ac - m[x]`\n\n`0011xxxxxxxxxxxx`", {
			arg1: new Argument("x", "address")
		})
	],
	[
		"jpos",
		new Opcode("jpos", "Jump positive\n\n`if ac >= 0 then pc := x`\n\n`0100xxxxxxxxxxxx`", {
			arg1: new Argument("x", "location")
		})
	],
	[
		"jzer",
		new Opcode("jzer", "Jump zero\n\n`if ac = 0 then pc := x`\n\n`0101xxxxxxxxxxxx`", {
			arg1: new Argument("x", "location")
		})
	],
	[
		"jump",
		new Opcode("jump", "Jump\n\n`pc := x`\n\n`0110xxxxxxxxxxxx`", {
			arg1: new Argument("x", "location")
		})
	],
	[
		"loco",
		new Opcode("loco", "Load constant\n\n`ac := x (0 <= x <= 4095)`\n\n`0111xxxxxxxxxxxx`", {
			arg1: new Argument("x", "constant")
		})
	],
	[
		"lodl",
		new Opcode("lodl", "Load local\n\n`ac := m[sp + x]`\n\n`1000xxxxxxxxxxxx`", {
			arg1: new Argument("x", "offset")
		})
	],
	[
		"stol",
		new Opcode("stol", "Store local\n\n`m[x + sp] := ac`\n\n`1001xxxxxxxxxxxx`", {
			arg1: new Argument("x", "offset")
		})
	],
	[
		"addl",
		new Opcode("addl", "Add local\n\n`ac := ac + m[sp + x]`\n\n`1010xxxxxxxxxxxx`", {
			arg1: new Argument("x", "offset")
		})
	],
	[
		"subl",
		new Opcode("subl", "Subtract local\n\n`ac := ac - m[sp + x]`\n\n`1011xxxxxxxxxxxx`", {
			arg1: new Argument("x", "offset")
		})
	],
	[
		"jneg",
		new Opcode("jneg", "Jump negative\n\n`if ac < 0 then pc := x`\n\n`1100xxxxxxxxxxxx`", {
			arg1: new Argument("x", "location")
		})
	],
	[
		"jnze",
		new Opcode("jnze", "Jump nonzero\n\n`if ac != 0 then pc := x`\n\n`1101xxxxxxxxxxxx`", {
			arg1: new Argument("x", "location")
		})
	],
	[
		"call",
		new Opcode("call", "Call procedure\n\n`sp := sp - 1;`\n\n`m[sp] := pc;`\n\n`pc := x`\n\n`1110xxxxxxxxxxxx`", {
			arg1: new Argument("x", "location")
		})
	],
	[
		"pshi",
		new Opcode("pshi", "Push indirect\n\n`sp := sp - 1;`\n\n`m[sp] := m[ac]`\n\n`1111000000000000`")
	],
	[
		"popi",
		new Opcode("popi", "Pop indirect\n\n`m[ac] := m[sp];`\n\n`sp := sp + 1`\n\n`1111001000000000`")
	],
	[
		"push",
		new Opcode("push", "Push onto stack\n\n`sp := sp - 1;`\n\n`m[sp] := ac`\n\n`1111010000000000`")
	],
	[
		"pop",
		new Opcode("pop", "Pop from stack\n\n`ac := m[sp];`\n\n`sp := sp + 1`\n\n`1111011000000000`")
	],
	[
		"retn",
		new Opcode("retn", "Return\n\n`pc := m[sp];`\n\n`sp := sp + 1`\n\n`1111100000000000`")
	],
	[
		"swap",
		new Opcode("swap", "Swap ac, sp\n\n`tmp := ac;`\n\n`ac := sp;`\n\n`sp := tmp`\n\n`1111101000000000`")
	],
	[
		"insp",
		new Opcode("insp", "Increment sp\n\n`sp := sp + y (0 <= y <= 255)`\n\n`11111100yyyyyyyy`", {
			arg1: new Argument("y", "constant")
		})
	],
	[
		"desp",
		new Opcode("desp", "Decrement sp\n\n`sp := sp - y (0 <= y <= 255)`\n\n`11111110yyyyyyyy`")
	],
	[
		"halt",
		new Opcode("halt", "Go to debugger interface\n\n`1111111100000000`")
	],
]);

export function deactivate() {}
