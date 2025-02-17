/* eslint-disable @typescript-eslint/unbound-method */
import * as fs from "mz/fs";
import * as path from "path";

import { requireExposedTypeScript } from "../mutations/createExposedTypeScript";
import { TypeStatOptions } from "../options/types";
import { collectOptionals, uniquify } from "../shared/arrays";
import { normalizeAndSlashify } from "../shared/paths";

export const createProgramConfiguration = (options: TypeStatOptions) => {
    const ts = requireExposedTypeScript();

    // Create a TypeScript configuration using the raw options
    const parsedConfiguration = ts.parseJsonConfigFileContent(
        {
            ...options.compilerOptions,
            skipLibCheck: true,
        },
        {
            fileExists: fs.existsSync,
            readDirectory: ts.sys.readDirectory,
            readFile: (file) => fs.readFileSync(file, "utf8"),
            useCaseSensitiveFileNames: true,
        },
        path.resolve(path.dirname(options.projectPath)),
        { noEmit: true },
    );

    // Include all possible file names in our program, including ones we won't later visit
    // TypeScript projects must include source files for all nodes we look at
    // See https://github.com/Microsoft/TypeScript/issues/28413
    const fileNames = uniquify(...Array.from(collectOptionals(options.fileNames, parsedConfiguration.fileNames)).map(normalizeAndSlashify));

    // Create a basic TypeScript compiler host and program using the parsed compiler options
    const host = ts.createCompilerHost({}, true);
    const program = ts.createProgram(fileNames, options.compilerOptions, host);

    return { fileNames, parsedConfiguration, program };
};
