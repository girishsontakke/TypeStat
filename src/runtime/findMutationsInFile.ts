import { Mutation } from "automutate";
import { EOL } from "os";

import { MutationsComplaint } from "../mutators/complaint";
import { FileMutationsRequest, FileMutator } from "../shared/fileMutator";
import { findFirstMutations } from "../shared/runtime";

/**
 * Collects all mutations that should apply to a file.
 */
export const findMutationsInFile = (
    request: FileMutationsRequest,
    mutators: ReadonlyArray<[string, FileMutator]>,
): ReadonlyArray<Mutation> | undefined => {
    let mutations = findFirstMutations(request, mutators);
    if (mutations instanceof MutationsComplaint) {
        request.options.output.stderr(
            `${EOL}Error in ${request.sourceFile.fileName} with ${mutations.mutatorPath.join(" > ")}: ${
                mutations.error.stack || mutations.error.message
            }${EOL}${EOL}`,
        );

        mutations = undefined;
    }

    return mutations;
};
