/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { nodeTagger } from "@atomist/spring-automation/commands/tag/nodeTagger";
import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
} from "@atomist/sdm/blueprint/SoftwareDeliveryMachine";
import { executeTag } from "@atomist/sdm/common/delivery/build/executeTag";
import { NodeProjectVersioner } from "@atomist/sdm/common/delivery/build/local/npm/nodeProjectVersioner";
import {
    executeVersioner,
} from "@atomist/sdm/common/delivery/build/local/projectVersioner";
import { tslintFix } from "@atomist/sdm/common/delivery/code/autofix/node/tslint";
import {
    DefaultDockerImageNameCreator,
    executeDockerBuild,
} from "@atomist/sdm/common/delivery/docker/executeDockerBuild";
import {
    DockerBuildGoal,
    TagGoal,
    VersionGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import {
    ProductionDockerDeploymentGoal,
    StagingDockerDeploymentGoal,
} from "@atomist/sdm/common/delivery/goals/common/npmGoals";
import { IsNode } from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { tagRepo } from "@atomist/sdm/common/listener/support/tagRepo";
import { nodeGenerator } from "../../commands/generators/node/nodeGenerator";
import { CommonGeneratorConfig } from "../../machines/generatorConfig";
import { CommonTypeScriptErrors } from "../team/commonTypeScriptErrors";
import { DockerOptions } from "@atomist/sdm/common/delivery/docker/executeDockerBuild";
import { AddBuildScript } from "../../blueprint/code/autofix/addBuildScript";
import { AddAtomistTypeScriptHeader } from "../../blueprint/code/autofix/addAtomistHeader";

/**
 * Configuration common to Node SDMs, wherever they deploy
 * @param {SoftwareDeliveryMachine} sdm
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine,
                               options: SoftwareDeliveryMachineOptions & DockerOptions) {
    sdm.addGenerators(() => nodeGenerator({
            ...CommonGeneratorConfig,
            seedRepo: "typescript-express-seed",
            intent: "create node",
        }))
        .addGenerators(() => nodeGenerator({
            ...CommonGeneratorConfig,
            seedRepo: "minimal-node-seed",
            intent: "create minimal node",
        }))
        .addNewRepoWithCodeActions(
            tagRepo(nodeTagger),
        )
        .addAutofixes(
            AddAtomistTypeScriptHeader,
            tslintFix,
            AddBuildScript,
        )
    .addReviewerRegistrations(CommonTypeScriptErrors)
    .addGoalImplementation("nodeVersioner", VersionGoal,
        executeVersioner(options.projectLoader, NodeProjectVersioner))
    .addGoalImplementation("nodeDockerBuild", DockerBuildGoal,
        executeDockerBuild(options.projectLoader, DefaultDockerImageNameCreator, options))
    .addGoalImplementation("nodeTag", TagGoal,
        executeTag(options.projectLoader));

    sdm.goalFulfillmentMapper.addSideEffect({
        goal: StagingDockerDeploymentGoal,
        pushTest: IsNode,
        sideEffectName: "@atomist/k8-automation",
    }).addSideEffect({
        goal: ProductionDockerDeploymentGoal,
        pushTest: IsNode,
        sideEffectName: "@atomist/k8-automation",
    });
}
