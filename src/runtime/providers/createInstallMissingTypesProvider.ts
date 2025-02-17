import builtinModules from "builtin-modules";

import { setSubtract } from "../../shared/sets";
import { createFileNamesAndServices } from "../createFileNamesAndServices";
import { createSingleUseProvider } from "../createSingleUseProvider";

import { collectExistingTypingPackages } from "./missingTypes/collectExistingTypingPackages";
import { collectPackageManagerRunner } from "./missingTypes/collectPackageManagerRunner";
import { collectReferencedPackageNames } from "./missingTypes/collectReferencedPackageNames";
import { filterTypedPackageNames } from "./missingTypes/filterTypedPackageNames";

const uniqueBuiltinModules = new Set(builtinModules);

/**
 * Creates a mutations provider that installs missing types modules.
 *
 * @returns Provider to install missing types modules, if needed.
 */
export const createInstallMissingTypesProvider = () => {
    return createSingleUseProvider("Installing missing @types modules", (options) => {
        const { missingTypes } = options.package;
        if (missingTypes === undefined) {
            return undefined;
        }

        return async () => {
            await (async () => {
                // Collect package names already present in the package file
                const existingPackageNames = await collectExistingTypingPackages(options, options.package.file);
                if (existingPackageNames === undefined) {
                    return;
                }

                // Collect every package name referenced by every file in the project
                const { services } = createFileNamesAndServices(options);
                const referencedPackageNames = collectReferencedPackageNames(services);

                // Ignore package names already referenced in package.json or that don't exist in DefinitelyTyped
                const missingPackageNames = setSubtract(referencedPackageNames, new Set(existingPackageNames), uniqueBuiltinModules);
                const missingTypedPackageNames = await filterTypedPackageNames(Array.from(missingPackageNames));
                if (missingTypedPackageNames.length === 0) {
                    return;
                }

                // Run the installation command using the requested or detected package manager
                const packageManagerRunner = await collectPackageManagerRunner(options, missingTypes);
                await packageManagerRunner(options, missingTypedPackageNames);
            })();

            return {
                mutationsWave: {},
            };
        };
    });
};
