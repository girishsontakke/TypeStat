/* eslint-disable @typescript-eslint/unbound-method */
import * as fs from "mz/fs";
import * as ts from "typescript";

import { ExposedProgram } from "../mutations/createExposedTypeScript";
import { TypeStatOptions } from "../options/types";
import { arrayify, uniquify } from "../shared/arrays";
import { isIntrisinicNameType, WellKnownTypeName } from "../shared/typeNodes";

import { createProgramConfiguration } from "./createProgramConfiguration";

export type WellKnownTypes = Readonly<Record<WellKnownTypeName, Readonly<ts.Type>>>;

/**
 * Language service and type information with their backing TypeScript configuration.
 */
export interface LanguageServices {
    readonly languageService: ts.LanguageService;
    readonly parsedConfiguration: ts.ParsedCommandLine;
    readonly printers: Printers;
    readonly program: ExposedProgram;
    readonly wellKnownTypes: WellKnownTypes;
}

export interface Printers {
    readonly node: (node: ts.Node) => string;
    readonly type: (
        types: ts.Type | string | ReadonlyArray<ts.Type | string>,
        enclosingDeclaration?: ts.Node,
        typeFormatFlags?: ts.TypeFormatFlags,
    ) => string;
}

/**
 * @returns Associated language service and type information based on TypeStat options.
 */
export const createLanguageServices = (options: TypeStatOptions): LanguageServices => {
    // Collect file names and parse raw options into a TypeScript program with its configuration settings
    const { fileNames, parsedConfiguration, program } = createProgramConfiguration(options);

    // Create a TypeScript language service using the compiler host
    const servicesHost: ts.LanguageServiceHost = {
        fileExists: ts.sys.fileExists,
        getCompilationSettings: () => options.compilerOptions,
        getCurrentDirectory: () => options.package.directory,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        getScriptFileNames: () => fileNames,
        getScriptSnapshot: (fileName) =>
            fs.existsSync(fileName) ? ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString()) : undefined,
        getScriptVersion: () => "0",
        readDirectory: ts.sys.readDirectory,
        readFile: ts.sys.readFile,
    };
    const languageService = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

    // This printer will later come in handy for emitting raw ASTs to text
    const printer = ts.createPrinter({
        newLine: options.compilerOptions.newLine,
    });
    const printers: Printers = {
        node(node) {
            return printer.printNode(
                ts.EmitHint.Unspecified,
                node,
                ts.createSourceFile("temp.ts", "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX),
            );
        },
        type(types, enclosingDeclaration, typeFormatFlags) {
            const typeChecker = program.getTypeChecker();
            return uniquify(
                ...arrayify(types).map((type) =>
                    typeof type === "string"
                        ? type
                        : typeChecker.typeToString(
                              // Our mutations generally always go for base primitives, not literals
                              // This might need to be revisited for potential future high fidelity types...
                              typeChecker.getBaseTypeOfLiteralType(type),
                              enclosingDeclaration,
                              typeFormatFlags,
                          ),
                ),
            ).join(" | ");
        },
    };

    let wellKnownTypes: WellKnownTypes | undefined;

    return {
        languageService,
        parsedConfiguration,
        program,
        printers,
        get wellKnownTypes(): WellKnownTypes {
            return (wellKnownTypes ??= program.getTypeCatalog().reduce((acc, type) => {
                if (isIntrisinicNameType(type)) {
                    acc[type.intrinsicName] = type;
                }

                return acc;
            }, {} as Record<WellKnownTypeName, ts.Type>));
        },
    };
};
